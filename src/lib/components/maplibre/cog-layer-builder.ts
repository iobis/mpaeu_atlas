/**
 * cog-layer-builder.ts
 *
 * Pure function that builds a deck.gl COGLayer from props + a pre-created
 * colormap texture. No Svelte, no overlay — used by DeckOverlay.svelte.
 */

import { COGLayer } from '@developmentseed/deck.gl-geotiff';
import type { GeoTIFF, Overview } from '@developmentseed/geotiff';
import type { GetTileDataOptions } from '@developmentseed/deck.gl-geotiff';
import {
	Colormap,
	COLORMAP_INDEX,
	CreateTexture,
	FilterNoDataVal,
	LinearRescale,
	type ColormapName,
	type RasterModule
} from '@developmentseed/deck.gl-raster/gpu-modules';
import type { Texture } from '@luma.gl/core';

export interface CogLayerProps {
	id: string;
	url: string;
	opacity: number;
	visible: boolean;
	colormap?: ColormapName;
	dataMin: number;
	dataMax: number | undefined;
	bitDepth: 8 | 16;
	noDataValue: number | undefined;
	onGeoTIFFLoad?: ConstructorParameters<typeof COGLayer>[0]['onGeoTIFFLoad'];
}

// Finite float32-representable value used to replace NaN/±Inf pixels before
// they reach the GPU. Must be well outside any real-world environmental data range
// so FilterNoDataVal can match it via equality without false positives.
const F32_NAN_SENTINEL = 1e30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCogLayer(
	props: CogLayerProps,
	colormapTexture: Texture | null
): COGLayer<any> {
	const {
		id, url, opacity, visible,
		colormap, dataMin, dataMax, bitDepth, noDataValue, onGeoTIFFLoad
	} = props;

	const resolvedDataMax = dataMax ?? (2 ** bitDepth - 1);

	if (!colormap || !colormapTexture) {
		// RGB / palette / auto-inferred
		return new COGLayer({
			id,
			geotiff: url,
			opacity: visible ? opacity : 0,
			...(onGeoTIFFLoad && { onGeoTIFFLoad })
		} as unknown as ConstructorParameters<typeof COGLayer>[0]);
	}

	type TileData = { texture: Texture; width: number; height: number; byteLength: number; normMax: number };

	const getTileData = async (
		image: GeoTIFF | Overview,
		options: GetTileDataOptions
	): Promise<TileData> => {
		const { device: dev, x, y, signal } = options;
		const tile = await image.fetchTile(x, y, { signal, boundless: false });
		const arr = tile.array;
		const { width, height } = arr;
		// RasterArray is a union: pixel-interleaved has `.data`, band-separate has `.bands`
		const typedData = 'data' in arr ? arr.data : arr.bands[0];
		// Detect GPU format from actual TypedArray type.
		// r32float: shader sees raw float values (normMax=1.0, no normalization).
		// r16unorm / r8unorm: GPU normalises integer to [0,1] before shader sees it.
		let format: 'r32float' | 'r16unorm' | 'r8unorm';
		let normMax: number;
		if (typedData instanceof Float32Array) {
			format = 'r32float';
			normMax = 1.0;
			// GLSL `value == NaN` is always false (IEEE 754), so FilterNoDataVal can't
			// catch NaN nodata pixels via equality. Replace all non-finite values in-place
			// with a finite sentinel before the texture reaches the GPU.
			for (let i = 0; i < typedData.length; i++) {
				if (!Number.isFinite(typedData[i])) typedData[i] = F32_NAN_SENTINEL;
			}
		} else if (typedData instanceof Uint8Array || typedData instanceof Uint8ClampedArray) {
			format = 'r8unorm';
			normMax = 255;
		} else {
			format = 'r16unorm';
			normMax = 65535;
		}
		const texture = dev.createTexture({ data: typedData, format, width, height });
		return { texture, width, height, byteLength: typedData.byteLength, normMax };
	};

	const _colormap = colormap;
	const _colormapTexture = colormapTexture;

	const renderTile = (tileData: TileData) => {
		const { normMax } = tileData;
		const isFloat32 = normMax === 1.0;
		const renderPipeline: RasterModule[] = [
			{ module: CreateTexture, props: { textureName: tileData.texture } }
		];

		// Float32 rasters: always filter the NaN sentinel (normMax=1.0, so value=sentinel).
		// This catches NaN/±Inf nodata that was replaced in getTileData.
		if (isFloat32) {
			renderPipeline.push({
				module: FilterNoDataVal,
				props: { value: F32_NAN_SENTINEL }
			});
		}
		// Filter an explicit finite nodata value (integer rasters, or float COGs with
		// a non-NaN nodata tag — e.g. -9999). Skip NaN since we handled it above.
		if (noDataValue !== undefined && Number.isFinite(noDataValue)) {
			renderPipeline.push({
				module: FilterNoDataVal,
				props: { value: noDataValue / normMax }
			});
		}

		// For r32float textures: normMax=1.0 so rescaleMin/Max = raw float values (correct).
		// For r16unorm/r8unorm: normMax=65535/255 normalises into [0,1] space the GPU uses.
		renderPipeline.push({
			module: LinearRescale,
			props: { rescaleMin: dataMin / normMax, rescaleMax: resolvedDataMax / normMax }
		});

		renderPipeline.push({
			module: Colormap,
			props: {
				colormapTexture: _colormapTexture,
				colormapIndex: COLORMAP_INDEX[_colormap] ?? 0
			}
		});

		return { renderPipeline };
	};

	return new COGLayer({
		id,
		geotiff: url,
		opacity: visible ? opacity : 0,
		getTileData,
		renderTile,
		updateTriggers: {
			renderTile: [colormap, dataMin, resolvedDataMax, noDataValue]
		},
		...(onGeoTIFFLoad && { onGeoTIFFLoad })
	} as unknown as ConstructorParameters<typeof COGLayer>[0]);
}