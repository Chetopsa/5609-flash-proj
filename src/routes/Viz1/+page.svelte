<script lang="ts">
  import * as d3 from "d3";
  import { onMount } from "svelte";
  import type { TTrajectory, TIndividual } from "../../types";
  import PaceTrend from "$lib/PaceTrend.svelte";
  import VolumeSummary from "$lib/VolumeSummary.svelte";

  let data: TTrajectory[] = [];
  let individuals: TIndividual[] = [];
  let raceStats: any[] = []; // New variable for the annotated races
  
  let maxRuns = 100;
  let activeData: TTrajectory[] = [];
  let selectedAthlete: string | null = null;

  async function loadCsv() {
    try {
      // 1. Load all three CSVs simultaneously
      const [rawData, rawInd, rawRaces] = await Promise.all([
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
        })),
        d3.csv("./annotated-running-races.csv", d3.autoType) // Use autoType to handle numbers automatically
      ]);

      data = [...rawData];
      individuals = [...rawInd];
      raceStats = [...rawRaces];
      
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

  $: sortedIndividuals = [...individuals].sort((a, b) => {
    const order = { high: 0, mid: 1, low: 2 };
    const gDiff = (order[a.group] ?? 1) - (order[b.group] ?? 1);
    return gDiff !== 0 ? gDiff : a.avg_pace - b.avg_pace;
  });

  onMount(loadCsv);
</script>

<h1>Pace Improvement Analysis</h1>
<p class="subtitle">
  Does accumulating more runs improve your pace?
</p>

<div class="controls">
  <div class="control-row">
    <span>Runs 1 to <strong>{maxRuns}</strong></span>
    <input
      type="range" min="10" max="500" step="10"
      value={maxRuns} on:input={setMaxRuns}
    />
  </div>

  <div class="control-row">
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
    <VolumeSummary {activeData} {raceStats} />
  </div>
    
    <div class="analysis-content">
      <slot />
    </div>
  </div>

<style>
  /* Keep your existing styles */
  h1 { font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #888; font-size: 14px; margin-top: -4px; margin-bottom: 0; }
  .controls { display: flex; flex-direction: column; gap: 10px; margin: 16px 0 20px; }
  .control-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .control-row input[type="range"] { flex: 0 0 160px; }
  select { font-size: 13px; padding: 5px 8px; border-radius: 6px; border: 1px solid #ccc; max-width: 250px; }
  .clear-btn { background: none; border: none; color: #999; cursor: pointer; font-size: 12px; }
  
  .chart-layout {
    display: flex;
    flex-direction: row; /* Ensure they are side-by-side */
    align-items: flex-start;
    gap: 40px; /* Space between the charts */
    width: 100%;
    margin-top: 20px;
  }

  .chart-col {
    flex: 0 0 1000px; /* Force the main chart to stay at 1000px */
    min-width: 0;   /* Prevents flex items from overflowing */
  }

  .text-col {
    flex: 0 0 320px; /* Give the sidebar a fixed width */
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .analysis-content { margin-top: 20px; }
</style>