<script lang="ts">
  import * as d3 from "d3";
  import { onMount } from "svelte";
  import Multiline2 from "$lib/Multiline2.svelte";

  type TRun = {
    athlete: string;
    gender: string;
    timestamp: Date;
    distance_m: number;
    elapsed_s: number;
    elev_gain_m: number;
    avg_hr_bpm: number | null;
    speed_kmh: number;
    climb_efficiency: number;
    efficiency: number;
    year_week: string;
    percentile_avg_runs_week: number;
    avg_runs_per_week: number;
    runNumber: number;
    pace_min_km: number;
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

  const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

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

  function getBaseFilteredRuns(allRuns: TRun[]): TRun[] {
    return allRuns.filter((d) => {
      return (
        d.athlete &&
        d.timestamp instanceof Date &&
        !Number.isNaN(d.timestamp.getTime()) &&
        Number.isFinite(d.distance_m) &&
        Number.isFinite(d.elapsed_s) &&
        Number.isFinite(d.percentile_avg_runs_week) &&
        Number.isFinite(d.runNumber) &&
        d.distance_m > 0 &&
        d.elapsed_s > 0
      );
    });
  }

  function getPercentileGroup(percentile: number): string {
    if (Math.abs(percentile - 0.10) <= 0.03) return "10th percentile";
    if (Math.abs(percentile - 0.50) <= 0.03) return "50th percentile";
    if (Math.abs(percentile - 0.90) <= 0.03) return "90th percentile";
    return "Outliers";
  }

  function buildPercentileGroupSeries(
    allRuns: TRun[],
    metric: "pace" | "hr"
  ): Series[] {
    let filtered = getBaseFilteredRuns(allRuns);

    if (metric === "pace") {
      filtered = filtered.filter(
        (d) => Number.isFinite(d.pace_min_km) && d.pace_min_km < 15
      );
    } else {
      filtered = filtered.filter(
        (d) => d.avg_hr_bpm !== null && Number.isFinite(d.avg_hr_bpm)
      );
    }

    const withGroup = filtered
      .filter((d) => d.runNumber <= 120)
      .map((d) => ({
        ...d,
        percentileGroup: getPercentileGroup(d.percentile_avg_runs_week)
      }));

    const grouped = d3.rollups(
      withGroup,
      (groupRuns) =>
        d3.mean(
          groupRuns,
          (d) => (metric === "pace" ? d.pace_min_km : (d.avg_hr_bpm as number))
        ),
      (d) => d.percentileGroup,
      (d) => d.runNumber
    );

    const desiredOrder = ["10th percentile", "50th percentile", "90th percentile"];

    return grouped
      .map(([groupLabel, runEntries]) => ({
        label: groupLabel,
        values: runEntries
          .filter(([, value]) => value !== undefined && Number.isFinite(value))
          .map(([runNumber, value]) => ({
            x: Number(runNumber),
            value: value as number
          }))
          .sort((a, b) => a.x - b.x)
      }))
      .filter((series) => series.label !== "Outliers")
      .filter((series) => series.values.length > 1)
      .sort((a, b) => desiredOrder.indexOf(a.label) - desiredOrder.indexOf(b.label));
  }

  function buildIndividualSeries(
    allRuns: TRun[],
    metric: "pace" | "hr",
    athleteId: string
  ): Series[] {
    if (!athleteId) return [];

    let filtered = getBaseFilteredRuns(allRuns).filter((d) => d.athlete === athleteId);

    if (metric === "pace") {
      filtered = filtered.filter(
        (d) => Number.isFinite(d.pace_min_km) && d.pace_min_km < 15
      );
    } else {
      filtered = filtered.filter(
        (d) => d.avg_hr_bpm !== null && Number.isFinite(d.avg_hr_bpm)
      );
    }

    filtered = filtered
      .filter((d) => d.runNumber <= 120)
      .sort((a, b) => a.runNumber - b.runNumber);

    if (filtered.length <= 1) return [];

    const avgPercentile =
      d3.mean(filtered, (d) => d.percentile_avg_runs_week) ?? NaN;
    const groupLabel = getPercentileGroup(avgPercentile);

    return [
      {
        label: `${groupLabel}: ${athleteId}`,
        values: filtered.map((d) => ({
          x: d.runNumber,
          value: metric === "pace" ? d.pace_min_km : (d.avg_hr_bpm as number)
        }))
      }
    ];
  }

  async function loadCsv() {
    loading = true;
    errorMsg = "";

    try {
      const csvUrl = "/annotated-running-races.csv";

      const parsed = await d3.csv(csvUrl, (row) => {
        const athlete = (row["athlete"] ?? "").trim();
        const gender = (row["gender"] ?? "").trim();
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
          gender,
          timestamp: timestamp ?? new Date("invalid"),
          distance_m,
          elapsed_s,
          elev_gain_m,
          avg_hr_bpm,
          speed_kmh: Number(row["speed (km/hour)"]),
          climb_efficiency: Number(row["climb efficiency"]),
          efficiency: Number(row["efficiency"]),
          year_week: (row["year_week"] ?? "").trim(),
          percentile_avg_runs_week: Number(row["percentile_avg_runs_week"]),
          avg_runs_per_week: Number(row["avg_runs_per_week"]),
          runNumber: 0,
          pace_min_km
        } as TRun;
      });

      runs = addRunNumber(parsed.filter(Boolean) as TRun[]);

      groupPaceSeries = buildPercentileGroupSeries(runs, "pace");
      groupHrSeries = buildPercentileGroupSeries(runs, "hr");

      const athletes = [...new Set(runs.map((d) => d.athlete).filter(Boolean))].sort();
      selectedRunner = athletes[0] ?? "";
    } catch (err) {
      console.error(err);
      errorMsg = "Failed to load or process the CSV file.";
    } finally {
      loading = false;
    }
  }

  const runnerOptions = $derived(
    [...new Set(runs.map((d) => d.athlete).filter(Boolean))].sort()
  );

  const displayedGroupSeries = $derived(
    selectedMetric === "pace" ? groupPaceSeries : groupHrSeries
  );

  const displayedIndividualSeries = $derived(
    buildIndividualSeries(runs, selectedMetric, selectedRunner)
  );

  const mainTitle = $derived(
    selectedMetric === "pace"
      ? "Pace over Run Number by Percentile Group"
      : "Heart Rate over Run Number by Percentile Group"
  );

  const mainYLabel = $derived(
    selectedMetric === "pace" ? "Pace (min/km)" : "Heart Rate (bpm)"
  );

  const mainNote = $derived(
    selectedMetric === "pace"
      ? "Each line shows the average pace at each run number for the 10th, 50th, and 90th percentile groups. Lower values indicate faster pace."
      : "Each line shows the average heart rate at each run number for the 10th, 50th, and 90th percentile groups."
  );

  const individualTitle = $derived(
    selectedMetric === "pace"
      ? "Individual Runner Pace over Run Number"
      : "Individual Runner Heart Rate over Run Number"
  );

  const individualYLabel = $derived(
    selectedMetric === "pace" ? "Pace (min/km)" : "Heart Rate (bpm)"
  );

  const individualNote = $derived(
    selectedMetric === "pace"
      ? "This chart shows how a particular runner’s pace changes across their runs."
      : "This chart shows how a particular runner’s heart rate changes across their runs."
  );

  onMount(loadCsv);
</script>

<div class="container">
  <h1>Finding 3: Pace and Heart Rate Trends by Percentile Group</h1>

  <p class="description">
    This visualization compares runners based on percentile of average runs per week.
    The top chart shows average pace or heart rate trends for runners near the 10th,
    50th, and 90th percentiles of run frequency. The supplemental chart below
    shows each individual runner’s trend.
  </p>

  {#if loading}
    <p>Loading data...</p>
  {:else if errorMsg}
    <p class="error">{errorMsg}</p>
  {:else if displayedGroupSeries.length === 0}
    <p>No processed data available.</p>
  {:else}
    <div class="controls">
      <label for="metric-select">Metric:</label>
      <select id="metric-select" bind:value={selectedMetric}>
        <option value="pace">Pace</option>
        <option value="hr">Heart Rate</option>
      </select>
    </div>

    <Multiline2
      series={displayedGroupSeries}
      width={980}
      height={520}
      title={mainTitle}
      yLabel={mainYLabel}
      note={mainNote}
      metric={selectedMetric}
      legendTitle="Percentile Groups"
    />

    <div class="controls supplemental-controls">
      <label for="runner-select">Runner:</label>
      <select id="runner-select" bind:value={selectedRunner}>
        {#each runnerOptions as runner}
          <option value={runner}>{runner}</option>
        {/each}
      </select>
    </div>

    {#if displayedIndividualSeries.length > 0}
      <div class="supplemental">
        <Multiline2
          series={displayedIndividualSeries}
          width={980}
          height={520}
          title={individualTitle}
          yLabel={individualYLabel}
          note={individualNote}
          metric={selectedMetric}
          legendTitle="Runner Group"
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

  .description,
  .instructions {
    max-width: 900px;
    line-height: 1.5;
  }

  .instructions {
    margin-bottom: 18px;
    font-size: 0.96rem;
  }

  .controls {
    margin: 16px 0 18px 0;
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .supplemental-controls {
    margin-top: 24px;
  }

  .supplemental {
    margin-top: 20px;
  }

  select {
    font: inherit;
    padding: 4px 8px;
  }

  .error {
    color: #b00020;
  }
</style>