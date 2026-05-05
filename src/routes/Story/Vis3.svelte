<script lang="ts">
  import * as d3 from "d3";
  import { onMount } from "svelte";
  import { Scroll } from "$lib";
  import Elevation from "$lib/Elevation.svelte";
  import ElevationImprovementScatter from "$lib/ElevationScatter.svelte";

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

  type LinePoint = { x: number; value: number };
  type Series = { label: string; values: LinePoint[] };
  type ImprovementPoint = {
    athlete: string;
    avgElevation: number;
    improvementPct: number;
    group: string;
    firstPace: number;
    lastPace: number;
  };

  let runs: TRun[] = $state([]);
  let individuals: TIndividual[] = $state([]);
  let groupHrSeries: Series[] = $state([]);
  let improvementPoints: ImprovementPoint[] = $state([]);
  let loading = $state(true);
  let errorMsg = $state("");
  let selectedRunner = $state("");
  let useSmoothing = $state(true);
  let maxRunNumber = $state(100);
  let scatterScrollProgress = $state(0);
  let hrScrollProgress = $state(0);
  let hrMode: "auto" | "manual" = $state("auto");
  let hrManualProgress = $state(100);

  const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");
  const percentileOrder = ["Low", "Medium", "High"];
  const groupSortOrder = { High: 0, Medium: 1, Low: 2 };
  const groupLabelMap = { Low: "Low", Medium: "Medium", High: "High" };

  function addRunNumber(allRuns: TRun[]): TRun[] {
    const grouped = d3.group(allRuns, d => d.athlete);
    const result: TRun[] = [];
    for (const [, athleteRuns] of grouped) {
      const sorted = athleteRuns.filter(d => d.timestamp instanceof Date && !Number.isNaN(d.timestamp.getTime())).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      sorted.forEach((run, i) => result.push({ ...run, runNumber: i + 1 }));
    }
    return result;
  }

  function normalizeElevationGroup(group: string): string { return group.trim(); }

  function getBaseFilteredRuns(allRuns: TRun[]): TRun[] {
    return allRuns.filter(d => d.athlete && d.elevation_group && d.timestamp instanceof Date && !Number.isNaN(d.timestamp.getTime()) && Number.isFinite(d.runNumber) && Number.isFinite(d.pace_min_km));
  }

  function getBaseIndividualRuns(allRuns: TRun[]): TRun[] {
    return allRuns.filter(d => d.athlete && d.elevation_group && d.timestamp instanceof Date && !Number.isNaN(d.timestamp.getTime()) && Number.isFinite(d.runNumber));
  }

  function smoothSeries(values: LinePoint[], windowSize = 5): LinePoint[] {
    return values.map((d, i, arr) => {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(arr.length, i + Math.floor(windowSize / 2) + 1);
      const window = arr.slice(start, end);
      return { x: d.x, value: d3.mean(window, p => p.value) ?? d.value };
    });
  }

  function buildElevationGroupSeries(allRuns: TRun[]): Series[] {
    const filtered = getBaseFilteredRuns(allRuns).filter(d => d.runNumber <= maxRunNumber).filter(d => d.avg_hr_bpm !== null && Number.isFinite(d.avg_hr_bpm));
    const grouped = d3.rollups(filtered, groupRuns => d3.mean(groupRuns, d => d.avg_hr_bpm as number), d => d.elevation_group, d => d.runNumber);
    return grouped.map(([groupLabel, runEntries]) => {
      const rawValues = runEntries.filter(([, value]) => value !== undefined && Number.isFinite(value)).map(([runNumber, value]) => ({ x: Number(runNumber), value: value as number })).sort((a, b) => a.x - b.x);
      return { label: groupLabelMap[groupLabel as keyof typeof groupLabelMap] ?? groupLabel, values: useSmoothing ? smoothSeries(rawValues, 5) : rawValues };
    }).filter(s => s.values.length > 1).sort((a, b) => percentileOrder.indexOf(a.label) - percentileOrder.indexOf(b.label));
  }

  function buildImprovementPoints(allRuns: TRun[]): ImprovementPoint[] {
    const grouped = d3.group(getBaseFilteredRuns(allRuns).filter(d => Number.isFinite(d.elev_gain_m) && Number.isFinite(d.pace_min_km) && d.pace_min_km < 15), d => d.athlete);
    const result: ImprovementPoint[] = [];
    for (const [athlete, athleteRuns] of grouped) {
      const sorted = athleteRuns.slice().sort((a, b) => a.runNumber - b.runNumber);
      if (sorted.length < 10) continue;
      const midpoint = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, midpoint);
      const secondHalf = sorted.slice(midpoint);
      if (firstHalf.length < 3 || secondHalf.length < 3) continue;
      const firstPace = d3.mean(firstHalf, d => d.pace_min_km);
      const lastPace = d3.mean(secondHalf, d => d.pace_min_km);
      const avgElevation = d3.mean(sorted, d => d.elev_gain_m);
      if (firstPace === undefined || lastPace === undefined || avgElevation === undefined || firstPace === 0) continue;
      result.push({ athlete, avgElevation, improvementPct: ((firstPace - lastPace) / firstPace) * 100, group: sorted[0].elevation_group, firstPace, lastPace });
    }
    return result;
  }

  async function loadCsv() {
    loading = true; errorMsg = "";
    try {
      const [rawRuns, rawIndividuals] = await Promise.all([
        d3.csv("./annotated-running-races-with-elevation.csv", (row) => {
          const athlete = (row["athlete"] ?? "").trim();
          const timestamp = parseTime((row["timestamp"] ?? "").trim());
          const distance_m = Number(row["distance (m)"]);
          const elapsed_s = Number(row["elapsed time (s)"]);
          const elev_gain_m = Number(row["elevation gain (m)"]);
          const avg_hr_bpm = row["average heart rate (bpm)"] && row["average heart rate (bpm)"] !== "" ? Number(row["average heart rate (bpm)"]) : null;
          const pace_min_km = distance_m > 0 ? elapsed_s / 60 / (distance_m / 1000) : NaN;
          return { athlete, timestamp: timestamp ?? new Date("invalid"), elev_gain_m, avg_hr_bpm, pace_min_km, elevation_group: normalizeElevationGroup(row["elevation_group"] ?? ""), runNumber: 0 } as TRun;
        }),
        d3.csv("./trajectory_individual.csv", (row) => ({ athlete: (row["athlete"] ?? "").trim(), total_runs: Number(row["total_runs"]), group: (row["group"] ?? "").trim() }) as TIndividual),
      ]);
      runs = addRunNumber(rawRuns.filter(Boolean) as TRun[]);
      individuals = rawIndividuals.filter(d => d.athlete);
      improvementPoints = buildImprovementPoints(runs);
      groupHrSeries = buildElevationGroupSeries(runs);
      const athletes = [...new Set(runs.map(d => d.athlete).filter(Boolean))].sort();
      selectedRunner = athletes[0] ?? "";
    } catch (err) {
      console.error(err);
      errorMsg = "Failed to load or process the CSV file.";
    } finally {
      loading = false;
    }
  }

  function handleRunSlider(event: Event) { maxRunNumber = Number((event.target as HTMLInputElement).value); }

  const runnerOptions = $derived(
    [...new Set(runs.map(d => d.athlete).filter(Boolean))].map(athlete => {
      const runner = runs.find(d => d.athlete === athlete);
      return { athlete, group: runner?.elevation_group ?? "" };
    }).sort((a, b) => {
      const groupDiff = (groupSortOrder[a.group as keyof typeof groupSortOrder] ?? 99) - (groupSortOrder[b.group as keyof typeof groupSortOrder] ?? 99);
      return groupDiff !== 0 ? groupDiff : a.athlete.localeCompare(b.athlete);
    })
  );

  const hrEffectiveProgress = $derived(hrMode === "auto" ? hrScrollProgress : hrManualProgress);
  const mainNote = $derived("Average heart rate by run number for Low, Medium, and High elevation groups. Smoothing uses a 5-run moving average.");

  $effect(() => { if (runs.length) groupHrSeries = buildElevationGroupSeries(runs); });
  onMount(loadCsv);

  const scatterNarrative = [
    { heading: "How runners are grouped", text: "Each point is one runner grouped into Low, Medium, or High elevation based on their average gain per run. The horizontal marker shows median pace improvement for each group." },
    { heading: "How improvement is measured", text: "Improvement is the percent change between average pace in a runner's first half of runs versus their second half. Positive values mean the second half was faster." },
    { heading: "What the data shows", text: "Higher elevation doesn't guarantee faster pace. The High group shows the largest median slowdown at −4.7%, vs −2.0% for Medium and −0.9% for Low." },
    { heading: "What this suggests", text: "Elevation adds difficulty without necessarily building speed directly. Consistency and effort may be stronger long-term drivers than terrain alone." },
  ];
  const scatterActiveNarrative = $derived(scatterScrollProgress < 33 ? 0 : scatterScrollProgress < 66 ? 1 : scatterScrollProgress < 90 ? 2 : 3);

  const hrNarrative = [
    { heading: "How to read this chart", text: "Each line shows average heart rate over run number for the three elevation groups. Smoothing applies a 5-run moving average." },
    { heading: "What the data shows", text: "The High elevation group generally runs at ~150–155 bpm, while Medium and Low stay around 140–148 bpm — reflecting the added effort of hillier routes." },
  ];
  const hrActiveNarrative = $derived(hrEffectiveProgress < 50 ? 0 : 1);
</script>

<Scroll bind:progress={scatterScrollProgress} --scrolly-story-width="0" --layout="viz-first">
  <div class="virtual scatter"></div>

  <div slot="viz">
    <section class="chart-section">

      <header class="section-header">
        <p class="section-label"><span class="label-pip"></span>Part 3 — Elevation</p>
        <h2>Does running at higher elevation lead to faster improvement?</h2>
      </header>

      {#if loading}
        <div class="loading-state"><div class="loading-bar"></div><p>Loading data…</p></div>
      {:else if errorMsg}
        <p class="err">{errorMsg}</p>
      {:else}
        <div class="two-col">
          <aside class="narrative-panel">
            <div class="bullets">
              {#each scatterNarrative as bullet, i}
                <div class="bullet-item" class:active={i === scatterActiveNarrative} class:past={i < scatterActiveNarrative}>
                  <div class="bullet-body">
                    <strong class="bullet-heading">{bullet.heading}</strong>
                    <p class="bullet-text">{bullet.text}</p>
                  </div>
                </div>
              {/each}
            </div>
          </aside>

          <div class="chart-col">
            <ElevationImprovementScatter points={improvementPoints} width={500} height={380} scrollProgress={scatterScrollProgress} />

            {#if scatterScrollProgress >= 66}
              <div class="finding-box">
                <span class="finding-label">Key finding</span>
                <p>Higher elevation does not guarantee faster pace improvement. The High group shows the largest median slowdown (−4.7%), while Low declines least (−0.9%). Consistency may matter more than terrain.</p>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </section>
  </div>
</Scroll>

<Scroll bind:progress={hrScrollProgress} --scrolly-story-width="0" --layout="viz-first">
  <div class="virtual hr"></div>

  <div slot="viz">
    <section class="chart-section">

      <header class="section-header">
        <h2>Does elevation raise your heart rate?</h2>
      </header>

      {#if !loading && !errorMsg}
        <div class="two-col">
          <aside class="narrative-panel">
            <div class="bullets">
              {#each hrNarrative as bullet, i}
                <div class="bullet-item" class:active={i === hrActiveNarrative} class:past={i < hrActiveNarrative}>
                  <div class="bullet-body">
                    <strong class="bullet-heading">{bullet.heading}</strong>
                    <p class="bullet-text">{bullet.text}</p>
                  </div>
                </div>
              {/each}
            </div>

            <div class="control-block">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={useSmoothing} />
                5-run moving average
              </label>
            </div>

            <div class="playback-toggle">
              <span class="toggle-label">Playback</span>
              <div class="toggle-buttons">
                <button class="toggle-btn" class:active={hrMode === "auto"} onclick={() => (hrMode = "auto")}>Auto</button>
                <button class="toggle-btn" class:active={hrMode === "manual"} onclick={() => (hrMode = "manual")}>Manual</button>
              </div>
            </div>

            {#if hrMode === "manual"}
              <div class="slider-block">
                <label class="slider-label-text">
                  Reveal through run: <strong>{Math.round((groupHrSeries[0]?.values[0]?.x ?? 1) + ((groupHrSeries[0]?.values.at(-1)?.x ?? maxRunNumber) - (groupHrSeries[0]?.values[0]?.x ?? 1)) * (hrManualProgress / 100))}</strong>
                </label>
                <input id="hr-reveal" type="range" min="0" max="100" step="1" bind:value={hrManualProgress} />
              </div>
            {:else}
              <p class="auto-hint">Scroll to animate through runs.</p>
            {/if}

            <div class="control-block">
              <label class="slider-label-text">Max runs: <strong>{maxRunNumber}</strong></label>
              <input id="run-slider" type="range" min="10" max="500" step="10" value={maxRunNumber} oninput={handleRunSlider} />
            </div>
          </aside>

          <div class="chart-col">
            {#if groupHrSeries.length === 0}
              <p class="no-data">No heart rate data available.</p>
            {:else}
              <Elevation
                series={groupHrSeries}
                width={650}
                height={350}
                title="Average heart rate by elevation group"
                yLabel="Heart rate (bpm)"
                note={mainNote}
                metric="hr"
                legendTitle="Elevation Groups"
                scrollProgress={hrEffectiveProgress}
              />
            {/if}
          </div>
        </div>
      {/if}
    </section>
  </div>
</Scroll>

<style>
  .virtual.scatter { height: 350vh; }
  .virtual.hr      { height: 260vh; }

  .chart-section {
    max-width: 1280px;
    margin: 0 auto;
    min-height: 80vh;
    padding: 7vh 2rem 5vh;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .section-header { max-width: 680px; }

  .section-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #7a7260;
    margin: 0 0 0.75rem;
  }

  .label-pip { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #b5a882; }

  h2 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(1.15rem, 2.3vw, 1.55rem);
    font-weight: 400;
    line-height: 1.3;
    margin: 0;
    color: #1a1a18;
  }

  .two-col { display: flex; gap: 2.5rem; align-items: flex-start; }

  .narrative-panel {
    flex: 0 0 28%;
    max-width: 280px;
    position: sticky;
    top: 80px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .chart-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 1rem; overflow-x: auto; }

  .bullets { display: flex; flex-direction: column; }

  .bullet-item {
    padding: 0.9rem 0 0.9rem 1rem;
    opacity: 0.35;
    transition: opacity 400ms ease, border-color 400ms ease;
  }

  .bullet-item.active { opacity: 1; border-left-color: #3a5c38; }
  .bullet-item.past   { opacity: 0.65; border-left-color: #8ab088; }

  .bullet-body { display: flex; flex-direction: column; gap: 4px; }

  .bullet-heading { font-size: 0.82rem; font-weight: 500; color: #1a1a18; line-height: 1.3; }
  .bullet-text { font-size: 0.8rem; color: #6b6456; line-height: 1.55; margin: 0; }

  /* ── Controls inside narrative panel ─────────────────────────────────── */
  .control-block { display: flex; flex-direction: column; gap: 6px; }
  .checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #5a5248; cursor: pointer; }
  .slider-label-text { font-size: 12px; color: #5a5248; }

  .playback-toggle { display: flex; align-items: center; gap: 8px; }
  .toggle-label { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #9a9080; }

  .toggle-buttons { display: flex; border: 1px solid #d4ccbc; border-radius: 7px; overflow: hidden; }
  .toggle-btn { padding: 3px 10px; font-size: 12px; border: none; background: #faf8f4; color: #7a6e5c; cursor: pointer; border-right: 1px solid #d4ccbc; transition: background 0.15s; }
  .toggle-btn:last-child { border-right: none; }
  .toggle-btn.active { background: #2c3a2a; color: #d4e8d0; font-weight: 500; }

  .slider-block { display: flex; flex-direction: column; gap: 4px; }
  input[type="range"] { width: 100%; accent-color: #3a5c38; cursor: pointer; }
  .auto-hint { font-size: 11px; color: #b5ad9e; font-style: italic; margin: 0; }

  .finding-box {
    background: rgba(252, 247, 235, 0.9);
    border: 1px solid rgba(181, 168, 130, 0.35);
    border-left: 3px solid #c2a96b;
    border-radius: 10px;
    padding: 0.9rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .finding-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #8a7240;
  }

  .finding-box p { margin: 0; font-size: 0.88rem; color: #4a3e2a; line-height: 1.6; }

  .loading-state { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 3rem; color: #9a9080; font-size: 0.9rem; }
  .loading-bar { width: 100px; height: 3px; background: #e8e2d6; border-radius: 2px; overflow: hidden; position: relative; }
  .loading-bar::after { content: ''; position: absolute; left: -40%; top: 0; width: 40%; height: 100%; background: #b5a882; animation: sweep 1.2s ease-in-out infinite; }
  @keyframes sweep { to { left: 100%; } }

  .err { color: #a03020; font-size: 0.9rem; }
  .no-data { color: #9a9080; font-style: italic; font-size: 0.9rem; }
</style>