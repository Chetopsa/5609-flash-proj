<script lang="ts">
  import * as d3 from "d3";

  type ImprovementPoint = {
    athlete: string;
    avgElevation: number;
    improvementPct: number;
    group: string;
    firstPace: number;
    lastPace: number;
  };

  type Props = {
    points: ImprovementPoint[];
    width?: number;
    height?: number;
    scrollProgress?: number; // 0–100, drives the group reveal
  };

  const props = $props<Props>();

  const points = $derived(props.points);
  const width = $derived(props.width ?? 980);
  const height = $derived(props.height ?? 520);
  const scrollProgress = $derived(props.scrollProgress ?? 100);

  // Which groups are visible based on scroll
  // 0–33  → only Low
  // 33–66 → Low + Medium
  // 66–100 → all three
  const visibleGroups = $derived(
    scrollProgress < 33
      ? ["Low"]
      : scrollProgress < 66
      ? ["Low", "Medium"]
      : ["Low", "Medium", "High"]
  );

  const margin = { top: 60, right: 200, bottom: 90, left: 90 };
  const groups = ["Low", "Medium", "High"];

  const groupLabels: Record<string, string> = {
    Low: "Low Elevation",
    Medium: "Medium Elevation",
    High: "High Elevation",
  };

  const usable = $derived({
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
  });

  function getColor(group: string): string {
    if (group.includes("Low")) return "#4C72B0";
    if (group.includes("Medium")) return "#55A868";
    if (group.includes("High")) return "#C44E52";
    return "#999";
  }

  const visiblePoints = $derived(
    points.filter((d) => d.improvementPct >= -45 && d.improvementPct <= 20)
  );

  const outlierPoints = $derived(
    points.filter((d) => d.improvementPct < -45 || d.improvementPct > 20)
  );

  const groupStats = $derived(
    groups.map((group) => {
      const groupPoints = points.filter((d) => d.group.includes(group));
      return {
        group,
        median: d3.median(groupPoints, (d) => d.improvementPct) ?? 0,
        count: groupPoints.length,
      };
    })
  );

  const xScale = $derived(
    d3.scalePoint<string>()
      .domain(groups)
      .range([usable.left, usable.right])
      .padding(0.5)
  );

  const yScale = $derived(
    d3.scaleLinear()
      .domain(
        visiblePoints.length
          ? (d3.extent(visiblePoints, (d) => d.improvementPct) as [number, number])
          : [-10, 10]
      )
      .nice()
      .range([usable.bottom, usable.top])
  );

  let xAxis: SVGGElement = $state();
  let yAxis: SVGGElement = $state();

  $effect(() => {
    if (xAxis && yAxis && points.length) {
      d3.select(xAxis).call(d3.axisBottom(xScale));
      d3.select(yAxis).call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d}%`));
    }
  });

  function jitterX(group: string, athlete: string): number {
    const base = xScale(group) ?? usable.left;
    let hash = 0;
    for (let i = 0; i < athlete.length; i++) {
      hash = athlete.charCodeAt(i) + ((hash << 5) - hash);
    }
    const offset = ((Math.abs(hash) % 100) / 100 - 0.5) * 70;
    return base + offset;
  }

  let hovered: ImprovementPoint | null = $state(null);

  // Insight callout shown per revealed group
  const insightText = $derived(
    visibleGroups.length === 1
      ? "Low elevation runners show the smallest slowdown — a median of –0.9%. Most cluster near zero."
      : visibleGroups.length === 2
      ? "Medium elevation runners show a –2.0% median decline. More spread than Low, but still close."
      : "High elevation runners show the largest median slowdown at –4.7%. Elevation adds difficulty, not necessarily speed."
  );
</script>

<!-- Narrative note -->
<p class="scatter-note">
  Each dot is one runner. <strong>Positive %</strong> = runner got faster over time.
  Runners are grouped by their average elevation gain per run (bottom third = Low, middle = Medium, top = High).
</p>

{#if points.length}
  <div class="scatter-wrap">
    <svg {width} {height}>
      <!-- Grid lines -->
      <g class="grid">
        {#each yScale.ticks(6) as tick}
          <line
            x1={usable.left}
            x2={usable.right}
            y1={yScale(tick)}
            y2={yScale(tick)}
          />
        {/each}
      </g>

      <!-- Zero line -->
      <line
        x1={usable.left}
        x2={usable.right}
        y1={yScale(0)}
        y2={yScale(0)}
        stroke="#555"
        stroke-width="1.5"
        stroke-dasharray="5,4"
        opacity="0.55"
      />
      <text
        x={usable.right + 6}
        y={yScale(0) + 4}
        font-size="10"
        fill="#777"
        font-style="italic"
      >no change</text>

      <!-- Dots — visible points -->
      {#each visiblePoints as p}
        {@const grp = p.group.includes("Low") ? "Low" : p.group.includes("Medium") ? "Medium" : "High"}
        {@const isVisible = visibleGroups.includes(grp)}
        <circle
          cx={jitterX(grp, p.athlete)}
          cy={yScale(p.improvementPct)}
          r={hovered?.athlete === p.athlete ? 7 : 5}
          fill={getColor(grp)}
          opacity={isVisible ? (hovered && hovered.athlete !== p.athlete ? 0.25 : 0.48) : 0}
          stroke={hovered?.athlete === p.athlete ? "white" : "none"}
          stroke-width="1.5"
          style="transition: opacity 400ms ease, r 120ms ease;"
          onmouseenter={() => (hovered = p)}
          onmouseleave={() => (hovered = null)}
        />
      {/each}

      <!-- Outlier dots clamped at edges -->
      {#each outlierPoints as p}
        {@const grp = p.group.includes("Low") ? "Low" : p.group.includes("Medium") ? "Medium" : "High"}
        {@const isVisible = visibleGroups.includes(grp)}
        <circle
          cx={jitterX(grp, p.athlete)}
          cy={p.improvementPct < -45 ? usable.bottom - 6 : usable.top + 6}
          r={hovered?.athlete === p.athlete ? 7 : 4.5}
          fill={getColor(grp)}
          opacity={isVisible ? 0.3 : 0}
          stroke="#333"
          stroke-width="1"
          style="transition: opacity 400ms ease;"
          onmouseenter={() => (hovered = p)}
          onmouseleave={() => (hovered = null)}
        />
      {/each}

      <!-- Median lines + labels -->
      {#each groupStats as stat}
        {@const x = xScale(stat.group) ?? usable.left}
        {@const isVisible = visibleGroups.includes(stat.group)}
        <line
          x1={x - 36}
          x2={x + 36}
          y1={yScale(stat.median)}
          y2={yScale(stat.median)}
          stroke={getColor(stat.group)}
          stroke-width="4.5"
          opacity={isVisible ? 0.95 : 0}
          style="transition: opacity 500ms ease;"
        />
        <text
          x={x + 46}
          y={yScale(stat.median) + 4}
          text-anchor="start"
          font-size="12"
          font-weight="700"
          fill={getColor(stat.group)}
          opacity={isVisible ? 1 : 0}
          style="transition: opacity 500ms ease;"
        >
          {stat.median.toFixed(1)}%
        </text>
        <text
          x={x}
          y={usable.bottom + 44}
          text-anchor="middle"
          font-size="11"
          fill="#666"
          opacity={isVisible ? 1 : 0}
          style="transition: opacity 500ms ease;"
        >
          n = {stat.count}
        </text>
      {/each}

      <!-- Axes -->
      <g transform={`translate(0, ${usable.bottom})`} bind:this={xAxis} />
      <g transform={`translate(${usable.left}, 0)`} bind:this={yAxis} />

      <!-- Axis labels -->
      <text
        x={(usable.left + usable.right) / 2}
        y={height - 18}
        text-anchor="middle"
        font-size="12"
        fill="#444"
      >Elevation Group</text>

      <text
        x="22"
        y={(usable.top + usable.bottom) / 2}
        text-anchor="middle"
        font-size="12"
        fill="#444"
        transform={`rotate(-90, 22, ${(usable.top + usable.bottom) / 2})`}
      >Pace Improvement (%)</text>

      <!-- Formula note -->
      <text x={usable.left} y={usable.top - 22} font-size="10.5" fill="#777" font-style="italic">
        Improvement = (first-half avg pace − second-half avg pace) / first-half avg pace × 100
      </text>

      <!-- Legend -->
      <g transform={`translate(${usable.right + 28}, ${usable.top + 10})`}>
        <text font-size="12" font-weight="700" fill="#333">Legend</text>
        {#each groups as grp, i}
          <circle cx="7" cy={22 + i * 22} r="5" fill={getColor(grp)} opacity="0.7" />
          <text x="20" y={26 + i * 22} font-size="12" fill="#333">{groupLabels[grp]}</text>
        {/each}
        <line x1="0" x2="24" y1={22 + groups.length * 22 + 14} y2={22 + groups.length * 22 + 14} stroke="#777" stroke-width="4.5" />
        <text x="32" y={22 + groups.length * 22 + 18} font-size="12" fill="#333">Median</text>
        <line
          x1="0" x2="24"
          y1={22 + groups.length * 22 + 36} y2={22 + groups.length * 22 + 36}
          stroke="#555" stroke-width="1.5" stroke-dasharray="5,4"
        />
        <text x="32" y={22 + groups.length * 22 + 40} font-size="12" fill="#333">No change</text>
      </g>

      <!-- Hover tooltip -->
      {#if hovered}
        {@const txLeft = usable.left + 14}
        {@const tyTop = usable.top + 14}
        <g class="tooltip" pointer-events="none">
          <rect x={txLeft} y={tyTop} width="320" height="128" rx="8" />
          <text x={txLeft + 14} y={tyTop + 22} font-size="12" font-weight="700" fill="#222">
            Runner #{hovered.athlete}
          </text>
          <text x={txLeft + 14} y={tyTop + 42} font-size="12" fill="#444">
            Group: {hovered.group}
          </text>
          <text x={txLeft + 14} y={tyTop + 62} font-size="12" fill="#444">
            Improvement: {hovered.improvementPct.toFixed(1)}%
          </text>
          <text x={txLeft + 14} y={tyTop + 82} font-size="12" fill="#444">
            First-half pace: {hovered.firstPace.toFixed(2)} → {hovered.lastPace.toFixed(2)} min/km
          </text>
          <text x={txLeft + 14} y={tyTop + 102} font-size="12" fill="#444">
            Avg elevation gain: {hovered.avgElevation.toFixed(1)} m/run
          </text>
        </g>
      {/if}
    </svg>

    <!-- Insight callout that changes as groups reveal -->
    <div class="insight-callout">
      <span class="insight-icon">💡</span>
      <p>{insightText}</p>
    </div>

    <!-- Manual group toggle buttons (shown once all groups are revealed) -->
    {#if scrollProgress >= 66}
      <div class="group-toggle-note">
        <em>All groups now visible. Hover any dot for runner details.</em>
      </div>
    {:else}
      <div class="group-toggle-note">
        <em>Keep scrolling to reveal the next elevation group…</em>
      </div>
    {/if}
  </div>
{:else}
  <p>No runners had enough valid runs for this chart.</p>
{/if}

<style>
  .scatter-note {
    margin: 0 0 8px;
    color: #555;
    font-size: 0.92rem;
    line-height: 1.5;
    max-width: 820px;
  }

  .scatter-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .grid line {
    stroke: #999;
    stroke-opacity: 0.13;
  }

  .tooltip rect {
    fill: white;
    stroke: #ddd;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.10));
  }

  .insight-callout {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: #f7f8fa;
    border-left: 3px solid #4C72B0;
    border-radius: 6px;
    padding: 10px 16px;
    max-width: 820px;
    font-size: 0.93rem;
    color: #333;
    line-height: 1.5;
    transition: all 300ms ease;
  }

  .insight-callout p {
    margin: 0;
  }

  .insight-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .group-toggle-note {
    font-size: 0.88rem;
    color: #888;
    max-width: 820px;
  }
</style>