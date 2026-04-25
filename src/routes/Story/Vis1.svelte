<script lang="ts">
  import * as d3 from "d3";
  import { onMount } from "svelte";
  import type { TTrajectory, TIndividual } from "../../types";
  import { Scroll } from "$lib";
  import PaceTrend from "$lib/PaceTrend.svelte";
  import VolumeSummary from "$lib/VolumeSummary.svelte";

  let data: TTrajectory[] = [];
  let individuals: TIndividual[] = [];
  let raceStats: any[] = []; // New variable for the annotated races
  
  let maxRuns = 100;
  let activeData: TTrajectory[] = [];
  let selectedAthlete: string | null = null;
  let progress = 0;
  let userControl = false;

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

  function lerp(start: number, end: number, t: number) {
    return start + (end - start) * t;
  }

  function representativeByGroup(group: "low" | "mid" | "high") {
    const groupRunners = individuals
      .filter((runner) => runner.group === group)
      .sort((a, b) => a.avg_pace - b.avg_pace);

    if (!groupRunners.length) return null;
    return groupRunners[Math.floor(groupRunners.length / 2)].athlete;
  }

  function pickDistinctByGroup(group: "low" | "mid" | "high", count = 3) {
    const groupRunners = sortedIndividuals.filter((runner) => runner.group === group);
    if (!groupRunners.length) return [] as string[];

    if (groupRunners.length <= count) {
      return groupRunners.map((runner) => runner.athlete);
    }

    const picks: string[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i * (groupRunners.length - 1)) / (count - 1));
      picks.push(groupRunners[idx].athlete);
    }
    return Array.from(new Set(picks));
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

  $: lowRunner = representativeByGroup("low");
  $: midRunner = representativeByGroup("mid");
  $: highRunner = representativeByGroup("high");

  $: lowShowcase = pickDistinctByGroup("low", 3);
  $: midShowcase = pickDistinctByGroup("mid", 3);
  $: highShowcase = pickDistinctByGroup("high", 3);
  $: showcaseRunners = [
    ...lowShowcase.map((athlete) => ({ athlete, group: "low" as const })),
    ...midShowcase.map((athlete) => ({ athlete, group: "mid" as const })),
    ...highShowcase.map((athlete) => ({ athlete, group: "high" as const }))
  ];

  $: inShowcasePhase = progress >= 80;
  $: scrollPhase = (progress < 26.7 ? "low" : progress < 53.4 ? "mid" : "high") as "low" | "mid" | "high";
  $: representativeRunner = scrollPhase === "low" ? lowRunner : scrollPhase === "mid" ? midRunner : highRunner;

  $: showcaseProgress = Math.max(0, Math.min(1, (progress - 80) / 20));
  $: showcaseIndex = showcaseRunners.length
    ? Math.min(showcaseRunners.length - 1, Math.floor(showcaseProgress * showcaseRunners.length))
    : -1;
  $: showcaseRunner = showcaseIndex >= 0 ? showcaseRunners[showcaseIndex] : null;

  $: scrollRunner = inShowcasePhase ? showcaseRunner?.athlete ?? representativeRunner : representativeRunner;
  $: spotlightGroup = inShowcasePhase ? (showcaseRunner?.group ?? scrollPhase) : scrollPhase;

  $: manualSelectionUnlocked = progress >= 97;
  $: if (progress >= 97) {
    userControl = true;
  }
  $: effectiveSelectedAthlete = manualSelectionUnlocked && selectedAthlete ? selectedAthlete : scrollRunner;

  $: scrollMaxRuns =
    progress < 40
      ? lerp(100, 160, progress / 40)
      : progress < 75
        ? lerp(160, 320, (progress - 40) / 35)
        : lerp(320, 500, (progress - 75) / 25);

  $: roundedScrollMaxRuns = Math.round(scrollMaxRuns / 10) * 10;
  $: {
    if (!userControl && maxRuns !== roundedScrollMaxRuns) {
      maxRuns = roundedScrollMaxRuns;
      updateChart();
    }
}

  onMount(loadCsv);
</script>
<Scroll bind:progress --scrolly-story-width="1fr" --scrolly-viz-width="0.4fr">

  <div class="story-steps">
    <section class="step">
      <p class="subtitle">
        We grouped over 100+ Strava runners by how frequently they train each week, then tracked every run.
        The gap between tiers tells a clear story.
      </p>
      <p>
        The groups include low, mid, and high volume runners based on average weekly run frequency.
        Low is the 0–33rd percentile range, mid is the 33–67th range, and high is the 67–100th range.
      </p>
    </section>

    <section class="step">
      <h2> Pace over cumulative runs by consistency tier</h2>
      <p>
        Each line shows the rolling median pace (min/km) across the first 500 runs logged.
        Lower numbers on the chart indicate faster paces. The shaded band shows run-to-run variability
        within each group.
      </p>
    </section>

    <section class="step">
      <h2>Analysis</h2>
      <p>
        High volume runners hold an average between 4.81-5.96 min/km, while mid and low volume runners
        show a noticeable gap: around 5.36-6.32 min/km for mid volume runners and 5.58-6.98 min/km for low
        volume runners. High volume runners tend to lower their pace faster, while mid volume runners show a
        more gradual decline that can be beneficial long-term.
      </p>
    </section>

    <section class="step">
      <h2>Takeaway</h2>
      <p>
        If you’re just starting out, consistency matters more than distance or speed.
        Moving from low to mid volume by adding one extra run per week can significantly narrow the pace gap.
        You don’t need to run like a high-volume athlete to see real improvement.
      </p>
    </section>

    <!-- <section class="step">
      <h2>Runner Showcase</h2>
      <p>
        In this final scroll segment, the chart automatically cycles through three distinct runners
        from each consistency group. This makes the between-group differences visible at the individual
        runner level, not just in group medians.
      </p>
    </section> -->
  </div>

  <div slot="viz" class="viz-panel">
    
    <h1>Running more often makes you measurably faster</h1>
    <div class="controls">
      <div class="control-row">
        <span>
          Runs 1 to <strong>{maxRuns}</strong>
          {#if !userControl}
            <small style="color:#888;">(scroll controlled)</small>
          {/if}
        </span>

        <button
          class="toggle-btn"
          on:click={() => userControl = !userControl}
        >
          {userControl ? "Lock to scroll" : "Adjust runs manually"}
        </button>
        <input
          type="range"
          min="10"
          max="500"
          step="10"
          bind:value={maxRuns}
          on:input={(e) => {
            userControl = true;
            setMaxRuns(e);
          }}
        />
      </div>

      <div class="control-row">
        <span class="spotlight">
          Spotlight runner: {effectiveSelectedAthlete ? `#${effectiveSelectedAthlete}` : "none"}
          ({GROUP_LABEL[spotlightGroup]}
          {#if inShowcasePhase && showcaseRunners.length}
            · showcase {showcaseIndex + 1}/{showcaseRunners.length}
          {/if})
        </span>
      </div>

      <div class="control-row">
        <select id="athlete-select" bind:value={selectedAthlete} disabled={!manualSelectionUnlocked}>
          <option value={null}>— Select a runner —</option>
          {#each sortedIndividuals as ind}
            <option value={ind.athlete}>
              #{ind.athlete} · {GROUP_LABEL[ind.group]} · {ind.total_runs} runs
            </option>
          {/each}
        </select>
        {#if selectedAthlete && manualSelectionUnlocked}
          <button class="clear-btn" on:click={() => selectedAthlete = null}>✕ clear</button>
        {/if}
       
      </div>
    </div>

    <div class="chart-layout">
      <div class="chart-col">
        <PaceTrend
          data={activeData}
          {individuals}
          selectedAthlete={effectiveSelectedAthlete}
        />
      </div>

      <div class="text-col">
        <VolumeSummary {activeData} {raceStats} />
      </div>
    </div>
  </div>
</Scroll>

<style>
  h1 { font-size: 28px; margin-bottom: 10px; }
  h2 { font-size: 22px; margin: 0 0 8px; }
  .subtitle { color: #555; font-size: 16px; margin: 0 0 12px; line-height: 1.5; }
  .story-steps { padding-right: 0.8rem; min-width: 10rem; }
  .step {
    min-height: 78vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 56rem;
  }
  .step p { line-height: 1.62; }
  /* .runner-callout { margin-top: 10px; font-weight: 600; color: #495057; } */



  .viz-panel { min-height: 92vh; margin-top: 5rem; }
  .controls { display: flex; flex-direction: column; gap: 10px; margin: 16px 0 20px; }
  .control-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .control-row input[type="range"] { flex: 0 0 220px; }
  .control-row input[type="range"]:disabled {
    opacity: 0.55;
  }
  .spotlight { color: #495057; font-weight: 600; }
  select { font-size: 13px; padding: 5px 8px; border-radius: 6px; border: 1px solid #ccc; max-width: 320px; }
  .clear-btn { background: none; border: none; color: #999; cursor: pointer; font-size: 12px; }
  
  .chart-layout {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 110px;
    width: 100%;
    margin-top: 20px;
  }

  .chart-col {
    flex: 0 0 750px;
    min-width: 0;
  }

  .text-col {
    flex: 0 0 320px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
</style>