<script lang="ts">
	import { activeLayers } from '$lib/stores/activeLayers.svelte.js';
	import LayerControls from './LayerControls.svelte';

	interface Props {
		loadingIds?: string[];
		errorIds?: string[];
	}

	let { loadingIds = [], errorIds = [] }: Props = $props();

	let collapsed = $state(false);
	const layers = $derived(activeLayers.layers);
	// UI: top layer first (reversed vs the bottom-to-top store order)
	const reversed = $derived([...layers].reverse());

	// ── Drag-and-drop state ────────────────────────────────────────────────────
	let dragId = $state<string | null>(null);
	let overId  = $state<string | null>(null);

	function onDragStart(e: DragEvent, id: string) {
		dragId = id;
		e.dataTransfer!.effectAllowed = 'move';
		const ghost = document.createElement('div');
		ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px';
		document.body.appendChild(ghost);
		e.dataTransfer!.setDragImage(ghost, 0, 0);
		setTimeout(() => document.body.removeChild(ghost), 0);
	}

	function onDragOver(e: DragEvent, id: string) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		overId = id;
	}

	function onDrop(e: DragEvent, targetId: string) {
		e.preventDefault();
		if (!dragId || dragId === targetId) { dragId = null; overId = null; return; }
		const fromIdx = layers.findIndex((l) => l.config.id === dragId);
		const toIdx   = layers.findIndex((l) => l.config.id === targetId);
		activeLayers.reorder(fromIdx, toIdx);
		dragId = null;
		overId = null;
	}

	function onDragEnd() { dragId = null; overId = null; }
</script>

{#if layers.length > 0}
	<div class="panel" class:collapsed>
		<div class="panel-header">
			<span class="panel-title">Active Layers</span>
			<span class="panel-count">{layers.length}</span>
			<button
				class="collapse-btn"
				onclick={() => (collapsed = !collapsed)}
				aria-label={collapsed ? 'Expand' : 'Collapse'}
			>{collapsed ? '▲' : '▼'}</button>
		</div>

		{#if !collapsed}
			<div class="panel-body">
				{#each reversed as layer (layer.config.id)}
					{@const isDragging = dragId === layer.config.id}
					{@const isOver    = overId  === layer.config.id && !isDragging}
					{@const isLoading = loadingIds.includes(layer.config.id)}
					{@const hasError  = errorIds.includes(layer.config.id)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="card-wrapper"
						class:is-over={isOver}
						class:is-dragging={isDragging}
						ondragover={(e) => onDragOver(e, layer.config.id)}
						ondrop={(e)     => onDrop(e, layer.config.id)}
						ondragleave={() => { if (overId === layer.config.id) overId = null; }}
					>
						<LayerControls
							{layer}
							dragging={isDragging}
							loading={isLoading}
							error={hasError}
							onDragStart={(e) => onDragStart(e, layer.config.id)}
							onDragEnd={onDragEnd}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.panel {
		position: absolute;
		top: 1rem; right: 1rem;
		z-index: 10;
		width: 295px;
		max-height: calc(100dvh - 2rem);
		display: flex;
		flex-direction: column;
		border-radius: 10px;
		border: 1px solid #d4d4d4;
		background: #f6f6f6;
		box-shadow: 0 4px 20px rgba(0,0,0,0.18);
		overflow: hidden;
	}
	.panel.collapsed { max-height: none; }

	.panel-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 0.8rem;
		background: #f0f4f8;
		border-bottom: 1px solid #d4d4d4;
		flex-shrink: 0;
		user-select: none;
	}
	.panel-title {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: #006cd7;
		flex: 1;
	}
	.panel-count {
		background: #006cd7;
		color: #e0f2fe;
		font-size: 0.62rem;
		font-weight: 700;
		padding: 0.05rem 0.38rem;
		border-radius: 999px;
	}
	.collapse-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: #94a3b8;
		font-size: 0.62rem;
		padding: 0.1rem 0.2rem;
		border-radius: 3px;
	}
	.collapse-btn:hover { color: #64748b; }

	.panel-body {
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.5rem;
		flex: 1;
	}

	/* ── Drop targets ── */
	.card-wrapper {
		border-radius: 8px;
		border: 2px solid transparent;
		transition: border-color 0.1s;
	}
	.card-wrapper.is-over    { border-color: #38bdf8; }
	.card-wrapper.is-dragging { opacity: 0.3; }
</style>
