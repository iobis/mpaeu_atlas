<script lang="ts">
	import type { ActiveLayer } from '$lib/stores/activeLayers.svelte.js';
	import { activeLayers } from '$lib/stores/activeLayers.svelte.js';
	import ColormapLegend from './ColormapLegend.svelte';
	import type { ColormapName } from '@developmentseed/deck.gl-raster/gpu-modules';

	interface Props {
		layer: ActiveLayer;
		dragging?: boolean;
		loading?: boolean;
		error?: boolean;
		onDragStart: (e: DragEvent) => void;
		onDragEnd: () => void;
	}

	let { layer, dragging = false, loading = false, error = false, onDragStart, onDragEnd }: Props = $props();

	const COLORMAPS: ColormapName[] = [
		'viridis', 'plasma', 'magma', 'inferno',
		'rdylgn', 'rdbu', 'greys', 'blues',
		'ylgnbu', 'cfastie', 'spectral', 'turbo'
	];

	const s = $derived(layer.settings);

	function update(patch: Parameters<typeof activeLayers.updateSettings>[1]) {
		activeLayers.updateSettings(layer.config.id, patch);
	}

	const isContinuous = $derived(
		layer.config.type === 'raster' && layer.config.scale === 'continuous'
	);

	const isCategoricalVector = $derived(
		layer.config.type.startsWith('vector') && layer.config.scale === 'categorical'
	);

	const legendMax = $derived(
		s.dataMax ?? (s.detectedBitDepth ? 2 ** s.detectedBitDepth - 1 : undefined)
	);

</script>

<div class="layer-card" class:dragging>
	<!-- ── Header — drag handle + name + actions ── -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="card-header"
		role="button"
		tabindex="0"
		draggable="true"
		ondragstart={onDragStart}
		ondragend={onDragEnd}
	>
		<span class="drag-handle" aria-hidden="true">⠿</span>

		<button
			class="visibility-btn"
			onclick={() => update({ visible: !s.visible })}
			title={s.visible ? 'Hide layer' : 'Show layer'}
			aria-label={s.visible ? 'Hide' : 'Show'}
		>
			<span class="vis-dot" class:hidden={!s.visible} aria-hidden="true"></span>
		</button>

		<span class="card-name" title={layer.config.name}>{layer.config.name}</span>

		<div class="card-actions">
			{#if loading}
				<span class="loading-dot" title="Loading data…" aria-label="Loading"></span>
			{:else if error}
				<span class="error-dot" title="Failed to load data" aria-label="Load error">!</span>
			{/if}
			<button
				class="icon-btn remove-btn"
				onclick={() => activeLayers.remove(layer.config.id)}
				title="Remove layer"
				aria-label="Remove"
			>✕</button>
		</div>
	</div>

	<!-- ── Source + description ── -->
	<p class="card-meta">
		{layer.config.description}
	</p>
	<p class="card-meta card-meta-links">
		<span class="meta-item"><strong>Source:</strong>
			{#if layer.config.source.startsWith('http')}
				<a class="file-link" href={layer.config.source} target="_blank" rel="noopener">{layer.config.source}</a>
			{:else}
				{layer.config.source}
			{/if}
		</span>
		{#if layer.config.link}
			<a class="file-link" href={layer.config.link} target="_blank" rel="noopener">Source file ↗</a>
		{/if}
	</p>

	<!-- ── Controls ── -->
	{#if isContinuous}
		<div class="card-controls">
			<ColormapLegend colormap={s.colormap} min={s.dataMin} max={legendMax} dataDivider={layer.config.dataDivider}/>

			<label class="ctrl-row">
				<span class="ctrl-label">Opacity</span>
				<input type="range" min="0" max="1" step="0.05"
					value={s.opacity}
					oninput={(e) => update({ opacity: +e.currentTarget.value })} />
				<span class="ctrl-value">{s.opacity.toFixed(2)}</span>
			</label>

			<label class="ctrl-row">
				<span class="ctrl-label">Colormap</span>
				<select value={s.colormap}
					onchange={(e) => update({ colormap: e.currentTarget.value as ColormapName })}
					class="ctrl-select">
					{#each COLORMAPS as cm}<option value={cm}>{cm}</option>{/each}
				</select>
			</label>

			<div class="ctrl-row">
				<span class="ctrl-label">Range</span>
				<div class="range-inputs">
					<input type="number" class="range-input" placeholder="min"
						value={s.dataMin}
						oninput={(e) => update({ dataMin: +e.currentTarget.value })} />
					<span class="range-sep">–</span>
					<input type="number" class="range-input" placeholder="max"
						value={s.dataMax ?? ''}
						oninput={(e) => {
							const v = e.currentTarget.value;
							update({ dataMax: v === '' ? undefined : +v });
						}} />
				</div>
			</div>
		</div>

	{:else if isCategoricalVector && s.resolvedColorMap}
		<div class="card-controls">
			<div class="cat-legend">
				{#each Object.entries(s.resolvedColorMap) as [value, colour]}
					<div class="cat-row">
						<span class="cat-swatch" style="background:{colour}"></span>
						<span class="cat-label">{value}</span>
					</div>
				{/each}
			</div>
			<label class="ctrl-row">
				<span class="ctrl-label">Opacity</span>
				<input type="range" min="0" max="1" step="0.05"
					value={s.opacity}
					oninput={(e) => update({ opacity: +e.currentTarget.value })} />
				<span class="ctrl-value">{s.opacity.toFixed(2)}</span>
			</label>
		</div>

	{:else}
		<div class="card-controls">
			<label class="ctrl-row">
				<span class="ctrl-label">Opacity</span>
				<input type="range" min="0" max="1" step="0.05"
					value={s.opacity}
					oninput={(e) => update({ opacity: +e.currentTarget.value })} />
				<span class="ctrl-value">{s.opacity.toFixed(2)}</span>
			</label>
		</div>
	{/if}
</div>

<style>
	.layer-card {
		background: #ffffff;
		border: 1px solid #d8d8d8;
		border-radius: 8px;
		overflow: hidden;
		transition: opacity 0.15s;
	}
	.layer-card.dragging { opacity: 0.3; }

	/* ── Header ── */
	.card-header {
		display: flex;
		align-items: flex-start;
		gap: 0.35rem;
		padding: 0.5rem 0.65rem;
		background: #f0f4f8;
		border-bottom: 1px solid #d8d8d8;
		cursor: grab;
		user-select: none;
	}
	.card-header:active { cursor: grabbing; }
	.card-header button { pointer-events: auto; }

	.drag-handle {
		color: #94a3b8;
		font-size: 1rem;
		line-height: 1;
		flex-shrink: 0;
		pointer-events: none;
	}

	/* Visibility toggle as a dot */
	.visibility-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}
	.vis-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #006cd7;
		border: 1.5px solid #006cd7;
		transition: background 0.12s;
	}
	.vis-dot.hidden {
		background: transparent;
		border-color: #94a3b8;
	}

	.card-name {
		flex: 1;
		font-size: 0.8rem;
		font-weight: 600;
		color: #1e293b;
		word-break: break-word;
	}

	.card-actions {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		flex-shrink: 0;
	}

	.loading-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		border: 1.5px solid #006cd7;
		border-top-color: transparent;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.error-dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #dc2626;
		color: #fff;
		font-size: 0.65rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		line-height: 1;
	}

	.icon-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: #94a3b8;
		font-size: 0.75rem;
		padding: 0.15rem 0.28rem;
		border-radius: 3px;
		line-height: 1;
	}
	.remove-btn:hover { background: #fee2e2; color: #dc2626; }

	/* ── Meta ── */
	.card-meta {
		font-size: 0.69rem;
		color: #64748b;
		margin: 0;
		padding: 0.45rem 0.65rem 0 0.65rem;
		line-height: 1.4;
	}
	.card-meta-links {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding-top: 0.3rem;
		padding-bottom: 0.45rem;
		border-bottom: 1px solid #ebebeb;
	}
	.meta-item { display: inline; }
	.meta-item strong { color: #475569; font-weight: 600; margin-right: 0.2rem; }
	.file-link {
		color: #006cd7;
		font-size: 0.67rem;
		text-decoration: none;
	}
	.file-link:hover { text-decoration: underline; }

	/* ── Controls ── */
	.card-controls {
		padding: 0.55rem 0.65rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.ctrl-row { display: flex; align-items: center; gap: 0.45rem; }
	.ctrl-label { font-size: 0.68rem; color: #475569; width: 4.2rem; flex-shrink: 0; }
	.ctrl-row input[type='range'] { flex: 1; accent-color: #006cd7; }
	.ctrl-value {
		font-size: 0.67rem;
		color: #64748b;
		width: 2.4rem;
		text-align: right;
		flex-shrink: 0;
	}
	.ctrl-select {
		flex: 1;
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 4px;
		color: #1e293b;
		padding: 0.18rem 0.3rem;
		font-size: 0.72rem;
	}
	.range-inputs { flex: 1; display: flex; align-items: center; gap: 0.25rem; }
	.range-input {
		flex: 1;
		max-width: 44px;
		background: #f0f4f8;
		border: 1px solid #d4d4d4;
		border-radius: 4px;
		color: #1e293b;
		padding: 0.18rem 0.35rem;
		font-size: 0.7rem;
	}
	.range-sep { font-size: 0.68rem; color: #94a3b8; }

	/* ── Categorical legend ── */
	.cat-legend { display: flex; flex-direction: column; gap: 0.25rem; }
	.cat-row { display: flex; align-items: center; gap: 0.45rem; }
	.cat-swatch {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		flex-shrink: 0;
		border: 1px solid rgba(0,0,0,0.12);
	}
	.cat-label { font-size: 0.7rem; color: #475569; }
</style>
