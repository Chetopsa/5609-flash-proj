<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  // Data structure
  export let csvPath = "month_runs_total.csv";
  let data: { month: number, count: number }[] = [];

  // Dimensions
  const width = 800;
  const height = 400;
  const margin = { top: 50, right: 30, bottom: 80, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

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

  $: yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.count) || 0])
    .nice()
    .range([innerHeight, 0]);

  // Helpers for month names if you want them instead of numbers
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
</script>

{#if data.length > 0}
  <svg 
    {width} {height} 
    viewBox="0 0 {width} {height}" 
    style="max-width: 100%; height: auto;"
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
        {#each yScale.ticks(5) as tick}
            <g class="grid-line" transform="translate(0, {yScale(tick)})">
            <line x2={innerWidth} stroke="#e0e0e0" stroke-dasharray="4" />
            <text x="-10" dy="0.32em" text-anchor="end" fill={labelColor} font-size="12">
                {tick.toLocaleString()}
            </text>
            </g>
        {/each}

        {#each data as d}
            <rect
            x={xScale(d.month.toString())}
            y={yScale(d.count)}
            width={xScale.bandwidth()}
            height={innerHeight - yScale(d.count)}
            fill={barColor}
            rx="4"
            />

            <text
            x={xScale(d.month.toString()) + xScale.bandwidth() / 2}
            y={yScale(d.count) - 8}
            text-anchor="middle"
            fill={labelColor}
            font-size="11"
            font-weight="600"
            >
            {d.count.toLocaleString()}
            </text>
        {/each}

        {#each data as d}
            <text
            x={xScale(d.month.toString()) + xScale.bandwidth() / 2}
            y={innerHeight + 20}
            text-anchor="middle"
            fill={labelColor}
            font-size="12"
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
    transition: fill 0.2s, opacity 0.2s;
  }
  rect:hover {
    fill: #26c6da; /* Cyan highlight from your previous theme */
  }
</style>