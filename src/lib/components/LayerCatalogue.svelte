<script lang="ts">
	import { LAYER_CATALOGUE, type LayerConfig } from '$lib/data/layers.js';
	import { activeLayers } from '$lib/stores/activeLayers.svelte.js';
	import logo from '$lib/assets/MPA_Logo.png';

	// ── Group layers by category ───────────────────────────────────────────────────
	const groups = $derived.by(() => {
		const map = new Map<string, LayerConfig[]>();
		for (const layer of LAYER_CATALOGUE) {
			if (!map.has(layer.category)) map.set(layer.category, []);
			map.get(layer.category)!.push(layer);
		}
		return map;
	});

	// ── Category expand/collapse ───────────────────────────────────────────────────
	let expanded = $state<Record<string, boolean>>(
		Object.fromEntries([...new Set(LAYER_CATALOGUE.map((l) => l.category))].map((c) => [c, false]))
	);

	// ── Info accordion: one open at a time ────────────────────────────────────────
	let openInfoId = $state<string | null>(null);

	// ── Search ────────────────────────────────────────────────────────────────────
	let searchQuery = $state('');

	const filteredGroups = $derived.by(() => {
		if (!searchQuery.trim()) return groups;
		const q = searchQuery.toLowerCase();
		const filtered = new Map<string, LayerConfig[]>();
		for (const [cat, layers] of groups) {
			const matches = layers.filter((l) => l.name.toLowerCase().includes(q));
			if (matches.length) {
				filtered.set(cat, matches);
				// auto-expand matching categories
				expanded[cat] = true;
			}
		}
		return filtered;
	});

	function toggleInfo(id: string) {
		openInfoId = openInfoId === id ? null : id;
	}
</script>

<aside class="catalogue">
	<!-- ── Header ── -->
	<div class="catalogue-header">
		<img src={logo} alt="MPA Europe logo" class="logo" />
		<h1 class="catalogue-title">Atlas for MSP</h1>
	</div>

	<div class="catalogue-explanation">
		<p class="catalogue-sub">
			This atlas supports marine and maritime spatial planning (MSP) by mapping where relevant features of nature importance occur, 
			and how they overlap with environmental conditions, in European and adjacent seas. The spatial resolution is 0.05° (approximately 5km). 
			This is a guide for regional spatial planning that can inform biodiversity-inclusive planning at local scales with stakeholders.
		</p>
		<p class="catalogue-sub">
			Details of the MPA Europe Project that developed it and its funding sources are at the project <a href="https://mpa-europe.eu/" target="_blank" rel="noopener">website</a>.
		</p>
		<p class="catalogue-sub">
			The Representative Biodiversity Areas (RBA) are the result of a prioritisation analysis using systematic conservation planning,
			based on the distribution of marine species shown on the <a href="https://shiny.obis.org/distmaps" target="_blank" rel="noopener">Species Explorer here</a>.
			Thus, the top 10 % or 30% RBA is the network of areas that, if effectively conserved and managed through a network of MPAs or other effective conservation measures,
			could protect the most species, particularly rare and threatened species.  
			Because tens of thousands of species were included, the RBA represent all habitats,
			ecosystems and biogeographic regions in Europe’s seas.
			Analyses using the predicted future ranges of these species showed that the 
			RBA would still be the optimal areas under all IPCC climate change scenarios to 2100.

		</p>
		<!-- <p class="catalogue-sub">
			<a href="https://mpa-europe.eu/" target="_blank" rel="noopener">mpa-europe.eu</a>
		</p> -->
	</div>

	<!-- ── Search ── -->
	<!-- <div class="search-wrap">
		<span class="search-icon" aria-hidden="true">⌕</span>
		<input
			class="search-input"
			type="search"
			placeholder="Search layers…"
			bind:value={searchQuery}
			aria-label="Search layers"
		/>
	</div> -->

	<!-- ── Layer groups ── -->
	<div class="catalogue-body">
		{#each filteredGroups as [category, layers]}
			<div class="category">
				<button
					class="category-header"
					onclick={() => (expanded[category] = !expanded[category])}
					aria-expanded={expanded[category]}
				>
					<span class="chevron" class:open={expanded[category]}>›</span>
					<span class="category-name">{category}</span>
					<span class="category-count">{layers.length}</span>
				</button>

				{#if expanded[category]}
					<ul class="layer-list">
						{#each layers as layer (layer.id)}
							{@const active = activeLayers.isActive(layer.id)}
							{@const infoOpen = openInfoId === layer.id}
							<li class="layer-item" class:active>
								<div class="layer-row">
									<!-- Toggle active -->
									<button
										class="layer-toggle"
										onclick={() => activeLayers.toggle(layer)}
										title={active ? 'Remove layer' : 'Add layer'}
									>
										<span class="layer-check" aria-hidden="true">
											{#if active}<span class="check-mark">✓</span>{/if}
										</span>
										<span class="layer-name">{layer.name}</span>
									</button>

									<!-- Info toggle -->
									<button
										class="info-btn"
										class:info-open={infoOpen}
										onclick={() => toggleInfo(layer.id)}
										title={infoOpen ? 'Hide info' : 'Show info'}
										aria-label="Layer info"
									>ℹ</button>
								</div>

								<!-- Info panel (accordion) -->
								{#if infoOpen}
									<div class="info-panel">
										{#if layer.description}
											<p class="info-desc">{layer.description}</p>
										{/if}
										<span class="info-source">
											<strong>Source:</strong>
											{#if layer.source.startsWith('http')}
												<a href={layer.source} target="_blank" rel="noopener">{layer.source}</a>
											{:else}
												{layer.source}
											{/if}
										</span>
										{#if layer.link}
											<span class="info-source">
												<strong>Link:</strong>
												<a href={layer.link} target="_blank" rel="noopener">{layer.link}</a>
											</span>
										{/if}
										<span class="info-type">
											<strong>Type:</strong> {layer.type}
										</span>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/each}

		{#if filteredGroups.size === 0}
			<p class="no-results">No layers match "{searchQuery}"</p>
		{/if}
	</div>

	<!-- ── Footer ── -->
	<div class="catalogue-footer">
		<p class="catalogue-sub">
			Check also the MPA Europe SDMs on
			<a href="https://shiny.obis.org/distmaps/" target="_blank" rel="noopener">the map explorer</a>.
		</p>
	</div>
</aside>

<style>
	.catalogue {
		width: 340px;
		flex-shrink: 0;
		background: #f6f6f6;
		border-right: 1px solid #d8d8d8;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		overflow-x: hidden;
	}

	/* ── Header ── */
	.catalogue-header {
		padding: 1rem 1rem 0.75rem;
		border-bottom: 1px solid #d8d8d8;
		flex-shrink: 0;
	}
	.catalogue-header h1 {
		justify-self: center;
	}
	.catalogue-explanation {
		padding: 1rem 1rem 0.75rem;
		border-bottom: 1px solid #d8d8d8;
		background-color: white;
		flex-shrink: 0;
	}
	.catalogue-explanation p {
		color: black;
		padding-top: 0.15rem;
		font-size: 0.8rem;
	}
	.logo {
		max-width: 100%;
		display: block;
		margin-bottom: 0.6rem;
	}
	.catalogue-title {
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #006cd7;
		margin: 0 0 0.4rem;
	}
	.catalogue-sub {
		font-size: 0.68rem;
		color: #64748b;
		margin: 0 0 0.25rem;
		line-height: 1.45;
	}
	.catalogue-sub a { color: #006cd7; text-decoration: none; }
	.catalogue-sub a:hover { text-decoration: underline; }

	/* ── Search ── */
	.search-wrap {
		position: relative;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid #d8d8d8;
		flex-shrink: 0;
	}
	.search-icon {
		position: absolute;
		left: 1.1rem;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.95rem;
		color: #94a3b8;
		pointer-events: none;
	}
	.search-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.3rem 0.5rem 0.3rem 1.6rem;
		border: 1px solid #d8d8d8;
		border-radius: 5px;
		background: #ffffff;
		font-size: 0.78rem;
		color: #1e293b;
		outline: none;
		appearance: none;
	}
	.search-input:focus { border-color: #006cd7; }
	.search-input::placeholder { color: #94a3b8; }

	/* ── Body ── */
	.catalogue-body {
		padding: 0.25rem 0;
	}

	/* ── Category ── */
	.category { margin-bottom: 0.1rem; }

	.category-header {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		background: none;
		border: none;
		cursor: pointer;
		color: #006cd7;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		text-align: left;
		user-select: none;
	}
	.category-header:hover { color: #0080ff; }

	.chevron {
		font-size: 1rem;
		line-height: 1;
		transition: transform 0.15s;
		transform: rotate(0deg);
		flex-shrink: 0;
	}
	.chevron.open { transform: rotate(90deg); }

	.category-name { flex: 1; }

	.category-count {
		background: #94a3b8;
		color: #ffffff;
		font-size: 0.6rem;
		padding: 0.05rem 0.35rem;
		border-radius: 999px;
		flex-shrink: 0;
	}

	/* ── Layer list ── */
	.layer-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.layer-item {
		border-left: 2px solid transparent;
		transition: border-color 0.12s;
	}
	.layer-item.active {
		border-left-color: #006cd7;
	}

	.layer-row {
		display: flex;
		align-items: flex-start;
		gap: 0;
	}

	/* ── Layer toggle button ── */
	.layer-toggle {
		flex: 1;
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		padding: 0.42rem 0.5rem 0.42rem 0.6rem;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		min-width: 0;
	}
	.layer-toggle:hover { background: #e8edf3; }

	.layer-check {
		width: 1.1rem;
		height: 1.1rem;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1.5px solid #c2cdd9;
		border-radius: 3px;
		background: #fff;
		transition: background 0.1s, border-color 0.1s;
	}
	.layer-item.active .layer-check {
		background: #006cd7;
		border-color: #006cd7;
	}
	.check-mark {
		font-size: 0.65rem;
		color: #ffffff;
		font-weight: 700;
	}

	.layer-name {
		flex: 1;
		font-size: 0.8rem;
		color: #1e293b;
		word-break: break-word;
	}
	.layer-item.active .layer-name { font-weight: 600; }

	/* ── Info button ── */
	.info-btn {
		flex-shrink: 0;
		width: 1.7rem;
		height: 1.7rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.8rem;
		color: #94a3b8;
		border-radius: 4px;
		margin-right: 0.25rem;
		transition: background 0.1s, color 0.1s;
	}
	.info-btn:hover  { background: #e2e8f0; color: #006cd7; }
	.info-btn.info-open { background: #dbeafe; color: #006cd7; }

	/* ── Info panel ── */
	.info-panel {
		padding: 0.5rem 0.75rem 0.6rem 1.85rem;
		background: #eef2f7;
		border-top: 1px solid #d8d8d8;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.info-desc {
		font-size: 0.72rem;
		color: #334155;
		margin: 0;
		line-height: 1.45;
	}
	.info-source,
	.info-type {
		font-size: 0.68rem;
		color: #64748b;
	}
	.info-source a { color: #006cd7; text-decoration: none; }
	.info-source a:hover { text-decoration: underline; }

	/* ── No results ── */
	.no-results {
		font-size: 0.75rem;
		color: #94a3b8;
		padding: 1rem;
		text-align: center;
		margin: 0;
	}

	/* ── Footer ── */
	.catalogue-footer {
		padding: 0.65rem 1rem;
		border-top: 1px solid #d8d8d8;
		flex-shrink: 0;
	}
</style>
