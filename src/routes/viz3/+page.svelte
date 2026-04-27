<script lang="ts">
  import * as d3 from "d3";
  import { onMount } from "svelte";
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

  let runs: TRun[] = $state([]);
  let individuals: TIndividual[] = $state([]);
  let groupHrSeries: Series[] = $state([]);
  let improvementPoints: ImprovementPoint[] = $state([]);

  let loading = $state(true);
  let errorMsg = $state("");

  let selectedRunner = $state("");
  let useSmoothing = $state(true);
  let maxRunNumber = $state(100);

  const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

  const percentileOrder = ["Low", "Medium", "High"];

  const groupSortOrder = {
    High: 0,
    Medium: 1,
    Low: 2
  };

  const groupLabelMap = {
    Low: "Low",
    Medium: "Medium",
    High: "High"
  };

  function addRunNumber(allRuns: TRun[]): TRun[] {
    const grouped = d3.group(allRuns, (d) => d.athlete);
    const result: TRun[] = [];

    for (const [, athleteRuns] of grouped) {
      const sorted = athleteRuns
        .filter((d) => d.timestamp instanceof Date && !Number.isNaN(d.timestamp.getTime()))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      sorted.forEach((run, i) => {
        result.push({
          ...run,
          runNumber: i + 1
        });
      });
    }

    return result;
  }

  function normalizeElevationGroup(group: string): string {
    return group.trim();
  }

  function getBaseFilteredRuns(allRuns: TRun[]): TRun[] {
    return allRuns.filter((d) => {
      return (
        d.athlete &&
        d.elevation_group &&
        d.timestamp instanceof Date &&
        !Number.isNaN(d.timestamp.getTime()) &&
        Number.isFinite(d.runNumber) &&
        Number.isFinite(d.pace_min_km)
      );
    });
  }

  function getBaseIndividualRuns(allRuns: TRun[]): TRun[] {
    return allRuns.filter((d) => {
      return (
        d.athlete &&
        d.elevation_group &&
        d.timestamp instanceof Date &&
        !Number.isNaN(d.timestamp.getTime()) &&
        Number.isFinite(d.runNumber)
      );
    });
  }

  function smoothSeries(values: LinePoint[], windowSize = 5): LinePoint[] {
    return values.map((d, i, arr) => {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(arr.length, i + Math.floor(windowSize / 2) + 1);
      const window = arr.slice(start, end);

      return {
        x: d.x,
        value: d3.mean(window, (p) => p.value) ?? d.value
      };
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
          .map(([runNumber, value]) => ({
            x: Number(runNumber),
            value: value as number
          }))
          .sort((a, b) => a.x - b.x);

        return {
          label: groupLabelMap[groupLabel as keyof typeof groupLabelMap] ?? groupLabel,
          values: useSmoothing ? smoothSeries(rawValues, 5) : rawValues
        };
      })
      .filter((series) => series.values.length > 1)
      .sort(
        (a, b) =>
          percentileOrder.indexOf(a.label) - percentileOrder.indexOf(b.label)
      );
  }

  function buildIndividualElevationSeries(
    allRuns: TRun[],
    athleteId: string
  ): Series[] {
    if (!athleteId) return [];

    const filtered = getBaseIndividualRuns(allRuns)
      .filter((d) => d.athlete === athleteId)
      .filter((d) => Number.isFinite(d.elev_gain_m))
      .filter((d) => d.runNumber <= maxRunNumber)
      .sort((a, b) => a.runNumber - b.runNumber);

    if (filtered.length <= 1) return [];

    return [
      {
        label: athleteId,
        values: filtered.map((d) => ({
          x: d.runNumber,
          value: d.elev_gain_m
        }))
      }
    ];
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
      const sorted = athleteRuns
        .slice()
        .sort((a, b) => a.runNumber - b.runNumber);

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
      ) {
        continue;
      }

      const improvementPct =
        ((firstPace - lastPace) / firstPace) * 100;

      result.push({
        athlete,
        avgElevation,
        improvementPct,
        group: sorted[0].elevation_group,
        firstPace,
        lastPace
      });
    }

    return result;
  }

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

          const pace_min_km =
            distance_m > 0 ? (elapsed_s / 60) / (distance_m / 1000) : NaN;

          return {
            athlete,
            timestamp: timestamp ?? new Date("invalid"),
            elev_gain_m,
            avg_hr_bpm,
            pace_min_km,
            elevation_group: normalizeElevationGroup(row["elevation_group"] ?? ""),
            runNumber: 0
          } as TRun;
        }),

        d3.csv("./trajectory_individual.csv", (row) => ({
          athlete: (row["athlete"] ?? "").trim(),
          total_runs: Number(row["total_runs"]),
          group: (row["group"] ?? "").trim()
        }) as TIndividual)
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

  const runnerOptions = $derived(
    [...new Set(runs.map((d) => d.athlete).filter(Boolean))]
      .map((athlete) => {
        const runner = runs.find((d) => d.athlete === athlete);

        return {
          athlete,
          group: runner?.elevation_group ?? ""
        };
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

  const mainTitle = $derived(
    "Does elevation affect heart rate?"
  );

  const mainYLabel = $derived(
    "Heart Rate (bpm)"
  );

  const mainNote = $derived(
    "Each line shows average heart rate by run number for the low, medium, and high elevation groups. Smoothing helps reveal the overall trend."
  );

  const individualTitle = $derived(
    "Individual Runner Elevation Gain over Run Number"
  );

  const individualYLabel = $derived(
    "Elevation Gain (m)"
  );

  const individualNote = $derived(
    `This chart shows how each runner’s elevation gain changes across runs 1–${maxRunNumber}.`
  );

  $effect(() => {
    if (runs.length) {
      groupHrSeries = buildElevationGroupSeries(runs);
    }
  });

  onMount(loadCsv);
</script>

<div class="container">
  <h1>Does incorporating elevation give improvement?</h1>

  <p class="description">
    This chart is intended to show whether runners with more average elevation gain per run improved their pace more over time.
    The supporting charts show heart rate and individual elevation trends across run number.
  </p>

  {#if loading}
    <p>Loading data...</p>
  {:else if errorMsg}
    <p class="error">{errorMsg}</p>
  {:else}
    <div class="chart-card">
      <ElevationImprovementScatter
        points={improvementPoints}
        width={980}
        height={520}
      />
    </div>

    <div class="controls">
      <label class="checkbox">
        <input type="checkbox" bind:checked={useSmoothing} />
        Smooth heart rate lines
      </label>
    </div>

    <div class="controls run-slider-row">
      <label for="run-slider">Runs 1 to <strong>{maxRunNumber}</strong></label>
      <input
        id="run-slider"
        type="range"
        min="10"
        max="500"
        step="10"
        value={maxRunNumber}
        on:input={handleRunSlider}
      />
    </div>

    {#if groupHrSeries.length === 0}
      <p>No processed heart rate data available.</p>
    {:else}
      <div class="chart-card">
        <Elevation
          series={groupHrSeries}
          width={980}
          height={520}
          title={mainTitle}
          yLabel={mainYLabel}
          note={mainNote}
          metric="hr"
          legendTitle="Elevation Groups"
        />
      </div>

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
        <div class="chart-card supplemental">
          <Elevation
            series={displayedIndividualSeries}
            width={980}
            height={520}
            title={individualTitle}
            yLabel={individualYLabel}
            note={individualNote}
            metric="elevation"
            legendTitle="Runner"
            totalRuns={selectedRunnerTotalRuns}
          />
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .container {
    width: min(1100px, 92vw);
    margin: 0 auto;
    padding: 20px 0 40px 0;
  }

  .description {
    max-width: 900px;
    line-height: 1.5;
    margin-bottom: 20px;
  }

  .chart-card {
    margin-top: 24px;
  }

  .controls {
    margin: 20px 0 18px 0;
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
  }

  .run-slider-row input[type="range"] {
    width: 220px;
    max-width: 100%;
  }

  .supplemental-controls {
    margin-top: 28px;
  }

  .supplemental {
    margin-top: 20px;
  }

  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  select {
    font: inherit;
    padding: 4px 8px;
  }

  .error {
    color: #b00020;
  }
</style>