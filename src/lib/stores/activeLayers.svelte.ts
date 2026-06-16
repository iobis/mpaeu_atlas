import type { ColormapName } from '@developmentseed/deck.gl-raster/gpu-modules';
import type { LayerConfig } from '$lib/data/layers.js';

// ── Per-layer runtime settings (mutable, user-controlled) ────────────────────

export interface LayerSettings {
	opacity: number;
	visible: boolean;
	colormap: ColormapName;
	dataMin: number;
	dataMax: number | undefined;
	/** Auto-detected from GeoTIFF metadata */
	detectedNoData: number | null;
	detectedBitDepth: 8 | 16 | 32 | null;
	/**
	 * Resolved colour map for categorical vector layers.
	 * Populated from config.colorMap or auto-assigned on first load.
	 */
	resolvedColorMap: Record<string, string> | null;
}

// ── Active layer = config + settings + stable render key ─────────────────────

export interface ActiveLayer {
	config: LayerConfig;
	settings: LayerSettings;
	/** Incremented to force a full layer remount (e.g. on URL change) */
	key: number;
}

// ── Default settings derived from a LayerConfig ───────────────────────────────

function defaultSettings(config: LayerConfig): LayerSettings {
	return {
		opacity: 0.85,
		visible: true,
		colormap: config.colormap ?? 'viridis',
		dataMin: config.dataMin ?? 0,
		dataMax: config.dataMax,
		detectedNoData: null,
		detectedBitDepth: null,
		resolvedColorMap: config.colorMap ?? null
	};
}

// ── Store ─────────────────────────────────────────────────────────────────────
// Svelte 5 class-based reactive store using $state.

class ActiveLayersStore {
	// Ordered list — index 0 = bottom of stack, last = top.
	layers = $state<ActiveLayer[]>([]);

	private keyCounter = 0;

	isActive(id: string): boolean {
		return this.layers.some((l) => l.config.id === id);
	}

	add(config: LayerConfig) {
		if (this.isActive(config.id)) return;
		this.layers.push({
			config,
			settings: defaultSettings(config),
			key: this.keyCounter++
		});
	}

	remove(id: string) {
		const idx = this.layers.findIndex((l) => l.config.id === id);
		if (idx !== -1) this.layers.splice(idx, 1);
	}

	toggle(config: LayerConfig) {
		this.isActive(config.id) ? this.remove(config.id) : this.add(config);
	}

	updateSettings(id: string, patch: Partial<LayerSettings>) {
		const layer = this.layers.find((l) => l.config.id === id);
		if (layer) Object.assign(layer.settings, patch);
	}

	/** Move layer at `fromIndex` to `toIndex` */
	reorder(fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) return;
		const [item] = this.layers.splice(fromIndex, 1);
		this.layers.splice(toIndex, 0, item);
	}

	moveUp(id: string) {
		const idx = this.layers.findIndex((l) => l.config.id === id);
		if (idx < this.layers.length - 1) this.reorder(idx, idx + 1);
	}

	moveDown(id: string) {
		const idx = this.layers.findIndex((l) => l.config.id === id);
		if (idx > 0) this.reorder(idx, idx - 1);
	}
}

export const activeLayers = new ActiveLayersStore();