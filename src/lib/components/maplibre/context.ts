import type maplibregl from 'maplibre-gl';

export const MAP_CONTEXT_KEY = Symbol('maplibre-map');

export interface MapContext {
	readonly map: maplibregl.Map | undefined;
}
