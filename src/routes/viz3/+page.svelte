<script lang="ts">
  import * as d3 from "d3";
  import { onMount } from "svelte";
  import Elevation from "$lib/Elevation.svelte";

  type TRun = {
    athlete: string;
    timestamp: Date;
    elev_gain_m: number;
    avg_hr_bpm: number | null;
    pace_min_km: number;
    elevation_group: string;
    runNumber: number;
  };

  type LinePoint = {
    x: number;
    value: number;
  };

  type Series = {
    label: string;
    values: LinePoint[];
  };

  let runs: TRun[] = $state([]);
  let groupPaceSeries: Series[] = $state([]);
  let groupHrSeries: Series[] = $state([]);

  let loading = $state(true);
  let errorMsg = $state("");

  let selectedMetric: "pace" | "hr" = $state("pace");
  let selectedRunner = $state("");
  let useSmoothing = $state(true);

  // NEW: interactive run cap
  let maxRunNumber = $state(120);

  const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");
  
  const percentileOrder = [
    "10th percentile (Low)",
    "50th percentile (Medium)",
    "90th percentile (High)"
  ];

  const groupDisplayMap = {
    "90th percentile": "High",
    "50th percentile": "Medium",
    "10th percentile": "Low"
  };

  const groupSortOrder = {
    "90th percentile": 0,
    "50th percentile": 1,
    "10th percentile": 2
  };

  const groupLabelMap = {
    "10th percentile": "10th percentile (Low)",
    "50th percentile": "50th percentile (Medium)",
    "90th percentile": "90th percentile (High)"
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

  function buildElevationGroupSeries(
    allRuns: TRun[],
    metric: "pace" | "hr"
  ): Series[] {
    let filtered = getBaseFilteredRuns(allRuns).filter(
      (d) => d.runNumber <= maxRunNumber
    );

    if (metric === "pace") {
      filtered = filtered.filter(
        (d) => Number.isFinite(d.pace_min_km) && d.pace_min_km < 15
      );
    } else {
      filtered = filtered.filter(
        (d) => d.avg_hr_bpm !== null && Number.isFinite(d.avg_hr_bpm)
      );
    }

    const grouped = d3.rollups(
      filtered,
      (groupRuns) =>
        d3.mean(
          groupRuns,
          (d) => (metric === "pace" ? d.pace_min_km : (d.avg_hr_bpm as number))
        ),
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

    const filtered = getBaseFilteredRuns(allRuns)
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

  async function loadCsv() {
    loading = true;
    errorMsg = "";

    try {
      const csvUrl = "/annotated-running-races-with-elevation.csv";

      const parsed = await d3.csv(csvUrl, (row) => {
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
      });

      runs = addRunNumber(parsed.filter(Boolean) as TRun[]);

      groupPaceSeries = buildElevationGroupSeries(runs, "pace");
      groupHrSeries = buildElevationGroupSeries(runs, "hr");

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
        const athleteRuns = runs.filter((d) => d.athlete === athlete);
        const runner = athleteRuns[0];

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

  const displayedGroupSeries = $derived(
    selectedMetric === "pace" ? groupPaceSeries : groupHrSeries
  );

  const displayedIndividualSeries = $derived(
    buildIndividualElevationSeries(runs, selectedRunner)
  );

  const selectedRunnerTotalRuns = $derived(
    runs.filter(
      (d) =>
        d.athlete === selectedRunner &&
        Number.isFinite(d.elev_gain_m) &&
        d.runNumber <= maxRunNumber
    ).length
  );

  const mainTitle = $derived(
    selectedMetric === "pace"
      ? "Pace over Run Number"
      : "Heart Rate over Run Number"
  );

  const mainYLabel = $derived(
    selectedMetric === "pace" ? "Pace (min/km)" : "Heart Rate (bpm)"
  );

  const mainNote = $derived(
    selectedMetric === "pace"
      ? `Each line shows the average pace at each run number for the 10th, 50th, and 90th percentile elevation groups. Lower values indicate faster pace.`
      : `Each line shows the average heart rate at each run number for the 10th, 50th, and 90th percentile elevation groups.`
  );

  const individualTitle = $derived(
    "Individual Runner Elevation Gain over Run Number"
  );

  const individualYLabel = $derived(
    "Elevation Gain (m)"
  );

  const individualNote = $derived(
    `This chart shows how a selected runner’s elevation gain changes across runs 1–${maxRunNumber}.`
  );

  $effect(() => {
    if (runs.length) {
      groupPaceSeries = buildElevationGroupSeries(runs, "pace");
      groupHrSeries = buildElevationGroupSeries(runs, "hr");
    }
  });

  onMount(loadCsv);
</script>

<div class="container">
  <h1>How does elevation affect heart rate and pace?</h1>

  <p class="description">
    The top chart shows average pace or heart rate trends over run number for the 10th, 50th, and 90th percentile
    elevation groups. The supplemental chart below shows how each individual runner’s elevation gain
    changes over their runs. The group lines can be smoothed to reduce noise and make trends easier to compare.
  </p>

  <div class="controls">
    <label for="metric-select">Metric:</label>
    <select id="metric-select" bind:value={selectedMetric}>
      <option value="pace">Pace</option>
      <option value="hr">Heart Rate</option>
    </select>

    <label class="checkbox">
      <input type="checkbox" bind:checked={useSmoothing} />
      Smooth lines
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

  {#if loading}
    <p>Loading data...</p>
  {:else if errorMsg}
    <p class="error">{errorMsg}</p>
  {:else if displayedGroupSeries.length === 0}
    <p>No processed data available.</p>
  {:else}
    <Elevation
      series={displayedGroupSeries}
      width={980}
      height={520}
      title={mainTitle}
      yLabel={mainYLabel}
      note={mainNote}
      metric={selectedMetric}
      legendTitle="Elevation Groups"
    />

    <div class="controls supplemental-controls">
      <label for="runner-select">Runner:</label>
      <select id="runner-select" bind:value={selectedRunner}>
        {#each runnerOptions as runner}
          <option value={runner.athlete}>
            #{runner.athlete} · {runner.group} ({groupDisplayMap[runner.group as keyof typeof groupDisplayMap]})
          </option>
        {/each}
      </select>
    </div>

    {#if displayedIndividualSeries.length > 0}
      <div class="supplemental">
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
</div>

<style>
  .container {
    width: min(1100px, 92vw);
    margin: 0 auto;
    padding: 20px 0 40px 0;
  }

  .subtitle {
    margin-top: 0;
    margin-bottom: 14px;
    color: #555;
  }

  .description {
    max-width: 900px;
    line-height: 1.5;
    margin-bottom: 12px;
  }

  .controls {
    margin: 16px 0 18px 0;
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
    margin-top: 24px;
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