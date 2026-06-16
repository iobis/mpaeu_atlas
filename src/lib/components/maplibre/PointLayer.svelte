<script lang="ts">
	import { getContext, onDestroy } from 'svelte';
	import type maplibregl from 'maplibre-gl';
	import type { GeoJSON } from 'geojson';
	import { MAP_CONTEXT_KEY, type MapContext } from './context.js';
	import { buildColorExpression, type ColorStyle } from './layer-utils.js';

	interface Props {
		id: string;
		data: GeoJSON;
		colorStyle?: ColorStyle;
		radius?: number;
		opacity?: number;
		visible?: boolean;
	}

	let {
		id,
		data,
		colorStyle = { type: 'solid', color: '#3b82f6' },
		radius = 6,
		opacity = 0.85,
		visible = true
	}: Props = $props();

	const ctx = getContext<MapContext>(MAP_CONTEXT_KEY);

	function addLayer(map: maplibregl.Map) {
		if (map.getSource(id)) {
			(map.getSource(id) as maplibregl.GeoJSONSource).setData(data);
		} else {
			map.addSource(id, { type: 'geojson', data });
		}

		if (!map.getLayer(id)) {
			map.addLayer({
				id,
				type: 'circle',
				source: id,
				paint: {
					'circle-radius': radius,
					'circle-color': buildColorExpression(colorStyle),
					'circle-opacity': opacity,
					'circle-stroke-width': 1,
					'circle-stroke-color': '#fff'
				}
			});
		}
	}

	$effect(() => {
		const map = ctx.map;
		if (!map) return;
		addLayer(map);
	});

	$effect(() => {
		const map = ctx.map;
		if (!map || !map.getSource(id)) return;
		(map.getSource(id) as maplibregl.GeoJSONSource).setData(data);
	});

	$effect(() => {
		const map = ctx.map;
		if (!map || !map.getLayer(id)) return;
		map.setPaintProperty(id, 'circle-color', buildColorExpression(colorStyle));
		map.setPaintProperty(id, 'circle-radius', radius);
		map.setPaintProperty(id, 'circle-opacity', opacity);
	});

	$effect(() => {
		const map = ctx.map;
		if (!map || !map.getLayer(id)) return;
		map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
	});

	onDestroy(() => {
		const map = ctx.map;
		if (!map) return;
		if (map.getLayer(id)) map.removeLayer(id);
		if (map.getSource(id)) map.removeSource(id);
	});
</script>
