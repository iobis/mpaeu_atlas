<script lang="ts">
	import { Map, DeckOverlay } from '$lib/components/maplibre/index.js';
	import type { OverlayEntry, CogEntry, VectorEntry } from '$lib/components/maplibre/DeckOverlay.svelte';
	import type { VectorLayerProps } from '$lib/components/maplibre/vector-layer-builder.js';
	import LayerCatalogue from '$lib/components/LayerCatalogue.svelte';
	import LayerPanel from '$lib/components/LayerPanel.svelte';
	import { activeLayers } from '$lib/stores/activeLayers.svelte.js';
	import type { LayerType } from '$lib/data/layers.js';

	function typeToGeomKind(type: LayerType): VectorLayerProps['geomKind'] {
		if (type === 'vector-point') return 'geojson-point';
		if (type === 'vector-line')  return 'geojson-line';
		return 'geojson-polygon';
	}

	// Build a unified ordered list of OverlayEntry for DeckOverlay.
	// Index in activeLayers.layers = z-index (0 = bottom).
	const overlayEntries = $derived<OverlayEntry[]>(
		activeLayers.layers.map((l, zIndex): OverlayEntry => {
			if (l.config.type === 'raster') {
				return {
					layerKind: 'cog',
					zIndex,
					id: l.config.id,
					url: l.config.url,
					opacity: l.settings.opacity,
					visible: l.settings.visible,
					colormap: l.config.scale === 'continuous' ? l.settings.colormap : undefined,
					dataMin: l.settings.dataMin,
					dataMax: l.settings.dataMax,
					bitDepth: (l.settings.detectedBitDepth as 8 | 16) ?? 16,
					noDataValue: l.settings.detectedNoData ?? undefined,
					onGeoTIFFLoad: (tiff: any) => {
						activeLayers.updateSettings(l.config.id, {
							detectedNoData: tiff.nodata ?? null,
							detectedBitDepth: tiff.cachedTags?.bitsPerSample?.[0] ?? null
						});
					}
				} satisfies CogEntry;
			}
			return {
				layerKind: 'vector',
				zIndex,
				id: l.config.id,
				url: l.config.url,
				geomKind: typeToGeomKind(l.config.type),
				opacity: l.settings.opacity,
				visible: l.settings.visible,
				categoryField: l.config.categoryField,
				colorMap: l.settings.resolvedColorMap ?? l.config.colorMap
			} satisfies VectorEntry;
		})
	);

	let loadingIds = $state<string[]>([]);
	let errorIds   = $state<string[]>([]);

	function handleAutoDetect(id: string, _field: string, colorMap: Record<string, string>) {
		activeLayers.updateSettings(id, { resolvedColorMap: colorMap });
	}
</script>

<svelte:head><title>Atlas</title></svelte:head>

<div class="atlas">
	<LayerCatalogue />

	<div class="map-wrapper">
		<Map center={[-10, 48]} zoom={4}>
			<DeckOverlay entries={overlayEntries} bind:loadingIds bind:errorIds onAutoDetect={handleAutoDetect} />
		</Map>

		<LayerPanel {loadingIds} {errorIds} />
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Segoe UI', system-ui, sans-serif;
		background: #f6f6f6;
		color: #184e77;
	}
	.atlas { display: flex; height: 100dvh; overflow: hidden; }
	.map-wrapper { flex: 1; position: relative; }
</style>
