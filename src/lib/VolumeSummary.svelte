<script lang="ts">
  import * as d3 from "d3";

  export let activeData: any[] = []; 
  export let raceStats: any[] = [];

  const width = 300;
  const height = 180;
  const margin = { top: 10, right: 40, bottom: 20, left: 80 };

  const GROUP_COLOR: Record<string, string> = {
    low: "#d4537e",
    mid: "#26c6da",
    high: "#ff6f00",
  };
  const GROUPS = ["low", "mid", "high"];

  // 1. Create a lookup Map (Force athlete IDs to Strings)
  $: freqMap = new Map(raceStats.map(d => [String(d.athlete), +d.avg_runs_per_week]));

  // 2. Calculate average for the three groups
  $: stats = GROUPS.map(grp => {
    // Get unique athletes currently in this group
    const athletesInGroup = [...new Set(
      activeData.filter(d => d.group === grp).map(d => String(d.athlete))
    )];
    
    // Get their frequencies from the map
    const frequencies = athletesInGroup
      .map(id => freqMap.get(id))
      .filter(f => f !== undefined) as number[];

    return { 
      grp, 
      avg: d3.mean(frequencies) || 0 
    };
  });

  // 3. Scales
  $: xScale = d3.scaleLinear()
    .domain([0, 7]) // 0 to 7 days a week
    .range([0, width - margin.left - margin.right]);

  $: yScale = d3.scaleBand()
    .domain(GROUPS)
    .range([0, height - margin.top - margin.bottom])
    .padding(0.3);
</script>

<div class="summary-box">
  <p class="unit">Avg. Runs Per Week</p>
  
  {#if activeData.length > 0 && raceStats.length > 0}
    <svg {width} 
        {height}
        viewBox="0 0 {width} {height}"
        preserveAspectRatio="xMidYMid meet"
        style="width: 100%; height: auto; display: block;">
      <g transform="translate({margin.left}, {margin.top})">
        {#each stats as { grp, avg }}
          <rect
            x={0}
            y={yScale(grp)}
            width={xScale(avg)}
            height={yScale.bandwidth()}
            fill={GROUP_COLOR[grp]}
            rx="4"
          />
          
          <text
            x={-10}
            y={yScale(grp) + yScale.bandwidth() / 2}
            text-anchor="end"
            dominant-baseline="middle"
            class="label"
          >
            {grp}
          </text>

          <text
            x={xScale(avg) + 5}
            y={yScale(grp) + yScale.bandwidth() / 2}
            dominant-baseline="middle"
            class="value"
            fill={GROUP_COLOR[grp]}
          >
            {avg.toFixed(1)}
          </text>
        {/each}
        
        {#each [1, 3, 5] as tick}
          <line x1={xScale(tick)} y1={0} x2={xScale(tick)} y2={height - 35} stroke="#f0f0f0" />
        {/each}
      </g>
    </svg>
  {:else}
    <p class="loading">Calculating stats...</p>
  {/if}
</div>

<style>
  .summary-box {
    background: #f9fafb;
    padding: 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
  }
  .unit { 
    margin: 0 0 12px 0; 
    font-size: 11px; 
    color: #6b7280; 
    font-weight: bold;
    text-transform: uppercase; 
  }
  .label { font-size: 11px; fill: #4b5563; font-weight: 600; text-transform: capitalize; }
  .value { font-size: 13px; font-weight: 800; }
  .loading { font-size: 12px; color: #999; font-style: italic; }
</style>