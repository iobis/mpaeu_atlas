<script lang="ts">
	/**
	 * DeckOverlay.svelte
	 *
	 * Owns a single MapboxOverlay and manages all layer types:
	 *  - COG rasters  → COGLayer via deck.gl-raster
	 *  - Vector data  → GeoJsonLayer / ScatterplotLayer via @deck.gl/layers
	 *
	 * All layers share one overlay so z-ordering is respected across types.
	 *
	 * Data loading is fire-once-per-id: failed loads are recorded in `failedSet`
	 * (plain, non-reactive) so they are never retried. `loadingIds` and `errorIds`
	 * are bound to the parent for UI feedback.
	 */

	import { getContext, onDestroy } from 'svelte';
	import { MapboxOverlay } from '@deck.gl/mapbox';
	import {
		createColormapTexture,
		decodeColormapSprite
	} from '@developmentseed/deck.gl-raster/gpu-modules';
	import type { Device, Texture } from '@luma.gl/core';
	import { MAP_CONTEXT_KEY, type MapContext } from './context.js';
	import { buildCogLayer, type CogLayerProps } from './cog-layer-builder.js';
	import { buildVectorLayer, resolveColors, type VectorLayerProps } from './vector-layer-builder.js';
	import type { FeatureCollection } from 'geojson';
	import { geojson as fgb } from 'flatgeobuf';

	export type CogEntry    = { layerKind: 'cog';    zIndex: number } & CogLayerProps;
	export type VectorEntry = { layerKind: 'vector'; zIndex: number } & VectorLayerProps;
	export type OverlayEntry = CogEntry | VectorEntry;

	interface Props {
		entries: OverlayEntry[];
		/** IDs currently being fetched. Bound to parent for loading spinners. */
		loadingIds?: string[];
		/** IDs that failed to load. Bound to parent to show error state. */
		errorIds?: string[];
		/**
		 * Called once per vector layer after its data loads, with the resolved
		 * field name and colour map (explicit from config, or auto-generated when
		 * the explicit map doesn't match the actual feature values).
		 * Parent can use this to update the store's resolvedColorMap for the legend.
		 */
		onAutoDetect?: (id: string, field: string, colorMap: Record<string, string>) => void;
	}

	let { entries, loadingIds = $bindable([]), errorIds = $bindable([]), onAutoDetect }: Props = $props();

	const ctx = getContext<MapContext>(MAP_CONTEXT_KEY);

	let overlay: MapboxOverlay | undefined;
	let device = $state<Device | null>(null);
	let colormapImageData = $state<ImageData | null>(null);
	let colormapTexture = $state<Texture | null>(null);

	// ── Plain (non-reactive) caches ───────────────────────────────────────────────
	// Not $state so that mutations here never trigger $effects to re-run.
	const geojsonCache = new Map<string, FeatureCollection>();
	const loadingSet   = new Set<string>(); // IDs currently in-flight
	const failedSet    = new Set<string>(); // IDs that failed — never retried

	// Counter incremented after successful load → triggers rebuild effect only
	let cacheVersion = $state(0);

	// ── Vector data loader — supports GeoJSON and FlatGeobuf (.fgb) ──────────────
	async function loadVector(id: string, url: string): Promise<FeatureCollection> {
		const ext = url.split('?')[0].split('.').pop()?.toLowerCase();

		if (ext === 'fgb') {
			// Stream the file sequentially — avoids double-buffering the entire binary
			// in memory (ArrayBuffer + JS objects) which crashed large files like sea_basins.
			// Sequential fetch also sidesteps S3 CORS blocks on HTTP Range requests.
			const r = await fetch(url);
			if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
			if (!r.body) throw new Error(`No response body from ${url}`);
			const features: GeoJSON.Feature[] = [];
			for await (const feature of fgb.deserialize(r.body as ReadableStream)) {
				features.push(feature as GeoJSON.Feature);
			}
			return { type: 'FeatureCollection', features };
		}

		// Default: GeoJSON
		const r = await fetch(url);
		if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
		return r.json() as Promise<FeatureCollection>;
	}

	// ── Colormap sprite — fetched once ────────────────────────────────────────────
	let spritePromise: Promise<ImageData> | undefined;
	function loadSprite(): Promise<ImageData> {
		if (!spritePromise) {
			const url = new URL(
				'@developmentseed/deck.gl-raster/gpu-modules/colormaps.png',
				import.meta.url
			).href;
			spritePromise = fetch(url)
				.then((r) => r.arrayBuffer())
				.then((buf) => decodeColormapSprite(buf));
		}
		return spritePromise;
	}
	loadSprite().then((img) => { colormapImageData = img; });

	// ── GPU texture once device + sprite are ready ────────────────────────────────
	$effect(() => {
		if (!device || !colormapImageData || colormapTexture) return;
		colormapTexture = createColormapTexture(device, colormapImageData);
	});

	// ── Initialise overlay ────────────────────────────────────────────────────────
	$effect(() => {
		const map = ctx.map;
		if (!map || overlay) return;
		overlay = new MapboxOverlay({
			interleaved: false,
			onDeviceInitialized: (dev: Device) => { device = dev; },
			getTooltip: ({ object }: any) => {
				if (!object?.properties) return null;
				const props = object.properties as Record<string, unknown>;
				const keys = Object.keys(props).slice(0, 6);
				if (!keys.length) return null;
				const rows = keys
					.map((k) => `<tr><td style="padding-right:10px;color:#94a3b8;white-space:nowrap">${k}</td><td style="color:#e2e8f0">${props[k]}</td></tr>`)
					.join('');
				return {
					html: `<table style="border-collapse:collapse;font-size:12px;line-height:1.6">${rows}</table>`,
					style: {
						backgroundColor: 'rgba(15,23,42,0.92)',
						padding: '8px 10px',
						borderRadius: '6px',
						boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
						maxWidth: '300px',
						fontFamily: 'system-ui,sans-serif',
						pointerEvents: 'none',
					}
				};
			},
			layers: []
		});
		map.addControl(overlay as unknown as maplibregl.IControl);
	});

	// ── Fetch vector data ─────────────────────────────────────────────────────────
	// This effect only re-runs when `entries` changes (new layer added/removed).
	// It does NOT read any $state that it also writes to, eliminating feedback loops.
	$effect(() => {
		const vectorEntries = entries.filter((e) => e.layerKind === 'vector') as VectorEntry[];

		for (const entry of vectorEntries) {
			const { id, url } = entry;

			// Skip: already loaded, in flight, or previously failed
			if (geojsonCache.has(id) || loadingSet.has(id) || failedSet.has(id)) continue;

			loadingSet.add(id);
			loadingIds = [...loadingSet]; // update parent binding (write-only here)

			loadVector(id, url)
				.then((data) => {
					geojsonCache.set(id, data);
					// Resolve the effective colours (explicit or auto-generated) and
					// notify the parent so the legend can reflect what's on the map.
					const resolved = resolveColors(entry, data);
					if (resolved) onAutoDetect?.(id, resolved.field, resolved.colorMap);
					cacheVersion += 1;
				})
				.catch((e) => {
					console.error(`[DeckOverlay] Failed to load "${id}":`, e);
					failedSet.add(id);
					errorIds = [...failedSet];
				})
				.finally(() => {
					loadingSet.delete(id);
					loadingIds = [...loadingSet];
				});
		}
	});

	// ── Rebuild DeckGL layers whenever data or settings change ───────────────────
	$effect(() => {
		if (!overlay) return;
		void colormapTexture;
		void entries;
		void cacheVersion;

		const sorted = [...entries].sort((a, b) => a.zIndex - b.zIndex);
		const builtLayers = sorted
			.map((entry) => {
				if (entry.layerKind === 'cog') {
					if (entry.colormap && !colormapTexture) return null;
					return buildCogLayer(entry, colormapTexture);
				}
				const data = geojsonCache.get(entry.id);
				if (!data) return null;
				return buildVectorLayer(entry, data);
			})
			.filter(Boolean);

		overlay.setProps({ layers: builtLayers });
	});

	onDestroy(() => {
		const map = ctx.map;
		if (map && overlay) map.removeControl(overlay as unknown as maplibregl.IControl);
		overlay = undefined;
	});
</script>
