<script lang="ts">
  import * as d3 from "d3";
  import { onMount } from "svelte";
  import type { TRun } from "../../types";
  import PaceTrend from "$lib/PaceTrend.svelte";

  let runs: TRun[] = [];
  let startYear = 2012;
  let endYear = 2020;
  let metric: "pace" | "runs" = "pace";
  let activeData: TRun[] = [];

  async function loadCsv() {
    try {
      const csvUrl = "./monthly_pace_by_tier.csv";
      runs = [...await d3.csv(csvUrl, (row) => {
        return {
          tier: row.tier,
          year_month: new Date(row.year_month),
          median_pace: Number(row.median_pace),
          p25: Number(row.p25),
          p75: Number(row.p75),
          run_count: Number(row.run_count),
          avg_runs_per_athlete: Number(row.avg_runs_per_athlete),
        };
      })];
      console.log("Loaded CSV Data:", runs);
      updateChart(); // compute activeData after data loads
    } catch (error) {
      console.error("Error loading CSV:", error);
    }
  }

  // single function that does what both $: blocks were doing
  function updateChart() {
    const filtered = runs.filter(d => {
      const year = d.year_month.getFullYear();
      return year >= startYear && year <= endYear;
    });

    activeData = filtered.map(d => ({
      ...d,
      median_pace: metric === "pace" ? d.median_pace : d.avg_runs_per_athlete,
      p25: metric === "pace" ? d.p25 : d.avg_runs_per_athlete * 0.85,
      p75: metric === "pace" ? d.p75 : d.avg_runs_per_athlete * 1.15,
    }));
  }

  function setMetric(m: "pace" | "runs") {
    metric = m;
    updateChart();
  }

  function setStartYear(e: Event) {
    startYear = Number((e.target as HTMLInputElement).value);
    updateChart();
  }

  function setEndYear(e: Event) {
    endYear = Number((e.target as HTMLInputElement).value);
    updateChart();
  }

  onMount(loadCsv);
</script>

<h1>Running Performance Analysis</h1>
<p>Does consistency improve your pace over time?</p>
<p>{runs.length === 0 ? "Loading..." : runs.length + " monthly data points loaded"}</p>

<div class="controls">
  <div class="slider-row">
    <label>From: <strong>{startYear}</strong></label>
    <input type="range" min="2012" max="2020" step="1" value={startYear} on:input={setStartYear} />
  </div>
  <div class="slider-row">
    <label>To: <strong>{endYear}</strong></label>
    <input type="range" min="2012" max="2020" step="1" value={endYear} on:input={setEndYear} />
  </div>
</div>

<button
  class:active={metric === "runs"}
  on:click={() => setMetric("runs")}
>
  Avg runs per month
</button>

<button
  class:active={metric === "pace"}
  on:click={() => setMetric("pace")}
>
  Avg pace per month
</button>

<PaceTrend
  runs={activeData}
  yLabel={metric === "pace" ? "Avg pace (min/km)" : "Avg runs per athlete per month"}
/>

<style>
  .controls {
    display: flex;
    gap: 24px;
    margin: 16px 0;
    flex-wrap: wrap;
  }
  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
  }
  button.active {
    background: #ff6f00;
    color: white;
    border-color: transparent;
  }
</style>