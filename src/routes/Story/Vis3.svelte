<script lang="ts">
  import * as d3 from "d3";
  import { onMount } from "svelte";
  import { Scroll } from "$lib";
  import Elevation from "$lib/Elevation.svelte";
  import ElevationImprovementScatter from "$lib/ElevationScatter.svelte";
  import IndividualElevation from "$lib/IndividualElevation.svelte";

  type TRun = {
    athlete: string;
    timestamp: Date;
    elev_gain_m: number;
    avg_hr_bpm: number | null;
    pace_min_km: number;
    elevation_group: string;
    runNumber: number;
  };

  type TIndividual = {
    athlete: string;
    total_runs: number;
    group: string;
  };

  type LinePoint = {
    x: number;
    value: number;
  };

  type Series = {
    label: string;
    values: LinePoint[];
  };

  type ImprovementPoint = {
    athlete: string;
    avgElevation: number;
    improvementPct: number;
    group: string;
    firstPace: number;
    lastPace: number;
  };

  // ── State ───────────────────────────────────────────────────────────────
  let runs: TRun[] = $state([]);
  let individuals: TIndividual[] = $state([]);
  let groupHrSeries: Series[] = $state([]);
  let improvementPoints: ImprovementPoint[] = $state([]);

  let loading = $state(true);
  let errorMsg = $state("");

  let selectedRunner = $state("");
  let useSmoothing = $state(true);
  let maxRunNumber = $state(100);

  // Scroll progress values for each section (0–100)
  let scatterScrollProgress = $state(0);
  let hrScrollProgress = $state(0);

  // Auto/manual mode for the HR line chart
  let hrMode: "auto" | "manual" = $state("auto");
  let hrManualProgress = $state(100);

  // ── Constants ───────────────────────────────────────────────────────────
  const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");
  const percentileOrder = ["Low", "Medium", "High"];
  const groupSortOrder = { High: 0, Medium: 1, Low: 2 };
  const groupLabelMap = { Low: "Low", Medium: "Medium", High: "High" };

  // ── Data helpers ─────────────────────────────────────────────────────────
  function addRunNumber(allRuns: TRun[]): TRun[] {
    const grouped = d3.group(allRuns, (d) => d.athlete);
    const result: TRun[] = [];
    for (const [, athleteRuns] of grouped) {
      const sorted = athleteRuns
        .filter((d) => d.timestamp instanceof Date && !Number.isNaN(d.timestamp.getTime()))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      sorted.forEach((run, i) => result.push({ ...run, runNumber: i + 1 }));
    }
    return result;
  }

  function normalizeElevationGroup(group: string): string {
    return group.trim();
  }

  function getBaseFilteredRuns(allRuns: TRun[]): TRun[] {
    return allRuns.filter(
      (d) =>
        d.athlete &&
        d.elevation_group &&
        d.timestamp instanceof Date &&
        !Number.isNaN(d.timestamp.getTime()) &&
        Number.isFinite(d.runNumber) &&
        Number.isFinite(d.pace_min_km)
    );
  }

  function getBaseIndividualRuns(allRuns: TRun[]): TRun[] {
    return allRuns.filter(
      (d) =>
        d.athlete &&
        d.elevation_group &&
        d.timestamp instanceof Date &&
        !Number.isNaN(d.timestamp.getTime()) &&
        Number.isFinite(d.runNumber)
    );
  }

  function smoothSeries(values: LinePoint[], windowSize = 5): LinePoint[] {
    return values.map((d, i, arr) => {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(arr.length, i + Math.floor(windowSize / 2) + 1);
      const window = arr.slice(start, end);
      return { x: d.x, value: d3.mean(window, (p) => p.value) ?? d.value };
    });
  }

  function buildElevationGroupSeries(allRuns: TRun[]): Series[] {
    const filtered = getBaseFilteredRuns(allRuns)
      .filter((d) => d.runNumber <= maxRunNumber)
      .filter((d) => d.avg_hr_bpm !== null && Number.isFinite(d.avg_hr_bpm));

    const grouped = d3.rollups(
      filtered,
      (groupRuns) => d3.mean(groupRuns, (d) => d.avg_hr_bpm as number),
      (d) => d.elevation_group,
      (d) => d.runNumber
    );

    return grouped
      .map(([groupLabel, runEntries]) => {
        const rawValues = runEntries
          .filter(([, value]) => value !== undefined && Number.isFinite(value))
          .map(([runNumber, value]) => ({ x: Number(runNumber), value: value as number }))
          .sort((a, b) => a.x - b.x);

        return {
          label: groupLabelMap[groupLabel as keyof typeof groupLabelMap] ?? groupLabel,
          values: useSmoothing ? smoothSeries(rawValues, 5) : rawValues,
        };
      })
      .filter((series) => series.values.length > 1)
      .sort((a, b) => percentileOrder.indexOf(a.label) - percentileOrder.indexOf(b.label));
  }

  function buildIndividualElevationSeries(allRuns: TRun[], athleteId: string): Series[] {
    if (!athleteId) return [];
    const filtered = getBaseIndividualRuns(allRuns)
      .filter((d) => d.athlete === athleteId)
      .filter((d) => Number.isFinite(d.elev_gain_m))
      .filter((d) => d.runNumber <= maxRunNumber)
      .sort((a, b) => a.runNumber - b.runNumber);

    if (filtered.length <= 1) return [];
    return [{ label: athleteId, values: filtered.map((d) => ({ x: d.runNumber, value: d.elev_gain_m })) }];
  }

  function buildImprovementPoints(allRuns: TRun[]): ImprovementPoint[] {
    const grouped = d3.group(
      getBaseFilteredRuns(allRuns)
        .filter((d) => Number.isFinite(d.elev_gain_m))
        .filter((d) => Number.isFinite(d.pace_min_km))
        .filter((d) => d.pace_min_km < 15),
      (d) => d.athlete
    );

    const result: ImprovementPoint[] = [];
    for (const [athlete, athleteRuns] of grouped) {
      const sorted = athleteRuns.slice().sort((a, b) => a.runNumber - b.runNumber);
      if (sorted.length < 10) continue;

      const midpoint = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, midpoint);
      const secondHalf = sorted.slice(midpoint);
      if (firstHalf.length < 3 || secondHalf.length < 3) continue;

      const firstPace = d3.mean(firstHalf, (d) => d.pace_min_km);
      const lastPace = d3.mean(secondHalf, (d) => d.pace_min_km);
      const avgElevation = d3.mean(sorted, (d) => d.elev_gain_m);

      if (
        firstPace === undefined ||
        lastPace === undefined ||
        avgElevation === undefined ||
        firstPace === 0
      ) continue;

      result.push({
        athlete,
        avgElevation,
        improvementPct: ((firstPace - lastPace) / firstPace) * 100,
        group: sorted[0].elevation_group,
        firstPace,
        lastPace,
      });
    }
    return result;
  }

  // ── CSV load ─────────────────────────────────────────────────────────────
  async function loadCsv() {
    loading = true;
    errorMsg = "";
    try {
      const [rawRuns, rawIndividuals] = await Promise.all([
        d3.csv("./annotated-running-races-with-elevation.csv", (row) => {
          const athlete = (row["athlete"] ?? "").trim();
          const timestampRaw = (row["timestamp"] ?? "").trim();
          const timestamp = parseTime(timestampRaw);
          const distance_m = Number(row["distance (m)"]);
          const elapsed_s = Number(row["elapsed time (s)"]);
          const elev_gain_m = Number(row["elevation gain (m)"]);
          const avg_hr_bpm =
            row["average heart rate (bpm)"] && row["average heart rate (bpm)"] !== ""
              ? Number(row["average heart rate (bpm)"])
              : null;
          const pace_min_km = distance_m > 0 ? elapsed_s / 60 / (distance_m / 1000) : NaN;

          return {
            athlete,
            timestamp: timestamp ?? new Date("invalid"),
            elev_gain_m,
            avg_hr_bpm,
            pace_min_km,
            elevation_group: normalizeElevationGroup(row["elevation_group"] ?? ""),
            runNumber: 0,
          } as TRun;
        }),

        d3.csv("./trajectory_individual.csv", (row) => ({
          athlete: (row["athlete"] ?? "").trim(),
          total_runs: Number(row["total_runs"]),
          group: (row["group"] ?? "").trim(),
        }) as TIndividual),
      ]);

      runs = addRunNumber(rawRuns.filter(Boolean) as TRun[]);
      individuals = rawIndividuals.filter((d) => d.athlete);
      improvementPoints = buildImprovementPoints(runs);
      groupHrSeries = buildElevationGroupSeries(runs);

      const athletes = [...new Set(runs.map((d) => d.athlete).filter(Boolean))].sort();
      selectedRunner = athletes[0] ?? "";
    } catch (err) {
      console.error(err);
      errorMsg = "Failed to load or process the CSV file.";
    } finally {
      loading = false;
    }
  }

  function handleRunSlider(event: Event) {
    maxRunNumber = Number((event.target as HTMLInputElement).value);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const runnerOptions = $derived(
    [...new Set(runs.map((d) => d.athlete).filter(Boolean))]
      .map((athlete) => {
        const runner = runs.find((d) => d.athlete === athlete);
        return { athlete, group: runner?.elevation_group ?? "" };
      })
      .sort((a, b) => {
        const groupDiff =
          (groupSortOrder[a.group as keyof typeof groupSortOrder] ?? 99) -
          (groupSortOrder[b.group as keyof typeof groupSortOrder] ?? 99);
        if (groupDiff !== 0) return groupDiff;
        return a.athlete.localeCompare(b.athlete);
      })
  );

  const displayedIndividualSeries = $derived(
    buildIndividualElevationSeries(runs, selectedRunner)
  );

  const selectedRunnerTotalRuns = $derived(
    individuals.find((d) => d.athlete === selectedRunner)?.total_runs ?? 0
  );

  const mainNote = $derived(
    "Each line shows average heart rate by run number for Low, Medium, and High elevation groups. Smoothing uses a 5-run moving average."
  );

  const individualNote = $derived(
    `Elevation gain (m) across runs 1–${maxRunNumber} for the selected runner.`
  );

  // The progress actually used by Elevation for its reveal animation
  const hrEffectiveProgress = $derived(
    hrMode === "auto" ? hrScrollProgress : hrManualProgress
  );

  $effect(() => {
    if (runs.length) groupHrSeries = buildElevationGroupSeries(runs);
  });

  onMount(loadCsv);

  // Scatter narrative bullets
  const scatterNarrative = [
    {
      heading: "How runners are grouped",
      text: "Each point is one runner grouped into Low, Medium, or High elevation based on their average elevation gain per run (lower third, middle third, or upper third of runners). The horizontal marker shows median pace improvement for each group.",
    },
    {
      heading: "How improvement is calculated",
      text: "Improvement is calculated as the percent change between a runner's average pace in the first half of runs and the second half of runs, where positive values mean the second half is faster than the first half.",
    },
    {
      heading: "What the data shows",
      text: "Higher elevation does not guarantee faster pace for every runner, and there is a lot of variation within each group. In this sample, the High elevation group shows the largest median slowdown at −4.7%, compared with −2.0% for the Medium group and −0.9% for the Low group.",
    },
    {
      heading: "What this suggests",
      text: "Elevation gain alone doesn't necessarily lead to faster pace because it adds difficulty. Other factors such as consistency and effort may play a larger role in long-term improvement.",
    },
  ];

  const scatterActiveNarrative = $derived(
    scatterScrollProgress < 33 ? 0
    : scatterScrollProgress < 66 ? 1
    : scatterScrollProgress < 90 ? 2
    : 3
  );

  // HR narrative bullets
  const hrNarrative = [
    {
      heading: "How to read this chart",
      text: "Each line shows the average heart rate over run number for runners in the Low, Medium, and High elevation groups. The smoothing feature uses a 5-run moving average by averaging the value for its run number, the two runs before, and the runs after (when available).",
    },
    {
      heading: "What the data shows",
      text: "The High elevation group generally stays at a higher heart rate, often around 150–155 bpm, while the Medium and Low groups tend to stay around 140–148 bpm. This suggests that runners with higher elevation gain are putting in more effort during their runs.",
    },
  ];

  const hrActiveNarrative = $derived(hrEffectiveProgress < 50 ? 0 : 1);
</script>

<!-- ─────────────────────────────────────────────────────────────────────────
     SECTION 1 — Scatter: Does elevation improve pace?
──────────────────────────────────────────────────────────────────────────── -->
<Scroll bind:progress={scatterScrollProgress} --scrolly-story-width="0" --layout="viz-first">
  <div class="virtual scatter"></div>

  <div slot="viz">
    <section class="chart-card">
      <h2 class="section-heading">Does running with more elevation lead to faster improvement?</h2>

      {#if loading}
        <p class="loading-msg">Loading data…</p>
      {:else if errorMsg}
        <p class="error">{errorMsg}</p>
      {:else}
        <!-- Two-column layout: narrative left, chart right -->
        <div class="two-col">

          <!-- Left: narrative panel -->
          <aside class="narrative-panel">
            <div class="bullets">
              {#each scatterNarrative as bullet, i}
                <div
                  class="bullet-item"
                  class:active={i === scatterActiveNarrative}
                  class:past={i < scatterActiveNarrative}
                >
                  <div class="bullet-body">
                    <strong class="bullet-heading">{bullet.heading}</strong>
                    <p class="bullet-text">{bullet.text}</p>
                  </div>
                </div>
              {/each}
            </div>
          </aside>

          <!-- Right: chart -->
          <div class="chart-col">
            <div class="chart-card-inner">
              <ElevationImprovementScatter
                points={improvementPoints}
                width={650}
                height={380}
                scrollProgress={scatterScrollProgress}
              />
            </div>

            {#if scatterScrollProgress >= 66}
              <div class="finding-box">
                <strong>Key finding:</strong> Higher elevation does not guarantee faster pace improvement.
                The High group shows the largest median <em>slowdown</em> (−4.7%), while Low group runners
                declined least (−0.9%). Elevation adds difficulty, and other factors like consistency
                may matter more for long-term improvement.
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </section>
  </div>
</Scroll>


<!-- ─────────────────────────────────────────────────────────────────────────
     SECTION 2 — Heart Rate by Elevation Group
──────────────────────────────────────────────────────────────────────────── -->
<Scroll bind:progress={hrScrollProgress} --scrolly-story-width="0" --layout="viz-first">
  <div class="virtual hr"></div>

  <div slot="viz">
    <section class="chart-card">
      <h2 class="section-heading">Does elevation raise your heart rate?</h2>

      {#if !loading && !errorMsg}
        <!-- Two-column layout: narrative left, chart right -->
        <div class="two-col">

          <!-- Left: narrative + controls -->
          <aside class="narrative-panel">
            <div class="bullets">
              {#each hrNarrative as bullet, i}
                <div
                  class="bullet-item"
                  class:active={i === hrActiveNarrative}
                  class:past={i < hrActiveNarrative}
                >
                  <div class="bullet-body">
                    <strong class="bullet-heading">{bullet.heading}</strong>
                    <p class="bullet-text">{bullet.text}</p>
                  </div>
                </div>
              {/each}
            </div>

            <!-- Smoothing toggle -->
            <div class="narrative-control">
              <label class="checkbox">
                <input type="checkbox" bind:checked={useSmoothing} />
                Smooth lines (5-run moving average)
              </label>
            </div>

            <!-- Auto / Manual playback toggle -->
            <div class="mode-toggle">
              <span class="mode-label">Playback</span>
              <div class="toggle-buttons">
                <button
                  class="toggle-btn"
                  class:active={hrMode === "auto"}
                  onclick={() => (hrMode = "auto")}
                >Auto</button>
                <button
                  class="toggle-btn"
                  class:active={hrMode === "manual"}
                  onclick={() => (hrMode = "manual")}
                >Manual</button>
              </div>
            </div>

            {#if hrMode === "manual"}
              <div class="manual-slider-wrap">
                <label class="slider-label" for="hr-reveal-slider">
                  Reveal through run: <strong>
                    {Math.round(
                      (groupHrSeries[0]?.values[0]?.x ?? 1) +
                      ((groupHrSeries[0]?.values.at(-1)?.x ?? maxRunNumber) -
                       (groupHrSeries[0]?.values[0]?.x ?? 1)) *
                      (hrManualProgress / 100)
                    )}
                  </strong>
                </label>
                <input
                  id="hr-reveal-slider"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  bind:value={hrManualProgress}
                  class="run-slider"
                />
              </div>
            {:else}
              <p class="auto-hint">Scroll down to animate through runs.</p>
            {/if}

            <!-- Max runs slider (always shown) -->
            <div class="narrative-control" style="margin-top: 16px;">
              <div class="slider-row">
                <label for="run-slider">Max runs: <strong>{maxRunNumber}</strong></label>
                <input
                  id="run-slider"
                  type="range"
                  min="10"
                  max="500"
                  step="10"
                  value={maxRunNumber}
                  oninput={handleRunSlider}
                />
              </div>
            </div>
          </aside>

          <!-- Right: chart -->
          <div class="chart-col">
            {#if groupHrSeries.length === 0}
              <p>No heart rate data available.</p>
            {:else}
              <div class="chart-card-inner">
                <Elevation
                  series={groupHrSeries}
                  width={650}
                  height={350}
                  title="Average Heart Rate by Elevation Group"
                  yLabel="Heart Rate (bpm)"
                  note={mainNote}
                  metric="hr"
                  legendTitle="Elevation Groups"
                  scrollProgress={hrEffectiveProgress}
                />
              </div>
            {/if}
          </div>
        </div>

        <!-- Individual runner explorer — full width below -->
        <!-- <div class="individual-section">
          <h3 class="individual-heading">Explore an individual runner's elevation gain</h3>
          <p class="individual-note">
            Select a runner to see how their elevation gain changes across runs.
            Runners are sorted by elevation group (High → Medium → Low).
          </p>

          <div class="controls supplemental-controls">
            <label for="runner-select">Runner:</label>
            <select id="runner-select" bind:value={selectedRunner}>
              {#each runnerOptions as runner}
                <option value={runner.athlete}>
                  #{runner.athlete} · {runner.group}
                </option>
              {/each}
            </select>
          </div>

          {#if displayedIndividualSeries.length > 0}
            <div class="chart-card-inner supplemental">
              <Elevation
                series={displayedIndividualSeries}
                width={980}
                height={420}
                title={`Runner #${selectedRunner} — Elevation Gain Over Runs`}
                yLabel="Elevation Gain (m)"
                note={individualNote}
                metric="elevation"
                legendTitle="Runner"
                totalRuns={selectedRunnerTotalRuns}
              />
            </div>
          {:else}
            <p class="no-data">Not enough valid runs for this runner.</p>
          {/if}
        </div> -->
      {/if}
    </section>
  </div>
</Scroll>

<style>
  /* ── Virtual scroll spacers ───────────────────────────────────────────── */
  .virtual.scatter {
    height: 350vh;
  }

  .virtual.hr {
    height: 260vh;
  }
  /* ── Chart card shell ─────────────────────────────────────────────────── */
  .chart-card {
    max-width: 1280px;
    margin: 0 auto;
    min-height: 80vh;
    padding: 6vh 1.5rem 5vh;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .chart-card-inner {
    overflow-x: auto;
  }

  /* ── Two-column layout ────────────────────────────────────────────────── */
  .two-col {
    display: flex;
    gap: 36px;
    align-items: flex-start;
  }

  /* Narrative panel: 28% */
  .narrative-panel {
    flex: 0 0 28%;
    max-width: 28%;
    position: sticky;
    top: 80px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* Chart column: fills remaining ~72% */
  .chart-col {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-x: auto;
  }

  /* ── Narrative bullets ────────────────────────────────────────────────── */
  .bullets {
    display: flex;
    flex-direction: column;
  }

  .bullet-item {
    position: relative;
    padding: 14px 0 14px 18px;
    opacity: 0.38;
    transition: opacity 400ms ease, border-color 400ms ease;
  }

  .bullet-item.active {
    opacity: 1;
    border-left-color: #4C72B0;
  }

  .bullet-item.past {
    opacity: 0.65;
    border-left-color: #aac0e0;
  }

  /* HR section uses red accent */
  .bullet-item.active:has(.hr-dot) {
    border-left-color: #C44E52;
  }
  .bullet-item.past:has(.hr-dot) {
    border-left-color: #e8a0a3;
  }

  .bullet-dot {
    position: absolute;
    left: -6px;
    top: 19px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #e0e0e0;
    border: 2px solid #fff;
    transition: background 400ms ease;
  }

  .bullet-item.active .bullet-dot {
    background: #4C72B0;
  }

  .bullet-item.past .bullet-dot {
    background: #aac0e0;
  }

  .bullet-item.active .hr-dot {
    background: #C44E52;
  }

  .bullet-item.past .hr-dot {
    background: #e8a0a3;
  }

  .bullet-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bullet-heading {
    font-size: 0.84rem;
    font-weight: 700;
    color: #222;
    line-height: 1.3;
  }

  .bullet-text {
    font-size: 0.83rem;
    color: #555;
    line-height: 1.55;
    margin: 0;
  }

  /* ── Narrative controls (inside left panel) ───────────────────────────── */
  .narrative-control {
    margin-top: 20px;
  }

  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    color: #444;
  }

  .slider-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.85rem;
    color: #444;
  }

  .slider-row input[type="range"] {
    width: 100%;
  }

  /* ── Auto / Manual toggle ─────────────────────────────────────────────── */
  .mode-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 20px;
  }

  .mode-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .toggle-buttons {
    display: flex;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    overflow: hidden;
  }

  .toggle-btn {
    padding: 5px 14px;
    font-size: 0.82rem;
    font-weight: 500;
    border: none;
    background: #fff;
    color: #666;
    cursor: pointer;
    transition: background 200ms ease, color 200ms ease;
  }

  .toggle-btn:first-child {
    border-right: 1px solid #d0d0d0;
  }

  .toggle-btn.active {
    background: #1a1a2e;
    color: #fff;
  }

  .toggle-btn:hover:not(.active) {
    background: #f4f4f4;
  }

  .manual-slider-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 12px;
  }

  .slider-label {
    font-size: 0.82rem;
    color: #555;
  }

  .run-slider {
    width: 100%;
    accent-color: #C44E52;
    cursor: pointer;
  }

  .auto-hint {
    font-size: 0.8rem;
    color: #aaa;
    font-style: italic;
    margin: 8px 0 0;
  }

  /* ── Typography ───────────────────────────────────────────────────────── */
  .section-heading {
    font-size: clamp(1.1rem, 2.2vw, 1.45rem);
    font-weight: 600;
    line-height: 1.3;
    margin: 0;
    color: #1a1a1a;
  }

  .individual-heading {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 4px;
    color: #222;
  }

  .individual-note {
    font-size: 0.9rem;
    color: #666;
    margin: 0 0 10px;
    max-width: 720px;
    line-height: 1.5;
  }

  /* ── Controls (individual explorer row) ──────────────────────────────── */
  .controls {
    display: flex;
    gap: 20px;
    align-items: center;
    flex-wrap: wrap;
    font-size: 0.92rem;
  }

  .supplemental-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.92rem;
  }

  select {
    font: inherit;
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  /* ── Finding box ──────────────────────────────────────────────────────── */
  .finding-box {
    background: #fef9f0;
    border-left: 3px solid #e8a838;
    border-radius: 6px;
    padding: 12px 16px;
    font-size: 0.91rem;
    color: #333;
    line-height: 1.6;
  }

  /* ── Individual section ───────────────────────────────────────────────── */
  .individual-section {
    margin-top: 40px;
    padding-top: 32px;
    border-top: 1px solid #ebebeb;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .supplemental {
    margin-top: 10px;
  }

  /* ── Misc ─────────────────────────────────────────────────────────────── */
  .loading-msg {
    color: #888;
    font-style: italic;
  }

  .error {
    color: #b00020;
  }

  .no-data {
    color: #888;
    font-style: italic;
    font-size: 0.9rem;
  }
</style>