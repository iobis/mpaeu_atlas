<script lang="ts">
	/**
	 * ColormapLegend.svelte
	 *
	 * Renders a horizontal colormap gradient bar by slicing a single row
	 * from the shipped colormaps.png sprite using CSS background tricks —
	 * no canvas, no extra fetch beyond what DeckCogLayer already loads.
	 *
	 * The sprite is 256 × 107 px (1px per colormap row, 256 colour steps wide).
	 * We scale it up vertically so the selected row fills the bar height.
	 */

	import { COLORMAP_INDEX } from '@developmentseed/deck.gl-raster/gpu-modules';
	import type { ColormapName } from '@developmentseed/deck.gl-raster/gpu-modules';

	interface Props {
		colormap: ColormapName;
		min: number;
		max: number | undefined;
		/** Divide min/max by this for display only. @default 1 */
		dataDivider?: number;
		/** Height of the gradient bar in px. @default 14 */
		barHeight?: number;
	}

	let { colormap, min, max, dataDivider = 1, barHeight = 14 }: Props = $props();

	const TOTAL_ROWS = Object.keys(COLORMAP_INDEX).length; // 107

	const spriteUrl = new URL(
		'@developmentseed/deck.gl-raster/gpu-modules/colormaps.png',
		import.meta.url
	).href;

	const rowIndex = $derived(COLORMAP_INDEX[colormap] ?? 0);
	const bgPositionY = $derived(`-${rowIndex * barHeight}px`);
	const bgSize = $derived(`100% ${TOTAL_ROWS * barHeight}px`);

	// Apply divider to labels only — raster data values are unchanged
	const minLabel = $derived(formatLabel(min / dataDivider));
	const maxLabel = $derived(max !== undefined ? formatLabel(max / dataDivider) : 'auto');
 
	function formatLabel(v: number): string {
		// Show up to 1 significant figures, trim trailing zeros
		return parseFloat(v.toPrecision(1)).toString();
	}
</script>

<div class="legend">
	<div
		class="gradient-bar"
		style="
			height: {barHeight}px;
			background-image: url({spriteUrl});
			background-size: {bgSize};
			background-position: 0 {bgPositionY};
			background-repeat: no-repeat;
			image-rendering: pixelated;
		"
		title="{colormap} colormap"
		role="img"
		aria-label="{colormap} colormap gradient from {minLabel} to {maxLabel}"
	></div>
	<div class="legend-labels">
		<span>{min}</span>
		<!-- <span class="legend-name">{colormap}</span> -->
		<span>{maxLabel}</span>
	</div>
</div>

<style>
	.legend {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.gradient-bar {
		width: 100%;
		border-radius: 3px;
		border: 1px solid #c6c6c6;
	}

	.legend-labels {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.65rem;
		color: #64748b;
	}


</style>
