<script lang="ts">
  import * as d3 from "d3";
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  import type { TTrajectory, TIndividual } from "../types";

  export let data: TTrajectory[] = [];
  export let individuals: TIndividual[] = [];
  export let selectedAthlete: string | null = null;

  const width  = 1000;
  const height = 600;
  const margin = { top: 16, right: 120, bottom: 44, left: 56 };
  const innerWidth  = width  - margin.left - margin.right;
  const innerHeight = height - margin.top  - margin.bottom;

  // high = orange (most runs/week), mid = cyan, low = pink (fewest runs/week)
  const GROUP_COLOR: Record<string, { line: string; band: string; label: string }> = {
    low:  { line: "#d4537e", band: "rgba(212,83,126,0.12)",  label: "Low Volume (10th Percentile)"    },
    mid:  { line: "#26c6da", band: "rgba(38,198,218,0.12)",  label: "Mid Volume (50th Percentile)"    },
    high: { line: "#ff6f00", band: "rgba(255,111,0,0.12)",   label: "High Volume (90th Percentile)"   },
  };

  const GROUPS = ["low", "mid", "high"] as const;

  // colour for the selected athlete line — use their group colour
  function athleteColor(grp: string | undefined): string {
    return grp ? (GROUP_COLOR[grp]?.line ?? "#888") : "#888";
  }

  function quantile(arr: number[], q: number): number {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const lo  = Math.floor(pos);
    const hi  = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  function buildAggregates(rows: TTrajectory[]) {
    type BandPoint = { run: number; lo: number; mid: number; hi: number };
    const result: Record<string, BandPoint[]> = {};
    for (const grp of GROUPS) {
      const byRun = d3.group(rows.filter(r => r.group === grp), r => r.run_number);
      const points: BandPoint[] = [];
      for (const [run, rs] of byRun.entries()) {
        const paces = rs.map(r => r.pace);
        points.push({
          run,
          lo:  quantile(paces, 0.25),
          mid: quantile(paces, 0.50),
          hi:  quantile(paces, 0.75),
        });
      }
      result[grp] = points.sort((a, b) => a.run - b.run);
    }
    return result;
  }

  function buildSelectedLine(rows: TTrajectory[], athlete: string | null): TTrajectory[] {
    if (!athlete) return [];
    return rows.filter(r => r.athlete === athlete).sort((a, b) => a.run_number - b.run_number);
  }

  const yDomainStore = tweened([4, 10], {
    duration: 400,
    easing: cubicOut
  });

  $: agg = buildAggregates(data);
  $: selectedRuns = buildSelectedLine(data, selectedAthlete);
  $: selectedMeta = selectedAthlete
    ? (individuals.find(i => i.athlete === selectedAthlete) ?? null)
    : null;

  $: maxRun = data.length ? (d3.max(data, d => d.run_number) ?? 100) : 100;
  $: aggPaces = Object.values(agg).flatMap(pts => pts.flatMap(p => [p.lo, p.hi]));
  $: selectedPaces = selectedRuns.map(r => r.pace);
  $: rawMin = d3.min([...aggPaces, ...selectedPaces]) ?? 3;
  $: rawMax = d3.max([...aggPaces, ...selectedPaces]) ?? 15;

  $: yDomainStore.set([rawMin - 0.2, rawMax + 0.2]);

  $: xScale = d3.scaleLinear().domain([1, maxRun]).range([0, innerWidth]);
  $: yScale = d3.scaleLinear().domain($yDomainStore).range([innerHeight, 0]);

  $: lineGen = d3.line<{ run: number; mid: number }>()
    .x(d => xScale(d.run)).y(d => yScale(d.mid)).curve(d3.curveCatmullRom);
  $: areaGen = d3.area<{ run: number; lo: number; hi: number }>()
    .x(d => xScale(d.run)).y0(d => yScale(d.lo)).y1(d => yScale(d.hi)).curve(d3.curveCatmullRom);
  $: athleteLineGen = d3.line<TTrajectory>()
    .x(d => xScale(d.run_number)).y(d => yScale(d.pace)).curve(d3.curveCatmullRom);

  $: xTicks = xScale.ticks(8);
  $: yTicks = yScale.ticks(6);

  $: selectedColor = athleteColor(selectedMeta?.group);

  // ── hover / crosshair ────────────────────────────────────────────────────
  let hoverX: number | null = null;

  function handleSvgMouseMove(e: MouseEvent & { currentTarget: SVGSVGElement }) {
    const rect   = e.currentTarget.getBoundingClientRect();
    const innerX = (e.clientX - rect.left) * (width / rect.width) - margin.left;
    hoverX = (innerX >= 0 && innerX <= innerWidth) ? innerX : null;
  }
  function handleSvgMouseLeave() { hoverX = null; }

  $: hoverRun = hoverX !== null ? Math.round(xScale.invert(hoverX)) : null;

  function closestAggPt(
    pts: { run: number; lo: number; mid: number; hi: number }[],
    run: number
  ) {
    if (!pts.length) return null;
    return pts.reduce((b, p) => Math.abs(p.run - run) < Math.abs(b.run - run) ? p : b);
  }

  $: hoverSnaps = hoverRun !== null
    ? GROUPS.map(grp => ({ grp, pt: closestAggPt(agg[grp] ?? [], hoverRun!) }))
        .filter((s): s is { grp: string; pt: NonNullable<ReturnType<typeof closestAggPt>> } => s.pt !== null)
    : [];

  $: hoverAthleteRow = (hoverRun !== null && selectedRuns.length)
    ? selectedRuns.reduce((b, r) =>
        Math.abs(r.run_number - hoverRun!) < Math.abs(b.run_number - hoverRun!) ? r : b
      )
    : null;

  // panel geometry — fixed in right margin, vertically centred
  const PANEL_W     = 240;
  const PANEL_ROW_H = 45;
  const PANEL_HEAD  = 30;
  
  $: panelH = PANEL_HEAD + (GROUPS.length * PANEL_ROW_H) + (selectedMeta ? 40 : 10);

  const panelX = innerWidth + 6;
  $: legendSpace = (GROUPS.length + 1) * 25; 
  $: panelY = legendSpace + 20;
</script>

{#if data.length > 0}
  <svg
    {width} {height}
    viewBox="0 0 {width} {height}"
    style="width:100%;height:auto;overflow:visible;"
    on:mousemove={handleSvgMouseMove}
    on:mouseleave={handleSvgMouseLeave}
  >
    <g transform="translate({margin.left},{margin.top})">

      <!-- x grid + labels -->
      {#each xTicks as tick}
        <line x1={xScale(tick)} y1={0} x2={xScale(tick)} y2={innerHeight}
          stroke="#ccc" stroke-width="0.5" stroke-dasharray="4,4" />
        <text x={xScale(tick)} y={innerHeight + 13}
          text-anchor="middle" font-size="15" fill="#888">{tick}</text>
      {/each}
      <text x={innerWidth / 2} y={innerHeight + 36}
        text-anchor="middle" font-size="20" fill="#888">Run number (cumulative)</text>

      <!-- y grid + labels -->
      {#each yTicks as tick}
        <line x1={0} y1={yScale(tick)} x2={innerWidth} y2={yScale(tick)}
          stroke="#ccc" stroke-width="0.5" stroke-dasharray="4,4" />
        <text x={-5} y={yScale(tick)}
          text-anchor="end" dominant-baseline="central" font-size="15" fill="#888">
          {tick.toFixed(1)}
        </text>
      {/each}
      <text transform="rotate(-90)" x={-innerHeight / 2} y={-36}
        text-anchor="middle" font-size="20" fill="#888">Pace (min/km) — lower is faster</text>

      <!-- band + median per group (fade when a runner is selected) -->
      {#each GROUPS as grp}
        {@const { line: lc, band: bc } = GROUP_COLOR[grp]}
        {@const pts = agg[grp] ?? []}
        {@const faded = selectedRuns.length > 0}
        {#if pts.length > 1}
          <path d={areaGen(pts) ?? ""} fill={bc} stroke="none" opacity={faded ? 0.50 : 1} />
          <path
            d={lineGen(pts.map(p => ({ run: p.run, mid: p.mid }))) ?? ""}
            fill="none" stroke={lc} stroke-width="2"
            opacity={faded ? 0.2 : 0.9}
          />
        {/if}
      {/each}

      <!-- selected athlete line — solid dark, drawn on top -->
      {#if selectedRuns.length > 1}
        <path
          d={athleteLineGen(selectedRuns) ?? ""}
          fill="none" stroke="#495057" stroke-width="2.5" opacity="1"
        />
        {@const last = selectedRuns[selectedRuns.length - 1]}
        <circle
          cx={xScale(last.run_number)} cy={yScale(last.pace)}
          r="4.5" fill="#495057" stroke="white" stroke-width="1.5"
        />
      {/if}

      <!-- crosshair + dots + hover panel -->
      {#if hoverX !== null && hoverSnaps.length > 0}

        <line x1={hoverX} y1={0} x2={hoverX} y2={innerHeight}
          stroke="#aaa" stroke-width="1" stroke-dasharray="4,3" opacity="0.8" />

        {#each hoverSnaps as { grp, pt }}
          <circle
            cx={xScale(pt.run)} cy={yScale(pt.mid)}
            r="4" fill={GROUP_COLOR[grp].line} stroke="white" stroke-width="1.5"
          />
        {/each}

        {#if hoverAthleteRow}
          <circle
            cx={xScale(hoverAthleteRow.run_number)} cy={yScale(hoverAthleteRow.pace)}
            r="5" fill="#1a1a1a" stroke="white" stroke-width="1.5"
          />
        {/if}

        <!-- info panel -->
        <g transform="translate({panelX},{panelY})">
          <rect x={0} y={0} width={PANEL_W} height={panelH}
            rx="8" fill="#fcfcfc" stroke="#ddd" stroke-width="1" />

          <text x={PANEL_W / 2} y={20}
            text-anchor="middle" font-size="14" font-weight="700" fill="#444">
            {hoverRun !== null ? `Run ${hoverRun}` : 'Run Statistics'}
          </text>
          <line x1={10} y1={28} x2={PANEL_W - 10} y2={28} stroke="#eee" stroke-width="1" />

          {#each GROUPS as grp, i}
            {@const { line: lc, label } = GROUP_COLOR[grp]}
            {@const snap = hoverSnaps.find(s => s.grp === grp)}
            {@const ry = PANEL_HEAD + i * PANEL_ROW_H}
            
            <rect x={10} y={ry + 10} width={8} height={8} rx="2" fill={lc} />
            <text x={25} y={ry + 18} font-size="12" font-weight="600" fill={lc}>{label}</text>

            {#if snap}
              <text x={PANEL_W - 10} y={ry + 18}
                text-anchor="end" font-size="16" font-weight="700" fill={lc}>
                {snap.pt.mid.toFixed(2)}
              </text>
              <text x={25} y={ry + 32} font-size="10" fill="#999">
                Range: {snap.pt.lo.toFixed(2)} – {snap.pt.hi.toFixed(2)}
              </text>
            {:else}
              <text x={PANEL_W - 10} y={ry + 18} text-anchor="end" font-size="12" fill="#ccc">—</text>
            {/if}
          {/each}

          {#if selectedMeta}
            {@const ay = PANEL_HEAD + GROUPS.length * PANEL_ROW_H + 5}
            <line x1={10} y1={ay} x2={PANEL_W - 10} y2={ay} stroke="#ddd" stroke-dasharray="3,2" />
            
            <text x={10} y={ay + 20} font-size="12" font-weight="700" fill="#495057">
              Athlete #{selectedAthlete}
            </text>

            {#if hoverAthleteRow}
              <text x={PANEL_W - 10} y={ay + 20} text-anchor="end" font-size="16" font-weight="700" fill="#495057">
                {hoverAthleteRow.pace.toFixed(2)}
              </text>
            {:else}
              <text x={PANEL_W - 10} y={ay + 20} text-anchor="end" font-size="12" fill="#ccc">—</text>
            {/if}
          {/if}
        </g>
      {/if}

      <!-- legend -->
      {#each GROUPS as grp, i}
        {@const { line: lc, band: bc, label } = GROUP_COLOR[grp]}
        <rect
          x={innerWidth + 6} y={10 + i * 22}
          width={18} height={10} rx="2"
          fill={bc} stroke={lc} stroke-width="1.2"
        />
        <text x={innerWidth + 28} y={10 + i * 22 + 8}
          font-size="15" fill={lc}>{label}</text>
      {/each}

      {#if selectedMeta}
        {@const legendY = 10 + GROUPS.length * 22 + 8}
        <line
          x1={innerWidth + 6} y1={legendY}
          x2={innerWidth + 24} y2={legendY}
          stroke="#1a1a1a" stroke-width="2.5"
        />
        <text x={innerWidth + 28} y={legendY + 4}
          font-size="9" fill="#1a1a1a">
          #{selectedAthlete}
        </text>
      {/if}

    </g>
  </svg>
{:else}
  <p style="color:#888;font-size:13px;">Loading chart data…</p>
{/if}

<style>
  path { transition: opacity 0.2s ease; }
</style>