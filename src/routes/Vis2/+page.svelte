<script lang="ts">
	import * as d3 from "d3";
	import { onMount } from "svelte";

	type RaceRow = {
		athlete: string;
		gender: string;
		timestamp: Date;
		distanceM: number;
		elapsedS: number;
		elevationGainM: number;
		avgHeartRate: number;
		speedKmh: number;
		climbEfficiency: number;
		efficiency: number;
		percentileAvgRunsWeek: number;
		avgRunsPerWeek: number;
	};

	const csvUrl = "/annotated-running-races.csv";

	let allRows: RaceRow[] = $state([]);
	let selectedAthlete = $state("");
	let yMode = $state<"speed" | "efficiency">("speed");
	let xMax = $state(500);          // slider: show runs 1 … xMax
	let loadError = $state<string | null>(null);

	// Interaction state
	let hoveredRunIdx = $state<number | null>(null);
	let pinnedRunIdx = $state<number | null>(null);
	let svgEl: SVGSVGElement | undefined = $state();

	// Support both ISO and d/m/Y timestamp formats
	const timeParsers = [
		d3.timeParse("%Y-%m-%d %H:%M:%S"),
		d3.timeParse("%d/%m/%Y %H:%M"),
	];
	function parseTime(s: string): Date | null {
		for (const p of timeParsers) {
			const t = p(s);
			if (t) return t;
		}
		return null;
	}

	async function loadCsv() {
		try {
			const raw = await d3.csv(csvUrl, (row) => {
				const t = parseTime(row.timestamp ?? "");
				if (!t || !row.athlete) return null;
				return {
					athlete: row.athlete,
					gender: row.gender ?? "",
					timestamp: t,
					distanceM: Number(row["distance (m)"]),
					elapsedS: Number(row["elapsed time (s)"]),
					elevationGainM: Number(row["elevation gain (m)"]),
					avgHeartRate: Number(row["average heart rate (bpm)"]),
					speedKmh: Number(row["speed (km/hour)"]),
					climbEfficiency: Number(row["climb efficiency"]),
					efficiency: Number(row["efficiency"]),
					percentileAvgRunsWeek: Number(row["percentile_avg_runs_week"]),
					avgRunsPerWeek: Number(row["avg_runs_per_week"]),
				} satisfies RaceRow;
			});
			allRows = (raw as RaceRow[]).filter(
				(d) =>
					d &&
					!Number.isNaN(d.timestamp.getTime()) &&
					!Number.isNaN(d.speedKmh) &&
					!Number.isNaN(d.efficiency) &&
					!Number.isNaN(d.percentileAvgRunsWeek),
			);
		} catch (e) {
			loadError = e instanceof Error ? e.message : String(e);
		}
	}

	onMount(loadCsv);

	const athleteIds = $derived(
		[...new Set(allRows.map((r) => r.athlete))].sort((a, b) =>
			a.localeCompare(b, undefined, { numeric: true }),
		),
	);

	// ── Percentile grouping ────────────────────────────────────────────────────
	type Group = "low" | "medium" | "high";

	function getGroup(p: number): Group {
		if (p < 0.33) return "low";
		if (p < 0.67) return "medium";
		return "high";
	}

	const GROUP_COLORS: Record<Group, string> = {
		low: "#4e90d9",
		medium: "#2ec495",
		high: "#f05a5a",
	};
	const GROUP_LABELS: Record<Group, string> = {
		low: "10th pct (Low)",
		medium: "50th pct (Medium)",
		high: "90th pct (High)",
	};
	const GROUPS: Group[] = ["low", "medium", "high"];

	// ── Chart geometry ─────────────────────────────────────────────────────────
	const W = 940;
	const H = 430;
	const margin = { top: 32, right: 192, bottom: 58, left: 66 };
	const innerW = W - margin.left - margin.right;
	const innerH = H - margin.top - margin.bottom;

	function linearRegression(pts: { x: number; y: number }[]) {
		const n = pts.length;
		if (n < 2) return null;
		let sx = 0, sy = 0, sxy = 0, sxx = 0;
		for (const p of pts) {
			sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x;
		}
		const denom = n * sxx - sx * sx;
		if (denom === 0) return null;
		const slope = (n * sxy - sx * sy) / denom;
		return { slope, intercept: (sy - slope * sx) / n };
	}

	// ── All entries (hard cap at run 500) ─────────────────────────────────────
	type Entry = { runIndex: number; yVal: number; group: Group; athlete: string };

	const allEntries = $derived.by((): Entry[] => {
		if (!allRows.length) return [];
		const entries: Entry[] = [];
		for (const [athlete, rows] of d3.group(allRows, (d) => d.athlete)) {
			rows
				.slice()
				.sort((a, b) => +a.timestamp - +b.timestamp)
				.forEach((row, i) => {
					if (i + 1 > 500) return; // hard cap — never exceed 500
					entries.push({
						runIndex: i + 1,
						yVal: yMode === "speed" ? row.speedKmh : row.efficiency,
						group: getGroup(row.percentileAvgRunsWeek),
						athlete,
					});
				});
		}
		return entries;
	});

	// ── Per-(group, runIndex) average lookup — used by chart AND tooltip ───────
	const groupRunAvgMap = $derived.by((): Record<Group, Map<number, { avg: number; n: number }>> => {
		const map: Record<Group, Map<number, { avg: number; n: number }>> = {
			low: new Map(), medium: new Map(), high: new Map(),
		};
		const display = selectedAthlete
			? allEntries.filter((e) => e.athlete === selectedAthlete)
			: allEntries;
		for (const g of GROUPS) {
			const byRun = d3.group(display.filter((e) => e.group === g), (e) => e.runIndex);
			for (const [runIdx, vals] of byRun) {
				map[g].set(runIdx, { avg: d3.mean(vals, (v) => v.yVal)!, n: vals.length });
			}
		}
		return map;
	});

	// ── Main chart derived ─────────────────────────────────────────────────────
	type CircleDatum = {
		cx: number; cy: number; fill: string; group: Group; runIndex: number; title: string;
	};
	type LineDatum = { d: string; color: string; group: Group };

	const chartData = $derived.by((): {
		circles: CircleDatum[];
		lines: LineDatum[];
		xScale: d3.ScaleLinear<number, number> | null;
		yScale: d3.ScaleLinear<number, number> | null;
	} => {
		if (!allRows.length)
			return { circles: [], lines: [], xScale: null, yScale: null };

		// X domain driven by slider, hard cap 500
		const xDomainMax = Math.min(xMax, 500);
		const xScale = d3
			.scaleLinear()
			.domain([1, xDomainMax])
			.range([margin.left, margin.left + innerW]);

		const display = selectedAthlete
			? allEntries.filter((e) => e.athlete === selectedAthlete)
			: allEntries;

		// Only show entries within the slider window (already capped at 500 by allEntries)
		const visible = display.filter((e) => e.runIndex >= 1 && e.runIndex <= xDomainMax);

		const circles: CircleDatum[] = [];
		const lines: LineDatum[] = [];

		if (selectedAthlete) {
			// Individual dots for a specific athlete
			if (!visible.length) return { circles, lines, xScale, yScale: null };

			const yExt = d3.extent(visible, (e) => e.yVal) as [number, number];
			const yScale = d3.scaleLinear().domain(yExt).range([margin.top + innerH, margin.top]).nice();

			for (const e of visible) {
				circles.push({
					cx: xScale(e.runIndex),
					cy: yScale(e.yVal),
					fill: GROUP_COLORS[e.group],
					group: e.group,
					runIndex: e.runIndex,
					title: `Run #${e.runIndex} — ${
						yMode === "speed" ? `${e.yVal.toFixed(2)} km/h` : `efficiency ${e.yVal.toFixed(4)}`
					} · ${GROUP_LABELS[e.group]}`,
				});
			}

			for (const g of GROUPS) {
				const pts = visible
					.filter((e) => e.group === g)
					.map((e) => ({ x: e.runIndex, y: e.yVal }));
				if (pts.length < 2) continue;
				const reg = linearRegression(pts);
				if (!reg) continue;
				const xs = pts.map((p) => p.x);
				const x1 = Math.min(...xs), x2 = Math.max(...xs);
				lines.push({
					d: `M${xScale(x1)},${yScale(reg.slope * x1 + reg.intercept)}L${xScale(x2)},${yScale(reg.slope * x2 + reg.intercept)}`,
					color: GROUP_COLORS[g],
					group: g,
				});
			}

			return { circles, lines, xScale, yScale };
		} else {
			// Average dots for all athletes
			const avgPtsByGroup: Record<Group, { x: number; y: number; n: number }[]> = {
				low: [], medium: [], high: [],
			};
			const allAvgVals: number[] = [];

			for (const g of GROUPS) {
				const byRun = d3.group(visible.filter((e) => e.group === g), (e) => e.runIndex);
				for (const [runIdx, vals] of byRun) {
					const avg = d3.mean(vals, (v) => v.yVal)!;
					avgPtsByGroup[g].push({ x: runIdx, y: avg, n: vals.length });
					allAvgVals.push(avg);
				}
			}

			if (!allAvgVals.length) return { circles, lines, xScale, yScale: null };

			const yExt = d3.extent(allAvgVals) as [number, number];
			const yScale = d3.scaleLinear().domain(yExt).range([margin.top + innerH, margin.top]).nice();

			for (const g of GROUPS) {
				for (const pt of avgPtsByGroup[g]) {
					circles.push({
						cx: xScale(pt.x),
						cy: yScale(pt.y),
						fill: GROUP_COLORS[g],
						group: g,
						runIndex: pt.x,
						title: `Run #${pt.x} · avg ${
							yMode === "speed" ? `${pt.y.toFixed(2)} km/h` : `efficiency ${pt.y.toFixed(4)}`
						} · ${GROUP_LABELS[g]} · n=${pt.n}`,
					});
				}
				const reg = linearRegression(avgPtsByGroup[g].map((p) => ({ x: p.x, y: p.y })));
				if (!reg || avgPtsByGroup[g].length < 2) continue;
				const xs = avgPtsByGroup[g].map((p) => p.x);
				const x1 = Math.min(...xs), x2 = Math.max(...xs);
				lines.push({
					d: `M${xScale(x1)},${yScale(reg.slope * x1 + reg.intercept)}L${xScale(x2)},${yScale(reg.slope * x2 + reg.intercept)}`,
					color: GROUP_COLORS[g],
					group: g,
				});
			}

			return { circles, lines, xScale, yScale };
		}
	});

	// ── Axis effects ──────────────────────────────────────────────────────────
	let axisX: SVGGElement | undefined = $state();
	let axisY: SVGGElement | undefined = $state();

	$effect(() => {
		if (axisX && chartData.xScale)
			d3.select(axisX).call(d3.axisBottom(chartData.xScale).ticks(10));
		if (axisY && chartData.yScale)
			d3.select(axisY).call(d3.axisLeft(chartData.yScale).ticks(6));
	});

	// ── Mouse interaction ─────────────────────────────────────────────────────
	function svgMouseToRunIdx(clientX: number): number {
		if (!chartData.xScale || !svgEl) return 1;
		const rect = svgEl.getBoundingClientRect();
		const scaleX = W / rect.width; // account for CSS scaling
		const svgX = (clientX - rect.left) * scaleX;
		const raw = Math.round(chartData.xScale.invert(svgX));
		return Math.max(1, Math.min(Math.min(xMax, 500), raw));
	}

	function handleMouseMove(e: MouseEvent) {
		hoveredRunIdx = svgMouseToRunIdx(e.clientX);
	}

	function handleMouseLeave() {
		hoveredRunIdx = null;
	}

	function handleClick(e: MouseEvent) {
		const idx = svgMouseToRunIdx(e.clientX);
		pinnedRunIdx = pinnedRunIdx === idx ? null : idx;
	}

	// ── Active run for crosshair + tooltip ────────────────────────────────────
	const activeRunIdx = $derived(pinnedRunIdx ?? hoveredRunIdx);

	const crosshairX = $derived(
		activeRunIdx !== null && chartData.xScale
			? chartData.xScale(activeRunIdx)
			: null,
	);

	// Dots at each group's average Y for the active run
	const crosshairDots = $derived.by(() => {
		if (activeRunIdx === null || !chartData.xScale || !chartData.yScale) return [];
		return GROUPS.flatMap((g) => {
			const d = groupRunAvgMap[g].get(activeRunIdx);
			if (!d) return [];
			return [{
				cx: chartData.xScale!(activeRunIdx),
				cy: chartData.yScale!(d.avg),
				fill: GROUP_COLORS[g],
				group: g,
			}];
		});
	});

	// Tooltip card data
	const tooltipData = $derived.by(() => {
		if (activeRunIdx === null) return null;
		return {
			runIdx: activeRunIdx,
			rows: GROUPS.map((g) => ({
				group: g,
				label: GROUP_LABELS[g],
				color: GROUP_COLORS[g],
				entry: groupRunAvgMap[g].get(activeRunIdx) ?? null,
			})),
		};
	});

	// ── Misc helpers ──────────────────────────────────────────────────────────
	const runCount = $derived(
		selectedAthlete
			? allRows.filter((r) => r.athlete === selectedAthlete).length
			: allRows.length,
	);
	const yLabel = $derived(yMode === "speed" ? "Speed (km/h)" : "Efficiency");

	const LEGEND_X = W - margin.right + 16;
	const LEGEND_ROW_H = 36;
</script>

<svelte:head>
	<title>Running Race Analysis — Percentile Groups</title>
</svelte:head>

<main class="wrap">
	<h1>Running races — weekly training performance</h1>
	<p class="lead">
		Runners grouped by <strong>average runs per week</strong> percentile.
		X-axis tracks each athlete's cumulative run number .
		Toggle the Y-axis metric, adjust the run window, and hover or click to inspect values.
	</p>

	{#if loadError}
		<p class="err">Could not load CSV: {loadError}</p>
	{:else if !allRows.length}
		<p class="loading">Loading data…</p>
	{:else}
		<!-- ── Controls row ── -->
		<div class="controls">
			<label class="picker">
				<span class="label-text">Athlete</span>
				<select bind:value={selectedAthlete}>
					<option value="">All Athletes</option>
					{#each athleteIds as id}
						<option value={id}>{id}</option>
					{/each}
				</select>
				<span class="meta">{runCount} runs</span>
			</label>

			<div class="toggle-group" role="group" aria-label="Y-axis metric">
				<button
					class="toggle-btn"
					class:active={yMode === "speed"}
					onclick={() => { yMode = "speed"; pinnedRunIdx = null; }}
				>Speed (km/h)</button>
				<button
					class="toggle-btn"
					class:active={yMode === "efficiency"}
					onclick={() => { yMode = "efficiency"; pinnedRunIdx = null; }}
				>Efficiency</button>
			</div>
		</div>

		<!-- ── X-axis slider ── -->
		<div class="slider-row">
			<span class="slider-label">Show runs 1 –</span>
			<input
				type="range"
				class="slider"
				min="10"
				max="500"
				step="1"
				bind:value={xMax}
			/>
			<span class="slider-val">{xMax}</span>
		</div>

		<!-- ── Chart section ── -->
		<section class="chart-block">
			<h2>
				{yLabel} by cumulative run number
				<span class="h2-sub">
					{#if selectedAthlete}— Athlete {selectedAthlete}{:else}— All athletes, avg per percentile group{/if}
				</span>
			</h2>
			<p class="caption">
				{#if selectedAthlete}
					Individual runs for athlete {selectedAthlete}, coloured by weekly training load percentile.
				{:else}
					Each dot shows the mean {yMode === "speed" ? "speed" : "efficiency"} across all athletes
					at that run number within each percentile group.
				{/if}
				{yMode === "speed"
					? " Speed = distance (m) ÷ elapsed time (s) × 3.6."
					: " Efficiency = speed (km/h) ÷ avg heart rate (bpm)."}
				Hover to inspect · click to pin.
			</p>

			<div class="chart-and-panel">

				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<svg
					width={W}
					height={H}
					class="chart"
					aria-label="Scatter chart"
					bind:this={svgEl}
					onmousemove={handleMouseMove}
					onmouseleave={handleMouseLeave}
					onclick={handleClick}
				>
					<!-- Transparent cursor-capture rect over the plot area -->
					<rect
						x={margin.left} y={margin.top}
						width={innerW} height={innerH}
						fill="transparent"
					/>

					<!-- Horizontal grid lines -->
					{#if chartData.yScale}
						{#each chartData.yScale.ticks(6) as tick}
							<line
								x1={margin.left} x2={margin.left + innerW}
								y1={chartData.yScale(tick)} y2={chartData.yScale(tick)}
								stroke="#e8e8e8" stroke-width="1"
							/>
						{/each}
					{/if}

					<!-- Trend / best-fit lines (drawn below dots) -->
					{#each chartData.lines as l}
						<path
							d={l.d}
							fill="none"
							stroke={l.color}
							stroke-width="2"
							stroke-dasharray="7 4"
							opacity="0.85"
						/>
					{/each}

					<!-- Data dots — smaller radius -->
					{#each chartData.circles as c}
						<circle
							cx={c.cx} cy={c.cy}
							r="2.5"
							fill={c.fill}
							stroke="rgba(0,0,0,0.14)"
							stroke-width="0.4"
							opacity="0.72"
						>
							<title>{c.title}</title>
						</circle>
					{/each}

					<!-- ── Crosshair ── -->
					{#if crosshairX !== null && activeRunIdx !== null}
						<!-- Vertical rule -->
						<line
							x1={crosshairX} x2={crosshairX}
							y1={margin.top} y2={margin.top + innerH}
							stroke="#444" stroke-width="1" stroke-dasharray="4 3"
							pointer-events="none"
						/>

						<!-- Run-number label pill -->
						<rect
							x={crosshairX - 24} y={margin.top - 24}
							width="48" height="18" rx="4"
							fill={pinnedRunIdx !== null ? "#1a1a1a" : "#555"}
							pointer-events="none"
						/>
						<text
							x={crosshairX} y={margin.top - 10}
							text-anchor="middle"
							fill="#fff"
							font-size="10"
							font-family="system-ui, sans-serif"
							font-weight="600"
							pointer-events="none"
						>Run {activeRunIdx}</text>

						<!-- Intersection marker dots -->
						{#each crosshairDots as dot}
							<circle
								cx={dot.cx} cy={dot.cy}
								r="5.5"
								fill={dot.fill}
								stroke="#fff" stroke-width="2"
								pointer-events="none"
							/>
						{/each}

						<!-- Small pin icon when pinned -->
						{#if pinnedRunIdx !== null}
							<line
								x1={crosshairX} y1={margin.top - 28}
								x2={crosshairX} y2={margin.top - 6}
								stroke="#1a1a1a" stroke-width="1.5"
								pointer-events="none"
							/>
						{/if}
					{/if}

					<!-- D3 axes -->
					<g transform="translate(0,{margin.top + innerH})" bind:this={axisX} />
					<g transform="translate({margin.left},0)" bind:this={axisY} />

					<!-- Axis labels -->
					<text
						class="axis-label"
						x={margin.left + innerW / 2} y={H - 10}
						text-anchor="middle"
					>Run number (cumulative, 1 = first recorded run)</text>
					<text
						class="axis-label"
						transform="rotate(-90)"
						x={-(margin.top + innerH / 2)} y="16"
						text-anchor="middle"
					>{yLabel}</text>

					<!-- Legend (colour key) -->
					<text class="legend-heading" x={LEGEND_X} y={margin.top + 4}>Avg runs / week</text>
					{#each GROUPS as g, i}
						{@const ly = margin.top + 22 + i * LEGEND_ROW_H}
						<circle cx={LEGEND_X + 6} cy={ly + 5} r="4"
							fill={GROUP_COLORS[g]} stroke="rgba(0,0,0,0.12)" stroke-width="0.5" />
						<line
							x1={LEGEND_X + 14} y1={ly + 5} x2={LEGEND_X + 32} y2={ly + 5}
							stroke={GROUP_COLORS[g]} stroke-width="2" stroke-dasharray="5 3"
						/>
						<text class="legend-label" x={LEGEND_X + 38} y={ly + 9}>
							{GROUP_LABELS[g]}
						</text>
					{/each}
				</svg>

				<!-- ── Values panel ── -->
				<aside class="values-panel" class:visible={tooltipData !== null}>
					{#if tooltipData}
						<div class="vp-header">
							Run <strong>#{tooltipData.runIdx}</strong>
							{#if pinnedRunIdx !== null}
								<button class="unpin-btn" onclick={() => (pinnedRunIdx = null)}>✕ unpin</button>
							{/if}
						</div>

						<div class="vp-metric">{yLabel}</div>

						{#each tooltipData.rows as row}
							<div class="vp-row">
								<span class="vp-swatch" style="background:{row.color}"></span>
								<span class="vp-label">{row.label}</span>
								{#if row.entry}
									<span class="vp-value">
										{#if yMode === "speed"}
											{row.entry.avg.toFixed(2)}<small> km/h</small>
										{:else}
											{row.entry.avg.toFixed(4)}
										{/if}
									</span>
									<span class="vp-n">n = {row.entry.n}</span>
								{:else}
									<span class="vp-none" style="grid-column: 3/5">—</span>
								{/if}
							</div>
						{/each}

						<p class="vp-hint">
							{pinnedRunIdx !== null
								? "Pinned. Click chart to reposition or click again to unpin."
								: "Click to pin this run number."}
						</p>
					{:else}
						<p class="vp-idle">
							Hover over the chart to see the average value for each percentile group at that run number.
						</p>
					{/if}
				</aside>

			</div><!-- .chart-and-panel -->
		</section>
	{/if}
</main>


<style>
	.wrap {
		max-width: 1160px;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
		font-family: Georgia, "Times New Roman", serif;
		color: #1a1a1a;
	}

	/* ── Typography ── */
	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.4rem;
		letter-spacing: -0.02em;
	}

	h2 {
		font-size: 1.05rem;
		font-weight: 700;
		margin: 0 0 0.3rem;
		letter-spacing: -0.01em;
	}

	.h2-sub { font-size: 0.92rem; color: #555; }

	.lead, .caption {
		font-family: system-ui, "Segoe UI", sans-serif;
		color: #444;
		line-height: 1.55;
	}

	.lead { margin-bottom: 1rem; font-size: 0.92rem; }
	.caption { font-size: 0.84rem; margin-bottom: 0.6rem; }

	/* ── Controls ── */
	.controls, .slider-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		font-family: system-ui, "Segoe UI", sans-serif;
	}

	.controls { margin-bottom: 0.55rem; }
	.slider-row { margin-bottom: 0.7rem; font-size: 0.87rem; color: #444; }

	.picker {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.label-text { font-weight: 600; font-size: 0.87rem; }
	.meta { color: #777; font-size: 0.82rem; }

	select {
		padding: 0.3rem 0.6rem;
		font-size: 0.88rem;
		border-radius: 6px;
		border: 1px solid #bbb;
		background: #fff;
		cursor: pointer;
	}

	/* ── Toggle ── */
	.toggle-group {
		display: flex;
		border: 1px solid #ccc;
		border-radius: 7px;
		overflow: hidden;
	}

	.toggle-btn {
		padding: 0.33rem 0.8rem;
		font-size: 0.84rem;
		border: none;
		background: #f5f5f5;
		color: #555;
		cursor: pointer;
		border-right: 1px solid #ccc;
	}

	.toggle-btn:last-child { border-right: none; }
	.toggle-btn:hover { background: #e8e8e8; }
	.toggle-btn.active {
		background: #1a1a1a;
		color: #fff;
		font-weight: 600;
	}

	/* ── Slider ── */
	.slider { width: 320px; accent-color: #1a1a1a; cursor: pointer; }
	.slider-val { font-weight: 700; min-width: 32px; }

	/* ── Layout ── */
	.chart-and-panel {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}

	.chart {
		background: #fafafa;
		border: 1px solid #ddd;
		border-radius: 8px;
		cursor: crosshair;
	}

	/* ── SVG text ── */
	.axis-label,
	.legend-label,
	.legend-heading {
		font-family: system-ui, "Segoe UI", sans-serif;
	}

	.axis-label { font-size: 11.5px; fill: #444; }

	.legend-heading {
		font-size: 10px;
		fill: #888;
		text-transform: uppercase;
		font-weight: 600;
	}

	.legend-label { font-size: 11px; fill: #333; }

	/* ── Tooltip panel ── */
	.values-panel {
		width: 220px;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		background: #fff;
		padding: 0.8rem;
		font-family: system-ui, "Segoe UI", sans-serif;
		font-size: 0.83rem;
		box-shadow: 0 2px 10px rgba(0,0,0,0.06);
		opacity: 0;
		transition: opacity 0.13s;
	}

	.values-panel.visible { opacity: 1; }

	.vp-header {
		display: flex;
		justify-content: space-between;
		font-weight: 700;
		margin-bottom: 0.3rem;
	}

	.vp-metric {
		font-size: 0.73rem;
		color: #888;
		text-transform: uppercase;
		margin-bottom: 0.6rem;
	}

	.vp-row {
		display: grid;
		grid-template-columns: 10px 1fr auto auto;
		gap: 0.45rem;
		margin-bottom: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #f0f0f0;
	}

	.vp-row:last-of-type { border-bottom: none; }

	.vp-swatch {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.vp-value { font-weight: 700; }
	.vp-n { color: #aaa; font-size: 0.7rem; }

	.vp-hint, .vp-idle {
		color: #999;
		font-size: 0.75rem;
	}

	/* ── States ── */
	.err { color: #b03020; }
	.loading { color: #666; }

	/* ── D3 axes ── */
	:global(.chart .tick line) { stroke: #ccc; }
	:global(.chart .domain) { stroke: #999; }
	:global(.chart .tick text) {
		font-size: 11px;
		fill: #555;
	}


</style>