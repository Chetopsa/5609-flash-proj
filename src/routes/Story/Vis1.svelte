<script lang="ts">
  import * as d3 from "d3";
  import { onMount } from "svelte";
  import type { TTrajectory, TIndividual } from "../../types";
  import { Scroll } from "$lib";
  import PaceTrend from "$lib/PaceTrend.svelte";
  import VolumeOverview from "$lib/VolumeOverview.svelte";
  import PaceCalculator from "$lib/PaceCalculator.svelte";

  let data: TTrajectory[]        = [];
  let individuals: TIndividual[] = [];
  let raceStats: any[]           = [];

  let maxRuns = 100;
  let activeData: TTrajectory[]      = [];
  let selectedAthlete: string | null = null;
  let progress = 0;
  let userControl = false;

  async function loadCsv() {
    try {
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
        d3.csv("./annotated-running-races.csv", d3.autoType),
      ]);

      data        = [...rawData];
      individuals = [...rawInd];
      raceStats   = [...rawRaces];

      updateChart();
    } catch (err) {
      console.error("Error loading CSVs:", err);
    }
  }

  function updateChart() {
    activeData = data.filter(d => d.run_number <= maxRuns);
  }

  function setMaxRuns(e: Event) {
    maxRuns = Number((e.target as HTMLInputElement).value);
    updateChart();
  }

  function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

  function representativeByGroup(group: "low" | "mid" | "high") {
    const runners = individuals
      .filter(r => r.group === group)
      .sort((a, b) => a.avg_pace - b.avg_pace);
    if (!runners.length) return null;
    return runners[Math.floor(runners.length / 2)].athlete;
  }

  function pickDistinctByGroup(group: "low" | "mid" | "high", count = 3) {
    const runners = sortedIndividuals.filter(r => r.group === group);
    if (!runners.length) return [] as string[];
    if (runners.length <= count) return runners.map(r => r.athlete);
    const picks: string[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i * (runners.length - 1)) / (count - 1));
      picks.push(runners[idx].athlete);
    }
    return Array.from(new Set(picks));
  }

  const GROUP_LABEL: Record<string, string> = {
    low:  "Low volume",
    mid:  "Mid volume",
    high: "High volume",
  };

  $: overviewOpacity =
    progress < 2 ? 0 : 
    progress < 35 ? 1 :
    progress < 38 ? 1 - (progress - 35) / 5 :
    0;

  $: mainChartOpacity =
    progress < 40 ? 0 :
    progress < 40 ? (progress - 35) / 5 :
    progress < 90 ? 1 :
    progress < 92 ? 1 - (progress - 90) / 5 :
    0;

  $: calcOpacity =
    progress < 95 ? 0 :
    progress < 99 ? (progress - 95) / 5 :
    1;

  $: overviewInteractive  = overviewOpacity  > 0.05;
  $: mainChartInteractive = mainChartOpacity > 0.05;
  $: calcInteractive      = calcOpacity      > 0.05;

  // spotlight runner
  $: scrollPhase = (
    progress < 42 ? "low"  :
    progress < 56 ? "mid"  :
                    "high"
  ) as "low" | "mid" | "high";

  $: sortedIndividuals = [...individuals].sort((a, b) => {
    const order = { high: 0, mid: 1, low: 2 };
    const gDiff = (order[a.group] ?? 1) - (order[b.group] ?? 1);
    return gDiff !== 0 ? gDiff : a.avg_pace - b.avg_pace;
  });

  $: lowRunner  = representativeByGroup("low");
  $: midRunner  = representativeByGroup("mid");
  $: highRunner = representativeByGroup("high");

  $: lowShowcase  = pickDistinctByGroup("low",  3);
  $: midShowcase  = pickDistinctByGroup("mid",  3);
  $: highShowcase = pickDistinctByGroup("high", 3);
  $: showcaseRunners = [
    ...lowShowcase.map(athlete  => ({ athlete, group: "low"  as const })),
    ...midShowcase.map(athlete  => ({ athlete, group: "mid"  as const })),
    ...highShowcase.map(athlete => ({ athlete, group: "high" as const })),
  ];

  $: inShowcasePhase  = progress >= 84;
  $: showcaseProgress = Math.max(0, Math.min(1, (progress - 84) / 16));
  $: showcaseIndex    = showcaseRunners.length
    ? Math.min(showcaseRunners.length - 1, Math.floor(showcaseProgress * showcaseRunners.length))
    : -1;
  $: showcaseRunner = showcaseIndex >= 0 ? showcaseRunners[showcaseIndex] : null;

  $: representativeRunner =
    scrollPhase === "mid"  ? midRunner  :
    scrollPhase === "high" ? highRunner : lowRunner;

  $: scrollRunner   = inShowcasePhase ? (showcaseRunner?.athlete ?? representativeRunner) : representativeRunner;
  $: spotlightGroup = (inShowcasePhase ? (showcaseRunner?.group ?? scrollPhase) : scrollPhase) as "low" | "mid" | "high";

  let manualMode = false;

  function toggleMode() {
    manualMode = !manualMode;
    if (!manualMode) {
      maxRuns = roundedScrollMaxRuns;
      updateChart();
    }
  }
  $: effectiveSelectedAthlete = selectedAthlete ?? scrollRunner;

  $: scrollMaxRuns =
    Math.min(450, 
      progress < 20
      ? lerp(100, 160, progress / 20)
      : progress < 60
        ? lerp(160, 320, (progress - 20) / 40)
        : lerp(320, 500, (progress - 60) / 40)
    );

  $: roundedScrollMaxRuns = Math.round(scrollMaxRuns / 10) * 10;
  $: {
    if (!manualMode && maxRuns !== roundedScrollMaxRuns) {
      maxRuns = roundedScrollMaxRuns;
      updateChart();
    }
}

  onMount(loadCsv);
</script>

<Scroll bind:progress --scrolly-story-width="1fr" --scrolly-viz-width="2.5fr">

  <!-- <div class="debug-progress">
    {progress.toFixed(1)}
  </div> -->
  <div class="story-steps">

    <!-- ① Intro -->
    <section class="step">
      <h2>How Running Volume Affects Pace</h2>
      <p class="subtitle">
        We tracked 100+ Strava athletes and split them into three tiers based on how often
        they run each week — then followed every run they logged.
      </p>
      <p>
        <span class="pill low">Low volume</span> runners average just <strong>1.5 runs/week</strong>.
        <span class="pill mid">Mid volume</span> runners average <strong>2.5 runs/week</strong>.
        <span class="pill high">High volume</span> runners average <strong>4.9 runs/week</strong>.
      </p>
      <p>Scroll to see how the different groups vary overtime</p>
    </section>

    <!-- ② How tiers are defined — overview charts animate in -->
    <section class="step">
      <h2>How the tiers are defined</h2>
      <p>
        The splits are percentile-based. The <strong>bottom 33%</strong> contains runners who run a low amount
        per week as the <strong>middle 34%</strong>, and the <strong>top
        33%</strong> are run at higher amounts, depicted in the bell curve.
      </p>
      <p>
        The bell curve shows most runners cluster around <strong>2–3 runs/week</strong> within the middle 34%,. The tails are thin,
        meaning moving from low to mid is achievable for most people with just one extra run per week to build that consistency.
      </p>
    </section>

    <!-- ③ Low volume — overview fades out, main chart fades in -->
    <section class="step">
      <h2>Low Volume Runners (Bottom 33%)</h2>
      <p>
        At fewer than 1.8 runs/week, these athletes start with the slowest paces —
        <strong>5.46–6.98 min/km</strong> — and slowly improve over time
      </p>
      <p>
        The spike between <strong>runs 70-90</strong> suggests that newer or less consistent runners have more variability and
        show less progress due to that inconsistency 
      </p>
    </section>

    <!-- ④ Mid volume -->
    <section class="step">
      <h2>Mid Volume Runners (Middle 34%)</h2>
      <p>
        At 1.8–3.5 runs/week, the improvement curve steepens. The mid-volume pace range —
        <strong>5.38–6.32 min/km</strong> — is noticeably tighter and faster than the low group,
        and the gap keeps slowly widening the more runs they log.
      </p>
      <p>
        Just adding one extra run per week relative to the low group drives a meaningful long-term
        difference. This is where habit kicks in and improvements are more noticeable.
      </p>
    </section>

    <!-- ⑤ High volume -->
    <section class="step">
      <h2>High Volume Runners (Top 33%)</h2>
      <p>
        Above 3.5 runs/week, improvement is fastest and most consistent. The high-volume band
        sits at <strong>4.81–5.89 min/km</strong> and continues to compress over 500 runs as the
        aerobic base deepens.
      </p>
      <p>
        Frequency, and not any type of workout, is the main driver for pace improvement overtime between all groups
      </p>
    </section>

    <section class="step">
      <h2>The gap IS REAL, but it is Closeable</h2>
      <p>
        Across all three groups the trend is similar in shape, only the level differs. The
        high-volume band is roughly <strong>a full minute per kilometre faster</strong> than the
        low-volume band at the same number of cumulative runs.
      </p>
      <p>
        But moving from low to mid requires only <strong>one extra run per week</strong>. You
        don't need elite training volume to see elite-relative gains, you just need to show up one more time per week
        to see good improvements!!
      </p>
    </section>

    <!-- ⑦ Calculator -->
    <section class="step">
      <h2>Find Your Tier 😈</h2>
      <p>
        Enter your average runs per week and your current pace in the panel on the right.
        You'll see which group you belong to and what it would take to move up.
      </p>
      <p class="hint">
        You can also pick any athlete from the dropdown to trace their personal trajectory
        against the group medians.
      </p>
    </section>

  </div>

  <div slot="viz" class="viz-panel">

    <!-- ① Overview: bar chart + bell curve -->
    <div
      class="abs-layer-summary"
      style="opacity:{overviewOpacity}; pointer-events:{overviewInteractive ? 'auto' : 'none'};"
      aria-hidden={!overviewInteractive}
    >
      <VolumeOverview {progress} />
    </div>

    <!-- ② Main PaceTrend chart -->
    <div
      class="abs-layer"
      style="opacity:{mainChartOpacity}; pointer-events:{mainChartInteractive ? 'auto' : 'none'};"
      aria-hidden={!mainChartInteractive}
    >
      <h1>How Consistency Effects Pace Overtime</h1>

      <div class="controls">
        <div class="control-row">
          <span>Runs 1–<strong>{Math.min(450, maxRuns)}</strong></span>
          <input
            type="range" min="10" max="450" step="10"
            value={Math.min(450, maxRuns)} on:input={setMaxRuns}
            disabled={!manualMode}
            class:active-slider={manualMode}
          />
          <button
            class="mode-toggle"
            class:manual={manualMode}
            on:click={toggleMode}
            title={manualMode ? "Switch to scroll-driven" : "Switch to manual control"}
          >
            {manualMode ? "⟳ Auto" : "⊟ Manual"}
          </button>
        </div>

        <div class="control-row">
          <span class="spotlight">
            Spotlight: {effectiveSelectedAthlete ? `#${effectiveSelectedAthlete}` : "none"}
            ({GROUP_LABEL[spotlightGroup]}
            {#if inShowcasePhase && showcaseRunners.length}
              · {showcaseIndex + 1}/{showcaseRunners.length}
            {/if})
          </span>
        </div>

        <div class="control-row">
          <select bind:value={selectedAthlete}>
            <option value={null}>— Select a runner —</option>
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

      <PaceTrend
        data={activeData}
        {individuals}
        selectedAthlete={effectiveSelectedAthlete}
      />
    </div>

    <!-- ③ Calculator — fully interactive, no wrapper interference -->
    {#if calcInteractive}
      <div
        class="abs-layer-calc"
        style="opacity:{calcOpacity};"
      >
        <PaceCalculator />
      </div>
    {/if}

  </div>
</Scroll>

<style>
  h1 { font-size: 24px; font-weight: 600; margin: 0 0 8px; line-height: 1.3; }
  h2 { font-size: 20px; font-weight: 600; margin: 0 0 10px; }

  .subtitle { color: #555; font-size: 15px; margin: 0 0 10px; line-height: 1.55; }
  .hint     { font-size: 12px; color: #999; margin-top: 8px; line-height: 1.5; font-style: italic; }

  .pill      { display: inline-block; padding: 1px 7px; border-radius: 4px; font-size: 13px; font-weight: 600; vertical-align: middle; }
  .pill.low  { background: rgba(78,144,217,0.12); color: #4e90d9; }
  .pill.mid  { background: rgba(46,196,149,0.12); color: #2ec495; }
  .pill.high { background: rgba(240,90,90,0.12);  color: #f05a5a; }

  /* story column */
  .story-steps { padding-right: 1.2rem; min-width: 10rem; }
  .step {
    min-height: 80vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 52rem;
  }
  .step p { line-height: 1.65; margin-bottom: 0.75rem; }
  .step p:last-child { margin-bottom: 0; }

  /* viz panel — sticky, occupies the full height of the viewport */
  .viz-panel {
    position: relative;
    /* tall enough so absolute children don't clip */
    min-height: 80vh;
    margin-top: 4rem;
  }

  /* all layers share the same origin; opacity handles visibility */
  .abs-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    transition: opacity 0.5s ease;
  }

  .abs-layer-summary {
    position: absolute;
    margin-top: 150px;
    top: 0;
    left: 0;
    width: 100%;
    transition: opacity 0.5s ease;
  }
  .abs-layer-calc {
    position: absolute;
    top: 0;
    margin-top: 200px;
    left: 0;
    width: 100%;
    transition: opacity 0.5s ease;
  }

  /* controls */
  .controls    { display: flex; flex-direction: column; gap: 8px; margin: 10px 0 14px; }
  .control-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .control-row input[type="range"] { flex: 0 0 200px; }
  .control-row input[type="range"]:disabled { opacity: 0.5; }
  .spotlight   { color: #495057; font-weight: 600; }
  select       { font-size: 13px; padding: 4px 8px; border-radius: 6px; border: 1px solid #ccc; max-width: 300px; }
  .clear-btn   { background: none; border: none; color: #aaa; cursor: pointer; font-size: 12px; }
  .debug-progress {
  position: fixed;
  top: 10px;
  right: 10px;
  background: black;
  color: white;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  z-index: 9999;
  opacity: 0.8;
  font-family: monospace;
}
</style>