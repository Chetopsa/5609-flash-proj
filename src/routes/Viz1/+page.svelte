<script lang="ts">
  import * as d3 from "d3";
  import { onMount } from "svelte";
  import type { TTrajectory, TIndividual } from "../../types";
  import PaceTrend from "$lib/PaceTrend.svelte";

  let data: TTrajectory[] = [];
  let individuals: TIndividual[] = [];
  let maxRuns = 100;
  let activeData: TTrajectory[] = [];
  let selectedAthlete: string | null = null;

  // Loading Data from the CSVs
  async function loadCsv() {
    try {
      const [rawData, rawInd] = await Promise.all([
        d3.csv("./runner_trajectories.csv", (row) => ({
          athlete:    row.athlete,
          run_number: Number(row.run_number),
          pace:       Number(row.pace),
          pace_raw:   Number(row.pace_raw),
          group:      row.group as "low" | "mid" | "high",
        })),
        d3.csv("./trajectory_individual.csv", (row) => ({
          athlete:        row.athlete,
          group:          row.group as "low" | "mid" | "high",
          percentile_raw: Number(row.percentile_raw),
          total_runs:     Number(row.total_runs),
          avg_pace:       Number(row.avg_pace),
        }))
      ]);

      data        = [...rawData];
      individuals = [...rawInd];
      updateChart();
    } catch (error) {
      console.error("Error loading CSVs:", error);
    }
  }

  function updateChart() {
    activeData = data.filter(d => d.run_number <= maxRuns);
  }

  function setMaxRuns(e: Event) {
    maxRuns = Number((e.target as HTMLInputElement).value);
    updateChart();
  }

  const GROUP_LABEL: Record<string, string> = {
    low:  "Low volume",
    mid:  "Mid volume",
    high: "High volume",
  };

  const GROUP_COLOR: Record<string, string> = {
    low:  "#d4537e",
    mid:  "#26c6da",
    high: "#ff6f00",
  };

  // sort dropdown: high → mid → low, then by avg_pace within group
  $: sortedIndividuals = [...individuals].sort((a, b) => {
    const order = { high: 0, mid: 1, low: 2 };
    const gDiff = (order[a.group] ?? 1) - (order[b.group] ?? 1);
    return gDiff !== 0 ? gDiff : a.avg_pace - b.avg_pace;
  });

  $: selectedMeta = selectedAthlete
    ? individuals.find(i => i.athlete === selectedAthlete) ?? null
    : null;

  onMount(loadCsv);
</script>

<h1>Pace Imporvement Analysis</h1>
<p class="subtitle">
  Does accumulating more runs improve your pace?
</p>

<div class="controls">
  <div class="control-row">
    <text>Runs 1 to <strong>{maxRuns}</strong></text>
    <input
      type="range" min="10" max="500" step="10"
      value={maxRuns} on:input={setMaxRuns}
    />
  </div>

  <div class="control-row">
    <!-- <label for="athlete-select">Overlay runner</label> -->
    <select id="athlete-select" bind:value={selectedAthlete}>
      <option value={null}>— none —</option>
      {#each sortedIndividuals as ind}
        <option value={ind.athlete}>
          #{ind.athlete} · {GROUP_LABEL[ind.group]} · {ind.total_runs} runs
        </option>
      {/each}
    </select>
    {#if selectedAthlete}
      <button class="clear-btn" on:click={() => selectedAthlete = null}>✕ clear</button>
    {/if}
  </div>
</div>

<div class="chart-layout">
  <div class="chart-col">
    <PaceTrend
      data={activeData}
      {individuals}
      {selectedAthlete}
    />
  </div>

  <div class="text-col">
    <slot />
  </div>
</div>

<style>
  h1 { font-size: 20px; margin-bottom: 4px; }

  .subtitle {
    color: #888;
    font-size: 14px;
    margin-top: -4px;
    margin-bottom: 0;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 16px 0 20px;
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 13px;
  }

  .control-row input[type="range"] {
    flex: 1;
    min-width: 160px;
    max-width: 160px;
  }

  select {
    font-size: 13px;
    padding: 5px 8px;
    border-radius: 6px;
    border: 1px solid #ccc;
    background: #fff;
    cursor: pointer;
    flex: 1;
    min-width: 220px;
    max-width: 250px;
  }

  .clear-btn {
    background: none;
    border: none;
    color: #999;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 6px;
  }
  .clear-btn:hover { color: #555; }

  .chart-layout {
    display: flex;
    align-items: flex-start;
    gap: 28px;
  }

  .chart-col {
    flex: 0 0 auto;
    min-width: 0;
  }

  .text-col {
    flex: 1 1 0;
    min-width: 0;
    font-size: 14px;
    line-height: 1.7;
    color: #444;
    padding-top: 4px;
  }
</style>