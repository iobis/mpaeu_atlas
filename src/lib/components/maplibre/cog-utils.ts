/**
 * cog-utils.ts
 *
 * Reads tiles from a Cloud-Optimized GeoTIFF (any projection supported by
 * providing a forward/inverse transform) using geotiff.js HTTP range requests,
 * then reprojects into Web Mercator (EPSG:3857) pixels for MapLibre.
 *
 * For EPSG:4326 COGs no extra projection library is needed — the forward
 * transform from 4326 → pixel coords is just an affine from the GeoTIFF's
 * own geo-transform.
 */

import { fromUrl, type GeoTIFF, type TypedArray } from 'geotiff';

export interface CogMetadata {
	tiff: GeoTIFF;
	width: number;
	height: number;
	/** Full bounding box in the COG's own CRS [minX, minY, maxX, maxY] */
	bbox: [number, number, number, number];
	/** Number of raster bands */
	bandCount: number;
	noData: number | null;
}

const cogCache = new Map<string, Promise<CogMetadata>>();

export async function openCog(url: string): Promise<CogMetadata> {
	if (cogCache.has(url)) return cogCache.get(url)!;

	const promise = (async () => {
		const tiff = await fromUrl(url, { allowFullFile: false });
		const image = await tiff.getImage();
		const bbox = image.getBoundingBox() as [number, number, number, number];
		const width = image.getWidth();
		const height = image.getHeight();
		const samplesPerPixel = image.getSamplesPerPixel();
		const noData = image.getGDALNoData();
		return { tiff, width, height, bbox, bandCount: samplesPerPixel, noData };
	})();

	cogCache.set(url, promise);
	return promise;
}

/**
 * Convert Web Mercator tile coords → EPSG:4326 bounding box.
 * MapLibre always requests tiles in Web Mercator (EPSG:3857).
 */
function tile2bbox4326(x: number, y: number, z: number): [number, number, number, number] {
	const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
	const north = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
	const south_n = Math.PI - (2 * Math.PI * (y + 1)) / Math.pow(2, z);
	const south = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(south_n) - Math.exp(-south_n)));
	const west = (x / Math.pow(2, z)) * 360 - 180;
	const east = ((x + 1) / Math.pow(2, z)) * 360 - 180;
	return [west, south, east, north];
}

/**
 * Render a single MapLibre tile (x/y/z) from a EPSG:4326 COG.
 * Returns raw RGBA bytes for a `tileSize × tileSize` image, or null if the
 * tile doesn't overlap the COG.
 */
export async function renderCogTile(
	url: string,
	x: number,
	y: number,
	z: number,
	tileSize: number,
	colorize: ColorizeFunction
): Promise<Uint8ClampedArray | null> {
	const meta = await openCog(url);
	const [cogMinX, cogMinY, cogMaxX, cogMaxY] = meta.bbox;

	// Tile bounds in EPSG:4326
	const [tMinX, tMinY, tMaxX, tMaxY] = tile2bbox4326(x, y, z);

	// Check overlap
	if (tMaxX <= cogMinX || tMinX >= cogMaxX || tMaxY <= cogMinY || tMinY >= cogMaxY) {
		return null;
	}

	// Clamp window to COG bounds
	const winMinX = Math.max(tMinX, cogMinX);
	const winMinY = Math.max(tMinY, cogMinY);
	const winMaxX = Math.min(tMaxX, cogMaxX);
	const winMaxY = Math.min(tMaxY, cogMaxY);

	// Convert geographic window → pixel window in the COG
	const cogW = cogMaxX - cogMinX;
	const cogH = cogMaxY - cogMinY;

	const px1 = Math.floor(((winMinX - cogMinX) / cogW) * meta.width);
	const py1 = Math.floor(((cogMaxY - winMaxY) / cogH) * meta.height); // Y flipped
	const px2 = Math.ceil(((winMaxX - cogMinX) / cogW) * meta.width);
	const py2 = Math.ceil(((cogMaxY - winMinY) / cogH) * meta.height);

	const readW = Math.max(1, px2 - px1);
	const readH = Math.max(1, py2 - py1);

	// How many output pixels does the window occupy in the tile?
	const outX1 = Math.round(((winMinX - tMinX) / (tMaxX - tMinX)) * tileSize);
	const outY1 = Math.round(((tMaxY - winMaxY) / (tMaxY - tMinY)) * tileSize);
	const outX2 = Math.round(((winMaxX - tMinX) / (tMaxX - tMinX)) * tileSize);
	const outY2 = Math.round(((tMaxY - winMinY) / (tMaxY - tMinY)) * tileSize);
	const outW = Math.max(1, outX2 - outX1);
	const outH = Math.max(1, outY2 - outY1);

	// Read raster window (all bands at once)
	const image = await meta.tiff.getImage();
	const samples = await image.readRasters({
		window: [px1, py1, px2, py2],
		width: outW,
		height: outH,
		interleave: false // one array per band
	}) as TypedArray[];

	// Compose RGBA output buffer for the full tile (transparent by default)
	const rgba = new Uint8ClampedArray(tileSize * tileSize * 4);

	const bandCount = samples.length;
	const pixel = new Float64Array(bandCount);

	for (let row = 0; row < outH; row++) {
		for (let col = 0; col < outW; col++) {
			const srcIdx = row * outW + col;
			for (let b = 0; b < bandCount; b++) {
				pixel[b] = samples[b][srcIdx];
			}

			const isNoData = meta.noData !== null && pixel[0] === meta.noData;
			if (isNoData) continue;

			const dstRow = outY1 + row;
			const dstCol = outX1 + col;
			if (dstRow < 0 || dstRow >= tileSize || dstCol < 0 || dstCol >= tileSize) continue;

			const dstIdx = (dstRow * tileSize + dstCol) * 4;
			colorize(pixel, rgba, dstIdx, meta);
		}
	}

	return rgba;
}

// ── Colorize function type ────────────────────────────────────────────────────

export interface ColorizeContext {
	noData: number | null;
	bandCount: number;
}

/**
 * Called per pixel. Write RGBA into `out` at `offset`.
 * `values` contains one Float64 per band.
 */
export type ColorizeFunction = (
	values: Float64Array,
	out: Uint8ClampedArray,
	offset: number,
	ctx: ColorizeContext
) => void;

// ── Built-in colorize helpers ─────────────────────────────────────────────────

/** RGB(A) passthrough for 3- or 4-band 8-bit imagery */
export const colorizeTrueColor: ColorizeFunction = (values, out, offset) => {
	out[offset]     = Math.round(values[0]);
	out[offset + 1] = Math.round(values[1]);
	out[offset + 2] = Math.round(values[2]);
	out[offset + 3] = values.length >= 4 ? Math.round(values[3]) : 255;
};

/**
 * Single-band continuous colormap using a list of [value, r, g, b] stops.
 * Values outside the range are clamped to the nearest stop.
 */
export function makeColormapColorize(
	stops: Array<[number, number, number, number]>
): ColorizeFunction {
	return (values, out, offset) => {
		const v = values[0];
		if (stops.length === 0) return;

		if (v <= stops[0][0]) {
			const [, r, g, b] = stops[0];
			out[offset] = r; out[offset + 1] = g; out[offset + 2] = b; out[offset + 3] = 255;
			return;
		}
		if (v >= stops[stops.length - 1][0]) {
			const [, r, g, b] = stops[stops.length - 1];
			out[offset] = r; out[offset + 1] = g; out[offset + 2] = b; out[offset + 3] = 255;
			return;
		}
		for (let i = 0; i < stops.length - 1; i++) {
			const [v0, r0, g0, b0] = stops[i];
			const [v1, r1, g1, b1] = stops[i + 1];
			if (v >= v0 && v <= v1) {
				const t = (v - v0) / (v1 - v0);
				out[offset]     = Math.round(r0 + t * (r1 - r0));
				out[offset + 1] = Math.round(g0 + t * (g1 - g0));
				out[offset + 2] = Math.round(b0 + t * (b1 - b0));
				out[offset + 3] = 255;
				return;
			}
		}
	};
}
