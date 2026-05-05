<script lang="ts">
  import Scroll from "$lib/Scroll.svelte";
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

  const csvUrl = "./annotated-running-races.csv";

  let allRows: RaceRow[] = $state([]);
  let selectedAthlete = $state("");
  let yMode = $state<"speed" | "efficiency">("speed");
  let xMax = $state(500);
  let loadError = $state<string | null>(null);
  let progress = $state(0);

  let hoveredRunIdx = $state<number | null>(null);
  let pinnedRunIdx = $state<number | null>(null);
  let svgEl: SVGSVGElement | undefined = $state();

  const timeParsers = [
    d3.timeParse("%Y-%m-%d %H:%M:%S"),
    d3.timeParse("%d/%m/%Y %H:%M"),
  ];
  function parseTime(s: string): Date | null {
    for (const p of timeParsers) { const t = p(s); if (t) return t; }
    return null;
  }
  function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
  function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

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
        d => d && !Number.isNaN(d.timestamp.getTime()) &&
             !Number.isNaN(d.speedKmh) && !Number.isNaN(d.efficiency) &&
             !Number.isNaN(d.percentileAvgRunsWeek)
      );
    } catch (e) { loadError = e instanceof Error ? e.message : String(e); }
  }

  onMount(loadCsv);

  type AthleteOption = { id: string; runCount: number; group: Group; avgRunsPerWeek: number };
  type Group = "low" | "medium" | "high";

  const athleteOptions = $derived(
    [...d3.group(allRows, r => r.athlete)]
      .map(([id, rows]): AthleteOption => {
        const avgPercentile = d3.mean(rows, r => r.percentileAvgRunsWeek) ?? 0;
        const avgRunsPerWeek = d3.mean(rows, r => r.avgRunsPerWeek) ?? 0;
        return { id, runCount: rows.length, group: getGroup(avgPercentile), avgRunsPerWeek };
      })
      .sort((a, b) => b.avgRunsPerWeek - a.avgRunsPerWeek)
  );

  function getGroup(p: number): Group {
    if (p < 0.33) return "low";
    if (p < 0.67) return "medium";
    return "high";
  }

  const GROUP_COLORS: Record<Group, string> = { low: "#4e90d9", medium: "#2ec495", high: "#f05a5a" };
  const GROUP_LABELS: Record<Group, string> = { low: "Low Volume", medium: "Medium Volume", high: "High Volume" };
  const GROUPS: Group[] = ["low", "medium", "high"];

  const GRAPH_WIDTH  = 500;
  const GRAPH_HEIGHT = 400;
  const margin = { top: 32, right: 10, bottom: 58, left: 60 };
  const innerW = GRAPH_WIDTH - margin.left - margin.right;
  const innerH = GRAPH_HEIGHT - margin.top - margin.bottom;

  function linearRegression(pts: { x: number; y: number }[]) {
    const n = pts.length;
    if (n < 2) return null;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (const p of pts) { sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x; }
    const denom = n * sxx - sx * sx;
    if (denom === 0) return null;
    const slope = (n * sxy - sx * sy) / denom;
    return { slope, intercept: (sy - slope * sx) / n };
  }

  type Entry = { runIndex: number; yVal: number; group: Group; athlete: string };

  const allEntries = $derived.by((): Entry[] => {
    if (!allRows.length) return [];
    const entries: Entry[] = [];
    for (const [athlete, rows] of d3.group(allRows, d => d.athlete)) {
      rows.slice().sort((a, b) => +a.timestamp - +b.timestamp).forEach((row, i) => {
        if (i + 1 > 500) return;
        entries.push({ runIndex: i + 1, yVal: yMode === "speed" ? row.speedKmh : row.efficiency, group: getGroup(row.percentileAvgRunsWeek), athlete });
      });
    }
    return entries;
  });

  const groupRunAvgMap = $derived.by((): Record<Group, Map<number, { avg: number; n: number }>> => {
    const map: Record<Group, Map<number, { avg: number; n: number }>> = { low: new Map(), medium: new Map(), high: new Map() };
    const display = selectedAthlete ? allEntries.filter(e => e.athlete === selectedAthlete) : allEntries;
    for (const g of GROUPS) {
      const byRun = d3.group(display.filter(e => e.group === g), e => e.runIndex);
      for (const [runIdx, vals] of byRun) {
        map[g].set(runIdx, { avg: d3.mean(vals, v => v.yVal)!, n: vals.length });
      }
    }
    return map;
  });

  type CircleDatum = { cx: number; cy: number; fill: string; group: Group; runIndex: number; title: string; };
  type LineDatum = { d: string; color: string; group: Group };

  const chartData = $derived.by((): { circles: CircleDatum[]; lines: LineDatum[]; xScale: d3.ScaleLinear<number,number>|null; yScale: d3.ScaleLinear<number,number>|null; } => {
    if (!allRows.length) return { circles: [], lines: [], xScale: null, yScale: null };
    const xDomainMax = Math.min(xMax, 500);
    const xScale = d3.scaleLinear().domain([1, xDomainMax]).range([margin.left, margin.left + innerW]);
    const display = selectedAthlete ? allEntries.filter(e => e.athlete === selectedAthlete) : allEntries;
    const visible = display.filter(e => e.runIndex >= 1 && e.runIndex <= xDomainMax);
    const circles: CircleDatum[] = [];
    const lines: LineDatum[] = [];

    if (selectedAthlete) {
      if (!visible.length) return { circles, lines, xScale, yScale: null };
      const yExt = d3.extent(visible, e => e.yVal) as [number, number];
      const yScale = d3.scaleLinear().domain(yExt).range([margin.top + innerH, margin.top]).nice();
      for (const e of visible) {
        circles.push({ cx: xScale(e.runIndex), cy: yScale(e.yVal), fill: GROUP_COLORS[e.group], group: e.group, runIndex: e.runIndex,
          title: `Run #${e.runIndex} — ${yMode === "speed" ? `${e.yVal.toFixed(2)} km/h` : `efficiency ${e.yVal.toFixed(4)}`} · ${GROUP_LABELS[e.group]}` });
      }
      for (const g of GROUPS) {
        const pts = visible.filter(e => e.group === g).map(e => ({ x: e.runIndex, y: e.yVal }));
        if (pts.length < 2) continue;
        const reg = linearRegression(pts);
        if (!reg) continue;
        const xs = pts.map(p => p.x), x1 = Math.min(...xs), x2 = Math.max(...xs);
        lines.push({ d: `M${xScale(x1)},${yScale(reg.slope*x1+reg.intercept)}L${xScale(x2)},${yScale(reg.slope*x2+reg.intercept)}`, color: GROUP_COLORS[g], group: g });
      }
      return { circles, lines, xScale, yScale };
    } else {
      const avgPtsByGroup: Record<Group, { x:number; y:number; n:number }[]> = { low:[], medium:[], high:[] };
      const allAvgVals: number[] = [];
      for (const g of GROUPS) {
        const byRun = d3.group(visible.filter(e => e.group === g), e => e.runIndex);
        for (const [runIdx, vals] of byRun) {
          const avg = d3.mean(vals, v => v.yVal)!;
          avgPtsByGroup[g].push({ x: runIdx, y: avg, n: vals.length });
          allAvgVals.push(avg);
        }
      }
      if (!allAvgVals.length) return { circles, lines, xScale, yScale: null };
      const yExt = d3.extent(allAvgVals) as [number, number];
      const yScale = d3.scaleLinear().domain(yExt).range([margin.top + innerH, margin.top]).nice();
      for (const g of GROUPS) {
        for (const pt of avgPtsByGroup[g]) {
          circles.push({ cx: xScale(pt.x), cy: yScale(pt.y), fill: GROUP_COLORS[g], group: g, runIndex: pt.x,
            title: `Run #${pt.x} · avg ${yMode === "speed" ? `${pt.y.toFixed(2)} km/h` : `efficiency ${pt.y.toFixed(4)}`} · ${GROUP_LABELS[g]} · n=${pt.n}` });
        }
        const reg = linearRegression(avgPtsByGroup[g].map(p => ({ x: p.x, y: p.y })));
        if (!reg || avgPtsByGroup[g].length < 2) continue;
        const xs = avgPtsByGroup[g].map(p => p.x), x1 = Math.min(...xs), x2 = Math.max(...xs);
        lines.push({ d: `M${xScale(x1)},${yScale(reg.slope*x1+reg.intercept)}L${xScale(x2)},${yScale(reg.slope*x2+reg.intercept)}`, color: GROUP_COLORS[g], group: g });
      }
      return { circles, lines, xScale, yScale };
    }
  });

  let axisX: SVGGElement | undefined = $state();
  let axisY: SVGGElement | undefined = $state();
  $effect(() => {
    if (axisX && chartData.xScale) d3.select(axisX).call(d3.axisBottom(chartData.xScale).ticks(10));
    if (axisY && chartData.yScale) d3.select(axisY).call(d3.axisLeft(chartData.yScale).ticks(6));
  });

  function svgMouseToRunIdx(clientX: number): number {
    if (!chartData.xScale || !svgEl) return 1;
    const rect = svgEl.getBoundingClientRect();
    const scaleX = GRAPH_WIDTH / rect.width;
    const raw = Math.round(chartData.xScale.invert((clientX - rect.left) * scaleX));
    return Math.max(1, Math.min(Math.min(xMax, 500), raw));
  }

  function handleMouseMove(e: MouseEvent) { hoveredRunIdx = svgMouseToRunIdx(e.clientX); }
  function handleMouseLeave() { hoveredRunIdx = null; }
  function handleClick(e: MouseEvent) { const idx = svgMouseToRunIdx(e.clientX); pinnedRunIdx = pinnedRunIdx === idx ? null : idx; }

  const activeRunIdx = $derived(pinnedRunIdx ?? hoveredRunIdx);
  const crosshairX = $derived(activeRunIdx !== null && chartData.xScale ? chartData.xScale(activeRunIdx) : null);

  const crosshairDots = $derived.by(() => {
    if (activeRunIdx === null || !chartData.xScale || !chartData.yScale) return [];
    return GROUPS.flatMap(g => {
      const d = groupRunAvgMap[g].get(activeRunIdx);
      if (!d) return [];
      return [{ cx: chartData.xScale!(activeRunIdx), cy: chartData.yScale!(d.avg), fill: GROUP_COLORS[g], group: g }];
    });
  });

  const tooltipData = $derived.by(() => {
    if (activeRunIdx === null) return null;
    return { runIdx: activeRunIdx, rows: GROUPS.map(g => ({ group: g, label: GROUP_LABELS[g], color: GROUP_COLORS[g], entry: groupRunAvgMap[g].get(activeRunIdx) ?? null })) };
  });

  const runCount = $derived(selectedAthlete ? allRows.filter(r => r.athlete === selectedAthlete).length : allRows.length);
  const yLabel = $derived(yMode === "speed" ? "Speed (km/h)" : "Efficiency");

  const progressT = $derived(clamp01(progress / 100));
  const easedProgressT = $derived(progressT * progressT * (3 - 2 * progressT));
  const scrollMaxRuns = $derived(Math.round(lerp(40, 500, easedProgressT) / 10) * 10);
  let manualMode = $state(false);

  function toggleMode() {
    manualMode = !manualMode;
    if (!manualMode) { xMax = scrollMaxRuns; pinnedRunIdx = null; hoveredRunIdx = null; }
  }

  $effect(() => {
    if (!manualMode && xMax !== scrollMaxRuns) { xMax = scrollMaxRuns; pinnedRunIdx = null; hoveredRunIdx = null; }
  });

  const chartOpacity = $derived(progress < 2 ? 0 : progress < 8 ? (progress - 2) / 6 : 1);
  const chartInteractive = $derived(chartOpacity > 0.05);
</script>

<Scroll bind:progress --scrolly-story-width="0.8fr" --scrolly-viz-width="2.5fr">
  <div class="story-steps">

    <section class="step">
      <p class="step-label"><span class="step-pip"></span>Part 2 — Speed & Efficiency</p>
      <h2>How does training load shape speed and efficiency?</h2>
      <p>
			X-axis is cumulative run number (1 to 500). You can compare either speed or efficiency across low, medium, and high consistency groups.
			<br />We group athletes by percentiles of their average weekly training load equal percentiles across all their runs, then color runs by that group.
			<br />Each dot is either an individual run (when an athlete is selected) or the average across all athletes at that run number within each group (when no athlete is selected). 
			<br />Trend lines are dashed. Hover to inspect values, click to pin a run index and compare groups in the side panel.
		</p>
    </section>

    <section class="step">
      <h2>Patterns emerge with scale</h2>
      <p>
			As more runs are logged we can see patterns in the data. For example, the high-consistency group (red) tends to have higher speed and efficiency, especially in later runs.
			<br />As you scroll you notice more runs appearing on the chart, and the trend lines adjusting as the averages update with more data. 
			
			<br /> The 3 different volume groups show average speed and efficiency differences that become more apparent with more runs.
			<br /> The 3 different run volumes are based on average runs per week.
			<br />There are more points of references for runner groups that run more on average which may contribute to more stable trend lines, and better overall data.
			<br />You can see low volume runners cut of around 330, that the average is centered at the beginning and becomes more spread out the longer people run.
			<br />Averages are more clustered together at the beginning since there are more points of reference to average and things get more spread out as there less runners to average.
			
			<br />For the high volume runners We see that there is slight improvement in speed and efficiency over time. 
			<br />For the medium volume runners we have decreasing speed and same level of efficiency for more runners.
			<br />For the low volume runners they have the largest increase speed and efficiency, over time but lowest number of runs.

			<br />This illustrates how consistency (training load) can shape performance outcomes over time.
	   </p>
    </section>

    <section class="step">
      <h2>Click to pin a run</h2>
      <p>
		Pin a run index and compare group values in the side panel.
		<br />Are run index is able to display a few information such as run number, average speed/efficiency  for each of the 3 groups, and the number of runs that average is based on.
		<br />Make note that low volume runners average only go up to 341 runs, and that the number of runs that average is based on decreases as we go to higher run indices.
		<br />The scroll bar can be adjusted to change the range of runs we see, which helps us look at runners with lower run counts and see more of their data.
	  </p>
    </section>

  </div>

  <div slot="viz" class="viz-panel">
    <div
      class="abs-layer"
      style="opacity:{chartOpacity}; pointer-events:{chartInteractive ? 'auto' : 'none'};"
      aria-hidden={!chartInteractive}
    >
      {#if loadError}
        <p class="err">Could not load CSV: {loadError}</p>
      {:else if !allRows.length}
        <div class="loading-state"><div class="loading-bar"></div><p>Loading data…</p></div>
      {:else}

        <div class="chart-header">
          <p class="chart-eyebrow"><span class="eyebrow-pip"></span>Consistency shapes performance</p>
          <h3>How training load affects speed and efficiency</h3>
        </div>

        <div class="controls">
          <div class="control-row">
            <label class="picker">
              <span class="picker-label">Athlete</span>
              <select bind:value={selectedAthlete}>
                <option value="">All Athletes</option>
                {#each athleteOptions as opt}
                  <option value={opt.id}>#{opt.id} — {GROUP_LABELS[opt.group]} — {opt.runCount} runs</option>
                {/each}
              </select>
              <span class="meta">{runCount} runs</span>
            </label>

            <div class="toggle-group" role="group">
              <button class="toggle-btn" class:active={yMode === "speed"} onclick={() => { yMode = "speed"; pinnedRunIdx = null; }}>Speed</button>
              <button class="toggle-btn" class:active={yMode === "efficiency"} onclick={() => { yMode = "efficiency"; pinnedRunIdx = null; }}>Efficiency</button>
            </div>
          </div>

          <div class="control-row">
            <span class="slider-label">Runs 1–</span>
            <input type="range" class="slider" class:active-slider={manualMode}
              min="10" max="500" step="1" bind:value={xMax} disabled={!manualMode}
              oninput={() => { manualMode = true; }}
            />
            <span class="slider-val">{xMax}</span>
            <button class="mode-toggle" class:manual={manualMode} onclick={toggleMode}>
              {manualMode ? "⟳ Auto" : "⊟ Manual"}
            </button>
          </div>
        </div>

        <div class="chart-and-panel">
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} preserveAspectRatio="xMinYMin meet"
            class="chart" aria-label="Scatter chart" bind:this={svgEl}
            onmousemove={handleMouseMove} onmouseleave={handleMouseLeave} onclick={handleClick}
          >
            <rect x={margin.left} y={margin.top} width={innerW} height={innerH} fill="transparent" />

            {#if chartData.yScale}
              {#each chartData.yScale.ticks(6) as tick}
                <line x1={margin.left} x2={margin.left + innerW} y1={chartData.yScale(tick)} y2={chartData.yScale(tick)} stroke="#ede9e0" stroke-width="1" />
              {/each}
            {/if}

            {#each chartData.lines as l}
              <path d={l.d} fill="none" stroke={l.color} stroke-width="2" stroke-dasharray="7 4" opacity="0.85" />
            {/each}

            {#each chartData.circles as c}
              <circle cx={c.cx} cy={c.cy} r="2.5" fill={c.fill} stroke="rgba(0,0,0,0.1)" stroke-width="0.4" opacity="0.72"><title>{c.title}</title></circle>
            {/each}

            {#if crosshairX !== null && activeRunIdx !== null}
              <line x1={crosshairX} x2={crosshairX} y1={margin.top} y2={margin.top + innerH} stroke="#5a5248" stroke-width="1" stroke-dasharray="4 3" pointer-events="none" />
              <rect x={crosshairX - 24} y={margin.top - 24} width="48" height="18" rx="4" fill={pinnedRunIdx !== null ? "#2c3a2a" : "#6b6456"} pointer-events="none" />
              <text x={crosshairX} y={margin.top - 10} text-anchor="middle" fill="#e8e2d6" font-size="10" font-family="DM Sans, system-ui" font-weight="500" pointer-events="none">Run {activeRunIdx}</text>
              {#each crosshairDots as dot}
                <circle cx={dot.cx} cy={dot.cy} r="5.5" fill={dot.fill} stroke="#fff" stroke-width="2" pointer-events="none" />
              {/each}
            {/if}

            <g transform="translate(0,{margin.top + innerH})" bind:this={axisX} />
            <g transform="translate({margin.left},0)" bind:this={axisY} />

            <text class="axis-label" x={margin.left + innerW / 2} y={GRAPH_HEIGHT - 8} text-anchor="middle">
              Run number (cumulative)
            </text>
            <text class="axis-label" transform="rotate(-90)" x={-(margin.top + innerH / 2)} y="16" text-anchor="middle">
              {yLabel}
            </text>
          </svg>

          <div class="panel-column">
            <p class="panel-legend-heading">Avg runs / week</p>
            <div class="legend">
              {#each GROUPS as g}
                <div class="legend-row">
                  <span class="legend-dot" style="background:{GROUP_COLORS[g]}"></span>
                  <span class="legend-line" style="background:{GROUP_COLORS[g]}"></span>
                  <span class="legend-label">{GROUP_LABELS[g]}</span>
                </div>
              {/each}
            </div>

            <aside class="values-panel" class:visible={tooltipData !== null}>
              {#if tooltipData}
                <div class="vp-header">
                  Run <strong>#{tooltipData.runIdx}</strong>
                  {#if pinnedRunIdx !== null}
                    <button class="unpin-btn" onclick={() => (pinnedRunIdx = null)}>✕</button>
                  {/if}
                </div>
                <div class="vp-metric">{yLabel}</div>
                {#each tooltipData.rows as row}
                  <div class="vp-row">
                    <span class="vp-swatch" style="background:{row.color}"></span>
                    <span class="vp-label">{row.label}</span>
                    {#if row.entry}
                      <span class="vp-value">
                        {yMode === "speed" ? row.entry.avg.toFixed(2) : row.entry.avg.toFixed(4)}
                        <small>{yMode === "speed" ? " km/h" : ""}</small>
                      </span>
                      <span class="vp-n">n={row.entry.n}</span>
                    {:else}
                      <span class="vp-none" style="grid-column:3/5">—</span>
                    {/if}
                  </div>
                {/each}
                <p class="vp-hint">{pinnedRunIdx !== null ? "Pinned. Click to reposition." : "Click to pin this run."}</p>
              {:else}
                <p class="vp-idle">Hover to inspect values, click to pin a run index.</p>
              {/if}
            </aside>
          </div>
        </div>

      {/if}
    </div>
  </div>
</Scroll>

<style>
  .story-steps { padding-right: 1rem; min-width: 14rem; }

  .step {
    min-height: 74vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.75rem;
  }

  .step p { line-height: 1.65; margin: 0; font-size: clamp(0.88rem, 1.45vw, 1rem); color: #3a3428; }
  .step strong { color: #1a1a18; font-weight: 500; }

  .step-label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 10px !important;
    font-weight: 500 !important;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #9a8e7a !important;
  }

  .step-pip { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #b5a882; }

  h2 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(1.1rem, 2.1vw, 1.4rem);
    font-weight: 400;
    line-height: 1.25;
    margin: 0;
    color: #1a1a18;
  }

  .viz-panel { position: relative; min-height: 90vh; margin-top: 4rem; }
  .abs-layer { position: absolute; top: 0; left: 0; width: 100%; transition: opacity 0.5s ease; }

  .chart-header { margin-bottom: 0.75rem; }
  .chart-eyebrow { display: flex; align-items: center; gap: 7px; font-size: 10px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8e7a; margin: 0 0 0.4rem; }
  .eyebrow-pip { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #b5a882; }
  h3 { font-family: 'DM Serif Display', Georgia, serif; font-size: clamp(1.1rem, 2vw, 1.4rem); font-weight: 400; margin: 0; color: #1a1a18; }

  .controls { display: flex; flex-direction: column; gap: 6px; margin: 0.6rem 0 0.9rem; }
  .control-row { display: flex; align-items: center; gap: 10px; font-size: 12.5px; flex-wrap: wrap; }

  .picker { display: flex; align-items: center; gap: 6px; }
  .picker-label { font-weight: 500; font-size: 12px; color: #5a5248; }
  .meta { color: #9a9080; font-size: 11px; }

  select { padding: 3px 7px; font-size: 12.5px; border-radius: 7px; border: 1px solid #d4ccbc; background: #faf8f4; color: #3a3428; cursor: pointer; }

  .toggle-group { display: flex; border: 1px solid #d4ccbc; border-radius: 7px; overflow: hidden; }
  .toggle-btn { padding: 3px 10px; font-size: 12px; border: none; background: #faf8f4; color: #7a6e5c; cursor: pointer; border-right: 1px solid #d4ccbc; }
  .toggle-btn:last-child { border-right: none; }
  .toggle-btn.active { background: #2c3a2a; color: #d4e8d0; font-weight: 500; }

  .slider-label { font-size: 12.5px; color: #5a5248; }
  .slider { width: 200px; accent-color: #3a5c38; cursor: pointer; }
  .slider:disabled { opacity: 0.4; cursor: default; }
  .active-slider { accent-color: #e05050 !important; }
  .slider-val { font-weight: 600; min-width: 28px; font-size: 12.5px; color: #3a3428; }

  .mode-toggle { padding: 3px 9px; font-size: 11.5px; border-radius: 6px; border: 1px solid #d4ccbc; background: #faf8f4; color: #5a5248; cursor: pointer; white-space: nowrap; transition: background 0.15s; }
  .mode-toggle:hover { background: #f0ece4; }
  .mode-toggle.manual { background: #2c3a2a; color: #d4e8d0; border-color: #2c3a2a; font-weight: 500; }

  .chart-and-panel { display: flex; gap: 1rem; align-items: flex-start; }
  .panel-column { width: 200px; flex-shrink: 0; }

  .chart { cursor: crosshair; width: 100%; height: auto; display: block; }

  .axis-label { font-size: 11px; fill: #6b6456; font-family: 'DM Sans', system-ui, sans-serif; }

  .panel-legend-heading { margin: 0 0 0.4rem; font-size: 9px; color: #9a9080; text-transform: uppercase; font-weight: 600; letter-spacing: 0.06em; }
  .legend { margin-bottom: 0.75rem; }
  .legend-row { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; }
  .legend-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .legend-line { width: 12px; height: 2px; border-radius: 2px; flex-shrink: 0; }
  .legend-label { font-size: 9px; color: #6b6456; }

  .values-panel { border: 1px solid #e8e2d6; border-radius: 10px; background: rgba(255,255,255,0.9); padding: 0.75rem; font-size: 12px; opacity: 0; transition: opacity 0.15s; }
  .values-panel.visible { opacity: 1; }
  .vp-header { display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #2a2820; }
  .vp-metric { font-size: 10px; color: #9a9080; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .vp-row { display: grid; grid-template-columns: 10px 1fr auto auto; gap: 5px; align-items: center; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #f0ece4; }
  .vp-row:last-of-type { border-bottom: none; }
  .vp-swatch { width: 8px; height: 8px; border-radius: 50%; }
  .vp-label { font-size: 11px; color: #5a5248; }
  .vp-value { font-weight: 600; font-size: 11px; color: #1a1a18; }
  .vp-n { color: #b5ad9e; font-size: 10px; }
  .vp-none { color: #b5ad9e; font-size: 11px; }
  .vp-hint, .vp-idle { color: #b5ad9e; font-size: 10px; font-style: italic; margin: 4px 0 0; }
  .unpin-btn { background: none; border: none; color: #b5ad9e; cursor: pointer; font-size: 11px; padding: 0; }

  .loading-state { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 3rem; color: #9a9080; font-size: 0.9rem; }
  .loading-bar { width: 100px; height: 3px; background: #e8e2d6; border-radius: 2px; overflow: hidden; position: relative; }
  .loading-bar::after { content: ''; position: absolute; left: -40%; top: 0; width: 40%; height: 100%; background: #b5a882; animation: sweep 1.2s ease-in-out infinite; }
  @keyframes sweep { to { left: 100%; } }
  .err { color: #a03020; font-size: 0.9rem; }

  :global(.chart .tick line) { stroke: #e8e2d6; }
  :global(.chart .domain) { stroke: #d4ccbc; }
  :global(.chart .tick text) { font-size: 10.5px; fill: #6b6456; font-family: 'DM Sans', system-ui; }
</style>