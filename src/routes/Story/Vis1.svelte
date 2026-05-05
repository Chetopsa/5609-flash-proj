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
    const runners = individuals.filter(r => r.group === group).sort((a, b) => a.avg_pace - b.avg_pace);
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
    ...lowShowcase.map(a  => ({ athlete: a, group: "low"  as const })),
    ...midShowcase.map(a  => ({ athlete: a, group: "mid"  as const })),
    ...highShowcase.map(a => ({ athlete: a, group: "high" as const })),
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

  $: scrollMaxRuns = Math.min(450,
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

  <div class="story-steps">

    <section class="step">
      <p class="step-label">
        <span class="step-pip"></span>Part 1 — Volume & Pace
      </p>
      <h2>How running volume shapes your pace over time</h2>
      <p>
        We tracked 100+ Strava athletes, splitting them into three tiers based on
        weekly run frequency — then followed every run they logged.
      </p>
      <div class="tier-chips">
        <div class="chip chip-low">
          <span class="chip-label">Low</span>
          <span class="chip-stat">~1.5 runs/week</span>
        </div>
        <div class="chip chip-mid">
          <span class="chip-label">Mid</span>
          <span class="chip-stat">~2.5 runs/week</span>
        </div>
        <div class="chip chip-high">
          <span class="chip-label">High</span>
          <span class="chip-stat">~4.9 runs/week</span>
        </div>
      </div>
      <p class="scroll-cue">Scroll to see how the groups diverge over time →</p>
    </section>

    <section class="step">
      <h2>How the tiers are defined</h2>
      <p>
        Splits are percentile-based. The <strong>bottom 33%</strong> runs the least,
        the <strong>middle 34%</strong> is the core, and the <strong>top 33%</strong> run
        most frequently.
      </p>
      <p>
        Most runners cluster around 2–3 runs/week — meaning moving from low to mid
        requires just one extra run per week.
      </p>
    </section>

    <section class="step">
      <h2>Low volume</h2>
      <p class="step-stat">Under 1.8 runs / week</p>
      <p>
        These athletes start with the slowest paces — <strong>5.46–6.98 min/km</strong> —
        and improve slowly. Spikes between runs 70–90 reflect the inconsistency that
        comes with lower frequency.
      </p>
    </section>

    <section class="step">
      <h2>Mid volume</h2>
      <p class="step-stat">1.8–3.5 runs / week</p>
      <p>
        The improvement curve steepens. The mid-volume pace range —
        <strong>5.38–6.32 min/km</strong> — is noticeably tighter and faster than the
        low group. Just one extra weekly run drives a meaningful long-term difference.
      </p>
    </section>

    <section class="step">
      <h2>High volume</h2>
      <p class="step-stat">Above 3.5 runs / week</p>
      <p>
        Improvement is fastest and most consistent here. The high-volume band sits at
        <strong>4.81–5.89 min/km</strong> and continues to compress over 500 runs as
        the aerobic base deepens.
      </p>
    </section>

    <section class="step">
      <h2>The gap is real — but closeable</h2>
      <p>
        High-volume runners are roughly <strong>a full minute per km faster</strong> than
        low-volume runners at the same number of cumulative runs.
      </p>
      <p>
        But moving from low to mid requires only <strong>one extra run per week.</strong>
        You don't need elite volume — just one more day.
      </p>
    </section>

    <section class="step">
      <h2>Find your tier</h2>
      <p>
        Enter your weekly run count and current pace in the panel on the right.
        See which group you belong to and what it would take to move up.
      </p>
      <p class="hint">
        You can also pick any athlete from the dropdown to trace their personal
        trajectory against the group medians.
      </p>
    </section>

  </div>

  <div slot="viz" class="viz-panel">

    <div
      class="abs-layer"
      style="opacity:{overviewOpacity}; pointer-events:{overviewInteractive ? 'auto' : 'none'};"
      aria-hidden={!overviewInteractive}
    >
      <VolumeOverview {progress} />
    </div>

    <div
      class="abs-layer"
      style="opacity:{mainChartOpacity}; pointer-events:{mainChartInteractive ? 'auto' : 'none'};"
      aria-hidden={!mainChartInteractive}
    >
      <div class="chart-header">
        <p class="chart-eyebrow">
          <span class="eyebrow-pip"></span>Pace improvement over time
        </p>
        <h3>How consistency affects pace</h3>
      </div>

      <div class="controls">
        <div class="control-row">
          <span class="control-label">Runs 1–<strong>{Math.min(450, maxRuns)}</strong></span>
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
          >{manualMode ? "⟳ Auto" : "⊟ Manual"}</button>
        </div>

        <div class="control-row">
          <span class="spotlight-label">
            Spotlight:
            <strong>{effectiveSelectedAthlete ? `#${effectiveSelectedAthlete}` : "none"}</strong>
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

      <PaceTrend data={activeData} {individuals} selectedAthlete={effectiveSelectedAthlete} />
    </div>

    {#if calcInteractive}
      <div class="abs-layer abs-layer--calc" style="opacity:{calcOpacity};">
        <PaceCalculator />
      </div>
    {/if}
  </div>

</Scroll>

<style>
  .story-steps {
    padding-right: 1.5rem;
    min-width: 10rem;
  }

  .step {
    min-height: 80vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 52rem;
    gap: 0.75rem;
  }

  .step p {
    line-height: 1.65;
    margin: 0;
    font-size: clamp(0.9rem, 1.5vw, 1.02rem);
    color: #3a3428;
  }

  .step strong {
    color: #1a1a18;
    font-weight: 500;
  }

  .step-label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 10px !important;
    font-weight: 500 !important;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #9a8e7a !important;
  }

  .step-pip {
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #b5a882;
  }

  h2 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(1.15rem, 2.2vw, 1.45rem);
    font-weight: 400;
    line-height: 1.25;
    margin: 0;
    color: #1a1a18;
  }

  .step-stat {
    font-size: 0.82rem !important;
    font-weight: 500 !important;
    color: #7a6e5c !important;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .scroll-cue {
    font-size: 0.82rem !important;
    color: #9a9080 !important;
    font-style: italic;
  }

  .hint {
    font-size: 0.82rem !important;
    color: #9a9080 !important;
    font-style: italic;
  }

  .tier-chips {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .chip {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0.85rem;
    border-radius: 8px;
    border: 1px solid;
    gap: 2px;
  }

  .chip-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .chip-stat {
    font-size: 11px;
    opacity: 0.75;
  }

  .chip-low  { background: rgba(78,144,217,0.08);  border-color: rgba(78,144,217,0.25);  color: #3a6fa8; }
  .chip-mid  { background: rgba(46,196,149,0.08);  border-color: rgba(46,196,149,0.25);  color: #1a8f64; }
  .chip-high { background: rgba(240,90,90,0.08);   border-color: rgba(240,90,90,0.25);   color: #c04040; }

  .viz-panel {
    position: relative;
    min-height: 80vh;
    margin-top: 3rem;
  }

  .abs-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    transition: opacity 0.5s ease;
  }

  .abs-layer--calc {
    margin-top: 180px;
  }

  .chart-header {
    margin-bottom: 0.75rem;
  }

  .chart-eyebrow {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #9a8e7a;
    margin: 0 0 0.4rem;
  }

  .eyebrow-pip {
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #b5a882;
  }

  h3 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(1.1rem, 2vw, 1.4rem);
    font-weight: 400;
    margin: 0;
    color: #1a1a18;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0.75rem 0 1rem;
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12.5px;
    color: #5a5248;
  }

  .control-label { min-width: 96px; }

  .control-row input[type="range"] {
    flex: 0 0 180px;
    accent-color: #3a5c38;
  }

  .control-row input[type="range"]:disabled { opacity: 0.4; }
  .active-slider { accent-color: #e05050 !important; }

  .spotlight-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: #5a5248;
  }

  .group-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 20px;
    letter-spacing: 0.04em;
  }

  .group-badge--low  { background: rgba(78,144,217,0.1);  color: #3a6fa8; }
  .group-badge--mid  { background: rgba(46,196,149,0.1);  color: #1a8f64; }
  .group-badge--high { background: rgba(240,90,90,0.1);   color: #c04040; }

  select {
    font-size: 12.5px;
    padding: 4px 8px;
    border-radius: 7px;
    border: 1px solid #d4ccbc;
    background: #faf8f4;
    color: #3a3428;
    max-width: 280px;
    cursor: pointer;
  }

  .mode-toggle {
    padding: 3px 10px;
    font-size: 11.5px;
    border-radius: 6px;
    border: 1px solid #d4ccbc;
    background: #faf8f4;
    color: #5a5248;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .mode-toggle:hover { background: #f0ece4; }
  .mode-toggle.manual {
    background: #2c3a2a;
    color: #d4e8d0;
    border-color: #2c3a2a;
    font-weight: 500;
  }

  .clear-btn {
    background: none;
    border: none;
    color: #b5ad9e;
    cursor: pointer;
    font-size: 11px;
    padding: 0 4px;
  }
</style>