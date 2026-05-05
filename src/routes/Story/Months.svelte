<script lang="ts">
  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  export let csvPath = "month_runs_total.csv";
  export let highlightedMonths: number[] = [];
  export let yMax: number | null = 4000;
  export let zoomThreshold = 3000;
  export let lowRegionRatio = 0.32;
  export let width = 920;
  export let height = 460;

  let data: { month: number; count: number }[] = [];

  const margin = { top: 40, right: 20, bottom: 72, left: 64 };
  $: innerWidth = width - margin.left - margin.right;
  $: innerHeight = height - margin.top - margin.bottom;

  const barColor        = "#3a5c38";
  const barColorMuted   = "#c8ddc6";
  const labelColor      = "#5a5248";
  const gridColor       = "#e8e2d6";
  const annotLineColor  = "#b5a882";

  onMount(async () => {
    const raw = await d3.csv(csvPath, (d) => ({
      month: +d.month,
      count: +d.count,
    }));
    data = raw.sort((a, b) => a.month - b.month);
  });

  $: xScale = d3.scaleBand()
    .domain(data.map(d => d.month.toString()))
    .range([0, innerWidth])
    .padding(0.28);

  $: dataMax = d3.max(data, d => d.count) || zoomThreshold;
  $: chartMax = Math.max(zoomThreshold + 1, yMax ?? dataMax);

  function yFromValue(value: number): number {
    const clampedValue = Math.max(0, Math.min(chartMax, value));
    const threshold = Math.min(zoomThreshold, chartMax - 1);
    let normalized = 0;
    if (clampedValue <= threshold) {
      normalized = (clampedValue / threshold) * lowRegionRatio;
    } else {
      const upperRatio = (clampedValue - threshold) / (chartMax - threshold);
      normalized = lowRegionRatio + upperRatio * (1 - lowRegionRatio);
    }
    return innerHeight * (1 - normalized);
  }

  $: highTicks = d3.range(3200, chartMax + 1, 200).map(t => Math.round(t));
  $: yTicks = Array.from(new Set([0, 1000, 2000, 3000, ...highTicks, chartMax]))
    .filter(t => t >= 0 && t <= chartMax)
    .sort((a, b) => a - b);

  $: highlightedSet = new Set(highlightedMonths);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
</script>

{#if data.length > 0}
  <svg
    {width} {height}
    viewBox="0 0 {width} {height}"
    style="width: 100%; max-width: {width}px; height: auto;"
    role="img"
    aria-labelledby="months-chart-title"
  >
    <title id="months-chart-title">Total runs per month</title>

    <defs>
      <filter id="bar-shadow" x="-5%" y="-5%" width="110%" height="115%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(60,92,56,0.12)" />
      </filter>
    </defs>

    <g transform="translate({margin.left}, {margin.top})">

      <!-- Y-axis label -->
      <text
        transform="rotate(-90)"
        x={-innerHeight / 2}
        y={-48}
        text-anchor="middle"
        fill={labelColor}
        font-size="12"
        font-family="DM Sans, system-ui, sans-serif"
        font-weight="500"
        letter-spacing="0.06em"
      >NUMBER OF RUNS</text>

      <!-- X-axis label -->
      <text
        x={innerWidth / 2}
        y={innerHeight + 56}
        text-anchor="middle"
        fill={labelColor}
        font-size="12"
        font-family="DM Sans, system-ui, sans-serif"
        font-weight="500"
        letter-spacing="0.06em"
      >MONTH</text>

      <!-- Grid lines -->
      {#each yTicks as tick}
        <g transform="translate(0, {yFromValue(tick)})">
          <line x2={innerWidth} stroke={gridColor} stroke-width="1" />
          <text
            x="-12"
            dy="0.32em"
            text-anchor="end"
            fill={labelColor}
            font-size="11"
            font-family="DM Sans, system-ui, sans-serif"
          >{tick.toLocaleString()}</text>
        </g>
      {/each}

      <!-- Bars -->
      {#each data as d}
        {@const xPos = xScale(d.month.toString()) ?? 0}
        {@const isHighlighted = highlightedSet.size === 0 || highlightedSet.has(d.month)}
        {@const barHeight = innerHeight - yFromValue(d.count)}

        <!-- Bar background (subtle depth) -->
        {#if isHighlighted}
          <rect
            x={xPos + 2}
            y={yFromValue(d.count) + 3}
            width={xScale.bandwidth()}
            height={barHeight}
            fill="rgba(60, 92, 56, 0.08)"
            rx="5"
          />
        {/if}

        <!-- Main bar -->
        <rect
          x={xPos}
          y={yFromValue(d.count)}
          width={xScale.bandwidth()}
          height={barHeight}
          fill={isHighlighted ? barColor : barColorMuted}
          rx="5"
          style="transition: fill 0.35s ease, opacity 0.35s ease;"
        />

        <!-- Value label above bar -->
        <text
          x={xPos + xScale.bandwidth() / 2}
          y={yFromValue(d.count) - 8}
          text-anchor="middle"
          fill={isHighlighted ? barColor : barColorMuted}
          font-size="10.5"
          font-family="DM Sans, system-ui, sans-serif"
          font-weight="500"
          style="transition: fill 0.35s ease, opacity 0.35s ease;"
        >{d.count.toLocaleString()}</text>
      {/each}

      <!-- Month labels -->
      {#each data as d}
        {@const xPos = xScale(d.month.toString()) ?? 0}
        {@const isHighlighted = highlightedSet.size === 0 || highlightedSet.has(d.month)}
        <text
          x={xPos + xScale.bandwidth() / 2}
          y={innerHeight + 22}
          text-anchor="middle"
          fill={isHighlighted ? "#3a2e22" : "#b5ad9e"}
          font-size="12"
          font-family="DM Sans, system-ui, sans-serif"
          font-weight={isHighlighted ? "500" : "400"}
          style="transition: fill 0.35s ease;"
        >{monthNames[d.month - 1] || d.month}</text>
      {/each}

      <!-- Baseline -->
      <line x1="0" y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke={gridColor} stroke-width="1.5" />

    </g>
  </svg>
{:else}
  <div class="loading-state">
    <div class="loading-bar"></div>
    <p>Loading run data…</p>
  </div>
{/if}

<style>
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 3rem;
    color: #9a9080;
    font-size: 0.9rem;
  }

  .loading-bar {
    width: 120px;
    height: 3px;
    background: #e8e2d6;
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }

  .loading-bar::after {
    content: '';
    position: absolute;
    left: -40%;
    top: 0;
    width: 40%;
    height: 100%;
    background: #b5a882;
    border-radius: 2px;
    animation: loading-sweep 1.2s ease-in-out infinite;
  }

  @keyframes loading-sweep {
    to { left: 100%; }
  }
</style>