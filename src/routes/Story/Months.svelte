<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  // Data structure
  export let csvPath = "month_runs_total.csv";
  export let highlightedMonths: number[] = [];
  export let yMax: number | null = 4000;
  export let zoomThreshold = 3000;
  export let lowRegionRatio = 0.32;
  export let width = 920;
  export let height = 480;
  let data: { month: number, count: number }[] = [];

  // Dimensions
  const margin = { top: 50, right: 30, bottom: 80, left: 60 };
  $: innerWidth = width - margin.left - margin.right;
  $: innerHeight = height - margin.top - margin.bottom;

  // Colors - using the "Easy on the eyes" Graphite/Slate theme
  const barColor = "#2d2e2e";
  const labelColor = "#495057";

  onMount(async () => {
    // Load and parse data
    const raw = await d3.csv(csvPath, (d) => ({
      month: +d.month,
      count: +d.count
    }));
    data = raw.sort((a, b) => a.month - b.month);
    console.log(data);
  });

  // Scales
  $: xScale = d3.scaleBand()
    .domain(data.map(d => d.month.toString()))
    .range([0, innerWidth])
    .padding(0.2);

  $: dataMax = d3.max(data, d => d.count) || zoomThreshold;
  $: chartMax = Math.max(zoomThreshold + 1, yMax ?? dataMax);

  function yFromValue(value: number) {
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

  $: highTicks = d3.range(3200, chartMax + 1, 200).map((tick) => Math.round(tick));
  $: yTicks = Array.from(new Set([0, 1000, 2000, 3000, ...highTicks, chartMax]))
    .filter((tick) => tick >= 0 && tick <= chartMax)
    .sort((a, b) => a - b);

  $: highlightedSet = new Set(highlightedMonths);

  // Helpers for month names if you want them instead of numbers
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
</script>

{#if data.length > 0}
  <svg 
    {width} {height} 
    viewBox="0 0 {width} {height}" 
    style="width: {width}px; height: {height}px;"
    role="img"
    aria-labelledby="chart-title"
  >
    <title id="chart-title">Total Runs per Month</title>

    <g transform="translate({margin.left}, {margin.top})">
        <text 
            transform="rotate(-90)" 
            x={-innerHeight / 2} 
            y={-45} 
            text-anchor="middle" 
            fill={labelColor} 
            font-size="14" 
            font-weight="bold"
        >
            Number of Runs
        </text>

        <text 
            x={innerWidth / 2} 
            y={innerHeight + 45} 
            text-anchor="middle" 
            fill={labelColor} 
            font-size="14" 
            font-weight="bold"
        >
            Month
        </text>
        {#each yTicks as tick}
            <g class="grid-line" transform="translate(0, {yFromValue(tick)})">
            <line x2={innerWidth} stroke="#e0e0e0" stroke-dasharray="4" />
            <text x="-10" dy="0.32em" text-anchor="end" fill={labelColor} font-size="12">
                {tick.toLocaleString()}
            </text>
            </g>
        {/each}

        <!-- <g class="zoom-line" transform="translate(0, {yFromValue(zoomThreshold)})">
          <line x2={innerWidth} stroke="#9aa0a6" stroke-dasharray="3 3" />
          <text x={innerWidth - 4} y="-6" text-anchor="end" fill="#7a7f85" font-size="11">
            zoom starts
          </text>
        </g> -->

        {#each data as d}
          {@const xPos = xScale(d.month.toString()) ?? 0}
            <rect
          x={xPos}
            y={yFromValue(d.count)}
            width={xScale.bandwidth()}
            height={innerHeight - yFromValue(d.count)}
            fill={barColor}
          opacity={highlightedSet.size === 0 || highlightedSet.has(d.month) ? 1 : 0.25}
            rx="4"
            />

            <text
            x={xPos + xScale.bandwidth() / 2}
            y={yFromValue(d.count) - 8}
            text-anchor="middle"
            fill={labelColor}
            font-size="11"
            font-weight="600"
          opacity={highlightedSet.size === 0 || highlightedSet.has(d.month) ? 1 : 0.35}
            >
            {d.count.toLocaleString()}
            </text>
        {/each}

        {#each data as d}
          {@const xPos = xScale(d.month.toString()) ?? 0}
            <text
          x={xPos + xScale.bandwidth() / 2}
            y={innerHeight + 20}
            text-anchor="middle"
            fill={labelColor}
            font-size="12"
            opacity={highlightedSet.size === 0 || highlightedSet.has(d.month) ? 1 : 0.35}
            >
            {monthNames[d.month - 1] || d.month}
            </text>
        {/each}
        </g>
  </svg>
{:else}
  <p>Loading run data...</p>
{/if}

<style>
  rect {
    transition: fill 0.25s, opacity 0.25s;
  }
  .grid-line {
    transition: opacity 0.2s;
  }
   rect:hover {
    /* fill: #26c6da; Cyan highlight from your previous theme */
    opacity: 1;
  }
  

</style>