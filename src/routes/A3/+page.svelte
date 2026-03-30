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
	};

	/** Static data: `static/running-races.csv` is served at site root. */
	const csvUrl = "/annotated-running-races.csv";

	let allRows: RaceRow[] = $state([]);
	let selectedAthlete = $state("");
	let loadError = $state<string | null>(null);

	const parseTime = d3.timeParse("%d/%m/%Y %H:%M");

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
				} satisfies RaceRow;
			});
			allRows = (raw as RaceRow[]).filter(
				(d) =>
					d &&
					!Number.isNaN(d.timestamp.getTime()) &&
					!Number.isNaN(d.speedKmh) &&
					!Number.isNaN(d.avgHeartRate),
			);
			const ids = [...new Set(allRows.map((r) => r.athlete))].sort();
			if (ids.length && !selectedAthlete) selectedAthlete = ids[0]!;
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

	const athleteRows = $derived(
		allRows
			.filter((r) => r.athlete === selectedAthlete)
			.sort((a, b) => +a.timestamp - +b.timestamp),
	);

	// —— Chart layout ——
	const W = 920;
	const H = 380;
	const margin = { top: 28, right: 120, bottom: 52, left: 56 };

	function linearRegression(points: { x: number; y: number }[]) {
		const n = points.length;
		if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
		let sx = 0,
			sy = 0,
			sxy = 0,
			sxx = 0;
		for (const p of points) {
			sx += p.x;
			sy += p.y;
			sxy += p.x * p.y;
			sxx += p.x * p.x;
		}
		const denom = n * sxx - sx * sx;
		if (denom === 0) return { slope: 0, intercept: sy / n };
		const slope = (n * sxy - sx * sy) / denom;
		const intercept = (sy - slope * sx) / n;
		return { slope, intercept };
	}

	// Graph 1: time × speed, color = HR
	const g1 = $derived.by(() => {
		const rows = athleteRows;
		const innerW = W - margin.left - margin.right;
		const innerH = H - margin.top - margin.bottom;
		if (!rows.length) {
			return {
				circles: [] as {
					cx: number;
					cy: number;
					r: number;
					fill: string;
					title: string;
				}[],
				xScale: null as d3.ScaleTime<number, number> | null,
				yScale: null as d3.ScaleLinear<number, number> | null,
				color: null as d3.ScaleSequential<string> | null,
				legendStops: [] as { offset: string; color: string }[],
				hrExtent: null as [number, number] | null,
			};
		}
		const xScale = d3
			.scaleTime()
			.domain(d3.extent(rows, (d) => d.timestamp) as [Date, Date])
			.range([margin.left, margin.left + innerW])
			.nice();
		const yScale = d3
			.scaleLinear()
			.domain(d3.extent(rows, (d) => d.speedKmh) as [number, number])
			.range([margin.top + innerH, margin.top])
			.nice();
		let hrExtent = d3.extent(rows, (d) => d.avgHeartRate) as [number, number];
		if (hrExtent[0] === hrExtent[1]) {
			hrExtent = [hrExtent[0]! - 1, hrExtent[1]! + 1];
		}
		const color = d3.scaleSequential(d3.interpolatePlasma).domain(hrExtent);
		const circles = rows.map((d) => ({
			cx: xScale(d.timestamp)!,
			cy: yScale(d.speedKmh)!,
			r: 5,
			fill: color(d.avgHeartRate),
			title: `${d3.timeFormat("%d %b %Y %H:%M")(d.timestamp)} — ${d.speedKmh.toFixed(2)} km/h, HR ${d.avgHeartRate.toFixed(0)}`,
		}));
		const legendStops = d3.range(0, 1.01, 0.1).map((t) => ({
			offset: `${t * 100}%`,
			color: color(hrExtent[0]! + t * (hrExtent[1]! - hrExtent[0]!)),
		}));
		return { circles, xScale, yScale, color, legendStops, hrExtent };
	});

	// Graph 2: run order vs efficiency + trend
	const g2 = $derived.by(() => {
		const rows = athleteRows;
		const innerW = W - margin.left - margin.right;
		const innerH = H - margin.top - margin.bottom;
		if (!rows.length) {
			return {
				points: [] as { cx: number; cy: number; title: string }[],
				line: null as string | null,
				xScale: null as d3.ScaleLinear<number, number> | null,
				yScale: null as d3.ScaleLinear<number, number> | null,
			};
		}
		const indexed = rows.map((d, i) => ({ ...d, runIndex: i + 1 }));
		const xScale = d3
			.scaleLinear()
			.domain([1, indexed.length])
			.range([margin.left, margin.left + innerW])
			.nice();
		const yScale = d3
			.scaleLinear()
			.domain(d3.extent(rows, (d) => d.efficiency) as [number, number])
			.range([margin.top + innerH, margin.top])
			.nice();
		const reg = linearRegression(
			indexed.map((d) => ({ x: d.runIndex, y: d.efficiency })),
		);
		const x1 = 1,
			x2 = indexed.length;
		const y1 = reg.slope * x1 + reg.intercept;
		const y2 = reg.slope * x2 + reg.intercept;
		let line: string | null = null;
		if (Number.isFinite(y1) && Number.isFinite(y2)) {
			line = `M${xScale(x1)},${yScale(y1)}L${xScale(x2)},${yScale(y2)}`;
		}
		const points = indexed.map((d) => ({
			cx: xScale(d.runIndex)!,
			cy: yScale(d.efficiency)!,
			title: `Run #${d.runIndex} — efficiency ${d.efficiency.toFixed(4)}`,
		}));
		return { points, line, xScale, yScale, reg };
	});

	// Graph 3: distance vs elapsed time, radius ∝ speed (pace story)
	const g3 = $derived.by(() => {
		const rows = athleteRows;
		const innerW = W - margin.left - margin.right;
		const innerH = H - margin.top - margin.bottom;
		if (!rows.length) {
			return {
				circles: [] as {
					cx: number;
					cy: number;
					r: number;
					fill: string;
					title: string;
				}[],
				xScale: null as d3.ScaleLinear<number, number> | null,
				yScale: null as d3.ScaleLinear<number, number> | null,
			};
		}
		const xScale = d3
			.scaleLinear()
			.domain(d3.extent(rows, (d) => d.distanceM) as [number, number])
			.range([margin.left, margin.left + innerW])
			.nice();
		const yScale = d3
			.scaleLinear()
			.domain(d3.extent(rows, (d) => d.elapsedS) as [number, number])
			.range([margin.top + innerH, margin.top])
			.nice();
		const rScale = d3
			.scaleSqrt()
			.domain(d3.extent(rows, (d) => d.speedKmh) as [number, number])
			.range([4, 18]);
		const effExtent = d3.extent(rows, (d) => d.efficiency) as [
			number,
			number,
		];
		const fillScale = d3
			.scaleSequential(d3.interpolateViridis)
			.domain(effExtent.slice().reverse() as [number, number]);
		const circles = rows.map((d) => ({
			cx: xScale(d.distanceM)!,
			cy: yScale(d.elapsedS)!,
			r: rScale(d.speedKmh)!,
			fill: fillScale(d.efficiency),
			title: `${(d.distanceM / 1000).toFixed(2)} km, ${Math.round(d.elapsedS / 60)} min — speed ${d.speedKmh.toFixed(1)} km/h`,
		}));
		return { circles, xScale, yScale };
	});

	let axis1x: SVGGElement | undefined = $state();
	let axis1y: SVGGElement | undefined = $state();
	let axis2x: SVGGElement | undefined = $state();
	let axis2y: SVGGElement | undefined = $state();
	let axis3x: SVGGElement | undefined = $state();
	let axis3y: SVGGElement | undefined = $state();

	$effect(() => {
		if (axis1x && g1.xScale)
			d3.select(axis1x).call(d3.axisBottom(g1.xScale).ticks(6));
		if (axis1y && g1.yScale)
			d3.select(axis1y).call(d3.axisLeft(g1.yScale).ticks(6));
	});
	$effect(() => {
		if (axis2x && g2.xScale)
			d3.select(axis2x).call(d3.axisBottom(g2.xScale).ticks(8));
		if (axis2y && g2.yScale)
			d3.select(axis2y).call(d3.axisLeft(g2.yScale).ticks(6));
	});
	$effect(() => {
		if (axis3x && g3.xScale)
			d3.select(axis3x).call(
				d3.axisBottom(g3.xScale).tickFormat((v) => `${Number(v) / 1000}k`),
			);
		if (axis3y && g3.yScale)
			d3.select(axis3y).call(
				d3.axisLeft(g3.yScale).tickFormat((v) => `${Math.round(Number(v) / 60)}m`),
			);
	});
</script>

<svelte:head>
	<title>Project 1 — Running races</title>
</svelte:head>

<main class="wrap">
	<h1>Running races — exploratory views</h1>
	<p class="lead">
		Data from <code>static/running-races.csv</code> (loaded as
		<code>{csvUrl}</code>). Pick an athlete to compare sessions.
	</p>

	{#if loadError}
		<p class="err">Could not load CSV: {loadError}</p>
	{:else if !allRows.length}
		<p>Loading data…</p>
	{:else}
		<label class="picker">
			<span>Athlete ID</span>
			<select bind:value={selectedAthlete}>
				{#each athleteIds as id}
					<option value={id}>{id}</option>
				{/each}
			</select>
			<span class="meta">{athleteRows.length} runs</span>
		</label>

		<section class="chart-block">
			<h2>Speed over time, colored by average heart rate</h2>
			<p class="caption">
				Each dot is one run: vertical position is speed (km/h), horizontal
				position is when the run happened. Color encodes average heart rate
				(bpm) on the scale at right.
                Speed (km/hour) = distance (m)/ elapsed time (s) 
			</p>
			<svg width={W} height={H} class="chart">
				<defs>
					<linearGradient id="hr-legend" x1="0%" y1="0%" x2="0%" y2="100%">
						{#each g1.legendStops as s}
							<stop offset={s.offset} stop-color={s.color} />
						{/each}
					</linearGradient>
				</defs>
				{#each g1.circles as c}
					<circle cx={c.cx} cy={c.cy} r={c.r} fill={c.fill} stroke="#1a1a1a" stroke-width="0.35" opacity="0.92">
						<title>{c.title}</title>
					</circle>
				{/each}
				<g
					transform="translate(0,{margin.top + (H - margin.top - margin.bottom)})"
					bind:this={axis1x}
				/>
				<g transform="translate({margin.left},0)" bind:this={axis1y} />
				<text
					class="axis-label"
					x={margin.left + (W - margin.left - margin.right) / 2}
					y={H - 12}
					text-anchor="middle"
				>
					Date
				</text>
				<text
					class="axis-label"
					transform="rotate(-90)"
					x={-(margin.top + (H - margin.top - margin.bottom) / 2)}
					y="18"
					text-anchor="middle"
				>
					Speed (km/h)
				</text>
				{#if g1.hrExtent}
					<rect
						x={W - margin.right + 12}
						y={margin.top}
						width="14"
						height={H - margin.top - margin.bottom}
						fill="url(#hr-legend)"
						stroke="#333"
						stroke-width="0.5"
					/>
					<text
						class="legend-cap"
						x={W - margin.right + 19}
						y={margin.top - 8}
						text-anchor="middle"
					>
						HR (bpm)
					</text>
					<text
						class="legend-tick"
						x={W - margin.right + 32}
						y={margin.top + 6}
					>
						{g1.hrExtent[1]!.toFixed(0)}
					</text>
					<text
						class="legend-tick"
						x={W - margin.right + 32}
						y={H - margin.bottom - 4}
					>
						{g1.hrExtent[0]!.toFixed(0)}
					</text>
				{/if}
			</svg>
		</section>

		<section class="chart-block">
			<h2>Efficiency vs cumulative running (chronological order)</h2>
			<p class="caption">
				Runs are ordered from oldest (left) to newest (right). The line is an
				ordinary least squares fit: upward slope suggests higher efficiency on
				later runs in this window; flat or noisy patterns invite a story about
				consistency, training blocks, or external factors.
                Efficiency = speed (km/hour) / average heart rate (bpm).
			</p>
			<svg width={W} height={H} class="chart">
				{#if g2.line}
					<path
						d={g2.line}
						fill="none"
						stroke="#c43"
						stroke-width="2"
						stroke-dasharray="6 4"
						opacity="0.9"
					/>
				{/if}
				{#each g2.points as p}
					<circle
						cx={p.cx}
						cy={p.cy}
						r="4.5"
						fill="steelblue"
						stroke="#124"
						stroke-width="0.4"
						opacity="0.85"
					>
						<title>{p.title}</title>
					</circle>
				{/each}
				<g
					transform="translate(0,{margin.top + (H - margin.top - margin.bottom)})"
					bind:this={axis2x}
				/>
				<g transform="translate({margin.left},0)" bind:this={axis2y} />
				<text
					class="axis-label"
					x={margin.left + (W - margin.left - margin.right) / 2}
					y={H - 12}
					text-anchor="middle"
				>
					Run number (1 = earliest in data)
				</text>
				<text
					class="axis-label"
					transform="rotate(-90)"
					x={-(margin.top + (H - margin.top - margin.bottom) / 2)}
					y="18"
					text-anchor="middle"
				>
					Efficiency
				</text>
			</svg>
		</section>

		<section class="chart-block">
			<h2>Distance vs duration, sized by speed, colored by efficiency</h2>
			<p class="caption">
				Longer runs usually take more time; bubble size highlights faster
				sessions (higher km/h). Color (viridis) encodes efficiency so you can
				see whether “big” days align with better or worse efficiency.
			</p>
			<svg width={W} height={H} class="chart">
				{#each g3.circles as c}
					<circle
						cx={c.cx}
						cy={c.cy}
						r={c.r}
						fill={c.fill}
						stroke="#111"
						stroke-width="0.35"
						opacity="0.88"
					>
						<title>{c.title}</title>
					</circle>
				{/each}
				<g
					transform="translate(0,{margin.top + (H - margin.top - margin.bottom)})"
					bind:this={axis3x}
				/>
				<g transform="translate({margin.left},0)" bind:this={axis3y} />
				<text
					class="axis-label"
					x={margin.left + (W - margin.left - margin.right) / 2}
					y={H - 12}
					text-anchor="middle"
				>
					Distance (m, ticks in km)
				</text>
				<text
					class="axis-label"
					transform="rotate(-90)"
					x={-(margin.top + (H - margin.top - margin.bottom) / 2)}
					y="18"
					text-anchor="middle"
				>
					Elapsed time (ticks in minutes)
				</text>
			</svg>
		</section>
	{/if}
</main>

<style>
	.wrap {
		max-width: 960px;
		margin: 0 auto;
		padding: 1.25rem 1rem 2.5rem;
		font-family:
			system-ui,
			"Segoe UI",
			sans-serif;
		color: #1e1e1e;
	}
	h1 {
		font-size: 1.5rem;
		font-weight: 650;
		margin-bottom: 0.35rem;
	}
	h2 {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0 0 0.35rem;
	}
	.lead {
		color: #444;
		margin: 0 0 1rem;
		line-height: 1.45;
	}
	.caption {
		font-size: 0.9rem;
		color: #555;
		line-height: 1.45;
		margin: 0 0 0.6rem;
	}
	.chart-block {
		margin-top: 1.75rem;
	}
	.chart {
		display: block;
		background: #fafafa;
		border: 1px solid #ddd;
		border-radius: 6px;
	}
	.picker {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}
	.picker span:first-child {
		font-weight: 600;
	}
	select {
		padding: 0.35rem 0.6rem;
		font-size: 1rem;
		border-radius: 6px;
		border: 1px solid #bbb;
		background: #fff;
	}
	.meta {
		color: #666;
		font-size: 0.9rem;
	}
	.err {
		color: #a30;
	}
	:global(.chart .tick line) {
		stroke: #ccc;
	}
	:global(.chart .domain) {
		stroke: #888;
	}
	.axis-label {
		font-size: 12px;
		fill: #333;
	}
	.legend-cap {
		font-size: 11px;
		fill: #333;
	}
	.legend-tick {
		font-size: 10px;
		fill: #444;
	}
</style>