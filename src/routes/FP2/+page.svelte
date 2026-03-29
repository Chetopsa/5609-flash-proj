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
      pace_min_km: number;
      elev_exposure: number;
    };
  
    type LinePoint = {
      date: Date;
      value: number;
    };
  
    type Series = {
      label: string;
      values: LinePoint[];
    };
  
    let runs: TRun[] = $state([]);
    let paceSeries: Series[] = $state([]);
    let hrSeries: Series[] = $state([]);
    let loading = $state(true);
    let errorMsg = $state("");
  
    let selectedMetric: "pace" | "hr" = $state("pace");
    let selectedAthlete = $state("");
  
    const parseTime = d3.timeParse("%d/%m/%Y %H:%M");
  
    function movingAverage(values: LinePoint[], windowSize = 3): LinePoint[] {
      const out: LinePoint[] = [];
  
      for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const slice = values.slice(start, i + 1);
        const avg = d3.mean(slice, (d) => d.value) ?? values[i].value;
  
        out.push({
          date: values[i].date,
          value: avg
        });
      }
  
      return out;
    }
  
    function getQuantile(sorted: number[], q: number): number {
      if (!sorted.length) return NaN;
      return d3.quantileSorted(sorted, q) ?? NaN;
    }
  
    function getAthleteGroupMap(filteredRuns: TRun[]): Map<string, string> {
      const athleteGroups = d3
        .rollups(
          filteredRuns,
          (group) => d3.mean(group, (d) => d.elev_exposure) ?? 0,
          (d) => d.athlete
        )
        .map(([athlete, avg_hilliness]) => ({
          athlete,
          avg_hilliness
        }));
  
      const sortedHilliness = athleteGroups
        .map((d) => d.avg_hilliness)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
  
      const q25 = getQuantile(sortedHilliness, 0.25);
      const q75 = getQuantile(sortedHilliness, 0.75);
  
      const athleteToGroup = new Map<string, string>();
  
      for (const d of athleteGroups) {
        if (d.avg_hilliness <= q25) {
          athleteToGroup.set(d.athlete, "Low elevation group (bottom 25%)");
        } else if (d.avg_hilliness >= q75) {
          athleteToGroup.set(d.athlete, "High elevation group (top 25%)");
        }
      }
  
      return athleteToGroup;
    }
  
    function getBaseFilteredRuns(allRuns: TRun[]): TRun[] {
      return allRuns.filter((d) => {
        return (
          d.athlete &&
          d.timestamp instanceof Date &&
          !Number.isNaN(d.timestamp.getTime()) &&
          Number.isFinite(d.distance_m) &&
          Number.isFinite(d.elapsed_s) &&
          Number.isFinite(d.elev_gain_m) &&
          Number.isFinite(d.elev_exposure) &&
          d.distance_m > 0 &&
          d.elapsed_s > 0 &&
          d.timestamp.getFullYear() >= 2010 &&
          d.timestamp.getFullYear() <= 2021
        );
      });
    }
  
    function getPaceSeries(allRuns: TRun[]): Series[] {
      const filtered = getBaseFilteredRuns(allRuns).filter(
        (d) => Number.isFinite(d.pace_min_km) && d.pace_min_km >= 3 && d.pace_min_km <= 10
      );
  
      const athleteToGroup = getAthleteGroupMap(filtered);
  
      const runsWithGroup = filtered
        .map((d) => ({
          ...d,
          group: athleteToGroup.get(d.athlete),
          month: new Date(d.timestamp.getFullYear(), d.timestamp.getMonth(), 1)
        }))
        .filter((d) => d.group);
  
      const monthlyAthlete = d3.rollups(
        runsWithGroup,
        (group) => d3.mean(group, (d) => d.pace_min_km) ?? 0,
        (d) => d.group as string,
        (d) => d.athlete,
        (d) => d.month.getTime()
      );
  
      const athleteMonthRows: { group: string; month: Date; value: number }[] = [];
  
      for (const [group, athletes] of monthlyAthlete) {
        for (const [, months] of athletes) {
          for (const [monthMs, value] of months) {
            athleteMonthRows.push({
              group,
              month: new Date(Number(monthMs)),
              value
            });
          }
        }
      }
  
      const monthlyGroup = d3.rollups(
        athleteMonthRows,
        (group) => d3.mean(group, (d) => d.value) ?? 0,
        (d) => d.group,
        (d) => d.month.getTime()
      );
  
      const series: Series[] = monthlyGroup.map(([group, months]) => {
        const values = months
          .map(([monthMs, value]) => ({
            date: new Date(Number(monthMs)),
            value
          }))
          .sort((a, b) => a.date.getTime() - b.date.getTime());
  
        return {
          label: group,
          values: movingAverage(values, 3)
        };
      });
  
      const desiredOrder = [
        "Low elevation group (bottom 25%)",
        "High elevation group (top 25%)"
      ];
  
      return series.sort(
        (a, b) => desiredOrder.indexOf(a.label) - desiredOrder.indexOf(b.label)
      );
    }
  
    function getHrSeries(allRuns: TRun[]): Series[] {
      const filtered = getBaseFilteredRuns(allRuns).filter(
        (d) => d.avg_hr_bpm !== null && Number.isFinite(d.avg_hr_bpm)
      );
  
      const athleteToGroup = getAthleteGroupMap(filtered);
  
      const runsWithGroup = filtered
        .map((d) => ({
          ...d,
          group: athleteToGroup.get(d.athlete),
          month: new Date(d.timestamp.getFullYear(), d.timestamp.getMonth(), 1)
        }))
        .filter((d) => d.group);
  
      const monthlyAthlete = d3.rollups(
        runsWithGroup,
        (group) => d3.mean(group, (d) => d.avg_hr_bpm as number) ?? 0,
        (d) => d.group as string,
        (d) => d.athlete,
        (d) => d.month.getTime()
      );
  
      const athleteMonthRows: { group: string; month: Date; value: number }[] = [];
  
      for (const [group, athletes] of monthlyAthlete) {
        for (const [, months] of athletes) {
          for (const [monthMs, value] of months) {
            athleteMonthRows.push({
              group,
              month: new Date(Number(monthMs)),
              value
            });
          }
        }
      }
  
      const monthlyGroup = d3.rollups(
        athleteMonthRows,
        (group) => d3.mean(group, (d) => d.value) ?? 0,
        (d) => d.group,
        (d) => d.month.getTime()
      );
  
      const series: Series[] = monthlyGroup.map(([group, months]) => {
        const values = months
          .map(([monthMs, value]) => ({
            date: new Date(Number(monthMs)),
            value
          }))
          .sort((a, b) => a.date.getTime() - b.date.getTime());
  
        return {
          label: group,
          values: movingAverage(values, 3)
        };
      });
  
      const desiredOrder = [
        "Low elevation group (bottom 25%)",
        "High elevation group (top 25%)"
      ];
  
      return series.sort(
        (a, b) => desiredOrder.indexOf(a.label) - desiredOrder.indexOf(b.label)
      );
    }
  
    function getIndividualSeries(
      allRuns: TRun[],
      athleteId: string,
      metric: "pace" | "hr"
    ): Series[] {
      if (!athleteId) return [];
  
      let filtered = getBaseFilteredRuns(allRuns).filter((d) => d.athlete === athleteId);
  
      if (metric === "pace") {
        filtered = filtered.filter(
          (d) => Number.isFinite(d.pace_min_km) && d.pace_min_km >= 3 && d.pace_min_km <= 10
        );
      } else {
        filtered = filtered.filter(
          (d) => d.avg_hr_bpm !== null && Number.isFinite(d.avg_hr_bpm)
        );
      }
  
      const monthly = d3.rollups(
        filtered,
        (group) =>
          metric === "pace"
            ? d3.mean(group, (d) => d.pace_min_km) ?? 0
            : d3.mean(group, (d) => d.avg_hr_bpm as number) ?? 0,
        (d) => new Date(d.timestamp.getFullYear(), d.timestamp.getMonth(), 1).getTime()
      );
  
      const values = monthly
        .map(([monthMs, value]) => ({
          date: new Date(Number(monthMs)),
          value
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
  
      return [
        {
          label: athleteId,
          values: movingAverage(values, 3)
        }
      ];
    }
  
    async function loadCsv() {
      loading = true;
      errorMsg = "";
  
      try {
        const csvUrl = "/fp-dataset.csv";
  
        const parsed = await d3.dsv(";", csvUrl, (row) => {
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
  
          const elev_exposure =
            distance_m > 0 ? elev_gain_m / distance_m : NaN;
  
          return {
            athlete,
            gender,
            timestamp: timestamp ?? new Date("invalid"),
            distance_m,
            elapsed_s,
            elev_gain_m,
            avg_hr_bpm,
            pace_min_km,
            elev_exposure
          } as TRun;
        });
  
        runs = parsed.filter(Boolean) as TRun[];
        paceSeries = getPaceSeries(runs);
        hrSeries = getHrSeries(runs);
  
        const athletes = [...new Set(runs.map((d) => d.athlete).filter(Boolean))].sort();
        selectedAthlete = athletes[0] ?? "";
      } catch (err) {
        console.error(err);
        errorMsg = "Failed to load or process the CSV file.";
      } finally {
        loading = false;
      }
    }
  
    const athleteOptions = $derived(
      [...new Set(runs.map((d) => d.athlete).filter(Boolean))].sort()
    );
  
    const displayedSeries = $derived(
      selectedMetric === "pace" ? paceSeries : hrSeries
    );
  
    const chartTitle = $derived(
      selectedMetric === "pace"
        ? "Monthly Pace Trends by Elevation Group"
        : "Monthly Heart Rate Trends by Elevation Group"
    );
  
    const chartYLabel = $derived(
      selectedMetric === "pace" ? "Avg pace (min/km)" : "Avg heart rate (bpm)"
    );
  
    const chartNote = $derived(
      selectedMetric === "pace"
        ? "Downward trend means faster pace"
        : "Higher values indicate higher average heart rate"
    );
  
    const displayedIndividualSeries = $derived(
      getIndividualSeries(runs, selectedAthlete, selectedMetric)
    );
  
    const individualTitle = $derived(
      selectedMetric === "pace"
        ? "Individual Runner Pace Trend"
        : "Individual Runner Heart Rate Trend"
    );
  
    const individualYLabel = $derived(
      selectedMetric === "pace" ? "Avg pace (min/km)" : "Avg heart rate (bpm)"
    );
  
    const individualNote = $derived(
      selectedMetric === "pace"
        ? "Downward trend means faster pace"
        : "Higher values indicate higher average heart rate"
    );
  
    onMount(loadCsv);
  </script>
  
  <div class="container">
    <h1>Finding 3: How different Elevation Groups affect Pace and Heart Rate</h1>
  
    <p class="description">
        This chart shows how pace and heart rate change over time for runners in different elevation groups. A supplementary chart is provided for individual runners to illustrate how their pace and heart rate evolved over time.
    </p>
  
    <p class="instructions">
      Note: Each dot represents a month with valid data after preprocessing. In the group chart, it is the monthly group average; in the individual chart, it is that runner’s monthly average.
    </p>
  
    {#if loading}
      <p>Loading data...</p>
    {:else if errorMsg}
      <p class="error">{errorMsg}</p>
    {:else if displayedSeries.length === 0}
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
        series={displayedSeries}
        width={980}
        height={500}
        title={chartTitle}
        yLabel={chartYLabel}
        note={chartNote}
        metric={selectedMetric}
        legendTitle="Elevation Groups"
      />
  
      <div class="controls second-controls">
        <label for="athlete-select">Runner:</label>
        <select id="athlete-select" bind:value={selectedAthlete}>
          {#each athleteOptions as athlete}
            <option value={athlete}>{athlete}</option>
          {/each}
        </select>
      </div>
  
      <Multiline2
        series={displayedIndividualSeries}
        width={980}
        height={500}
        title={individualTitle}
        yLabel={individualYLabel}
        note={individualNote}
        metric={selectedMetric}
        legendTitle="Runner"
      />
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
  
    .second-controls {
      margin-top: 28px;
    }
  
    select {
      font: inherit;
      padding: 4px 8px;
    }
  
    .error {
      color: #b00020;
    }
  </style>
