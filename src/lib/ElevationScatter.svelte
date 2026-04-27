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
    scrollProgress?: number;
  };

  const props = $props<Props>();

  const points = $derived(props.points);
  const width = $derived(props.width ?? 820);
  const height = $derived(props.height ?? 520);
  const scrollProgress = $derived(props.scrollProgress ?? 100);

  const visibleGroups = $derived(
    scrollProgress < 33
      ? ["Low"]
      : scrollProgress < 66
      ? ["Low", "Medium"]
      : ["Low", "Medium", "High"]
  );

  const margin = { top: 60, right: 40, bottom: 90, left: 90 };
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
    d3
      .scalePoint<string>()
      .domain(groups)
      .range([usable.left, usable.right])
      .padding(0.5)
  );

  const yScale = $derived(
    d3
      .scaleLinear()
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
      d3.select(yAxis).call(
        d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d}%`)
      );
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
  let pinned: ImprovementPoint | null = $state(null);

  // Preview on hover, but pinned point stays when clicked
  const activePoint = $derived(pinned ?? hovered);

  const panelTitle = $derived(
    pinned ? "Pinned Runner" : hovered ? "Preview Runner" : "Runner Details"
  );

  const insightText = $derived(
    visibleGroups.length === 1
      ? "Low elevation runners show the smallest slowdown — a median of –0.9%. Most cluster near zero."
      : visibleGroups.length === 2
      ? "Medium elevation runners show a –2.0% median decline. More spread than Low, but still close."
      : "High elevation runners show the largest median slowdown at –4.7%. Elevation adds difficulty, not necessarily speed."
  );
</script>

<p class="scatter-note">
  Each dot is one runner. <strong>Positive %</strong> = runner got faster over time.
  Runners are grouped by their average elevation gain per run.
</p>

{#if points.length}
  <div class="scatter-layout">
    <div class="chart-side">
      <svg {width} {height}>
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
          x={usable.right - 45}
          y={yScale(0) + 10}
          font-size="10"
          fill="#777"
          font-style="italic"
        >
          no change
        </text>

        {#each visiblePoints as p}
          {@const grp = p.group.includes("Low") ? "Low" : p.group.includes("Medium") ? "Medium" : "High"}
          {@const isVisible = visibleGroups.includes(grp)}
          {@const isActive = activePoint?.athlete === p.athlete}

          <circle
            cx={jitterX(grp, p.athlete)}
            cy={yScale(p.improvementPct)}
            r={isActive ? 7 : 5}
            fill={getColor(grp)}
            opacity={isVisible ? (activePoint && !isActive ? 0.25 : 0.55) : 0}
            stroke={isActive ? "white" : "none"}
            stroke-width="2"
            class:pinned-point={pinned?.athlete === p.athlete}
            onmouseenter={() => (hovered = p)}
            onmouseleave={() => (hovered = null)}
            onclick={() => {
              pinned = pinned?.athlete === p.athlete ? null : p;
            }}
          />
        {/each}

        {#each outlierPoints as p}
          {@const grp = p.group.includes("Low") ? "Low" : p.group.includes("Medium") ? "Medium" : "High"}
          {@const isVisible = visibleGroups.includes(grp)}
          {@const isActive = activePoint?.athlete === p.athlete}

          <circle
            cx={jitterX(grp, p.athlete)}
            cy={p.improvementPct < -45 ? usable.bottom - 6 : usable.top + 6}
            r={isActive ? 7 : 4.5}
            fill={getColor(grp)}
            opacity={isVisible ? (activePoint && !isActive ? 0.25 : 0.45) : 0}
            stroke={isActive ? "white" : "#333"}
            stroke-width={isActive ? 2 : 1}
            class:pinned-point={pinned?.athlete === p.athlete}
            onmouseenter={() => (hovered = p)}
            onmouseleave={() => (hovered = null)}
            onclick={() => {
              pinned = pinned?.athlete === p.athlete ? null : p;
            }}
          />
        {/each}

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
          />

          <text
            x={x + 46}
            y={yScale(stat.median) + 4}
            text-anchor="start"
            font-size="12"
            font-weight="700"
            fill={getColor(stat.group)}
            opacity={isVisible ? 1 : 0}
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
          >
            n = {stat.count}
          </text>
        {/each}

        <g transform={`translate(0, ${usable.bottom})`} bind:this={xAxis} />
        <g transform={`translate(${usable.left}, 0)`} bind:this={yAxis} />

        <text
          x={(usable.left + usable.right) / 2}
          y={height - 18}
          text-anchor="middle"
          font-size="12"
          fill="#444"
        >
          Elevation Group
        </text>

        <text
          x="22"
          y={(usable.top + usable.bottom) / 2}
          text-anchor="middle"
          font-size="12"
          fill="#444"
          transform={`rotate(-90, 22, ${(usable.top + usable.bottom) / 2})`}
        >
          Pace Improvement (%)
        </text>

        <text
          x={usable.left}
          y={usable.top - 22}
          font-size="10.5"
          fill="#777"
          font-style="italic"
        >
          Improvement = (first-half avg pace − second-half avg pace) / first-half avg pace × 100
        </text>
      </svg>

      <div class="insight-callout">
        <span class="insight-icon">💡</span>
        <p>{insightText}</p>
      </div>
    </div>

    <aside class="runner-panel" class:expanded={activePoint}>
      <h3>{panelTitle}</h3>

      <div class="legend-block">
        <h4>Elevation Groups</h4>

        {#each groups as grp}
          <div class="legend-row">
            <span class="legend-dot" style={`background:${getColor(grp)}`}></span>
            <span>{groupLabels[grp]}</span>
          </div>
        {/each}

        <div class="legend-row median-row">
          <span class="median-line"></span>
          <span>Group Median</span>
        </div>
      </div>

      {#if activePoint}
        <div class="detail-card">
          <p><strong>Runner:</strong> #{activePoint.athlete}</p>
          <p><strong>Group:</strong> {activePoint.group}</p>
          <p><strong>Improvement:</strong> {activePoint.improvementPct.toFixed(1)}%</p>
          <p>
            <strong>Pace:</strong>
            {activePoint.firstPace.toFixed(2)} → {activePoint.lastPace.toFixed(2)} min/km
          </p>
          <p><strong>Avg elevation:</strong> {activePoint.avgElevation.toFixed(1)} m/run</p>

          {#if pinned}
            <p class="panel-hint">Pinned. Click the same point again to unpin.</p>
          {:else}
            <p class="panel-hint">Previewing. Click this point to pin it.</p>
          {/if}
        </div>
      {:else}
        <div class="detail-card empty">
          Hover over a point to preview runner details. Click a point to pin it.
        </div>
      {/if}
    </aside>
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

  .scatter-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: 12px;
  }

  .chart-side {
    min-width: 0;
    overflow-x: auto;
  }

  .grid line {
    stroke: #999;
    stroke-opacity: 0.13;
  }

  circle {
    cursor: pointer;
    transition:
      r 0.25s ease,
      opacity 0.25s ease,
      stroke-width 0.25s ease;
  }

  .pinned-point {
    filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.35));
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
  }

  .insight-callout p {
    margin: 0;
  }

  .insight-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .runner-panel {
    margin-top: 66px;
    padding: 14px 16px;
    border: 1px solid #d6d6d6;
    border-radius: 14px;
    background: white;
    height: fit-content;
    min-height: 0;
    font-size: 0.82rem;
  }

  .runner-panel.expanded {
    min-height: 250px;
  }

  .runner-panel h3 {
    margin: 0 0 12px;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .legend-block {
    margin-bottom: 14px;
  }

  .legend-block h4 {
    margin: 0 0 8px;
    font-size: 0.9rem;
    font-weight: 700;
  }

  .legend-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0;
    color: #333;
  }

  .legend-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .median-row {
    margin-top: 10px;
  }

  .median-line {
    width: 24px;
    height: 0;
    border-top: 4px solid #777;
    flex-shrink: 0;
  }

  .detail-card {
    padding: 12px 0 0;
    border-top: 1px solid #eee;
  }

  .detail-card p {
    margin: 6px 0;
    line-height: 1.35;
  }

  .panel-hint {
    margin-top: 12px !important;
    color: #777;
    font-style: italic;
  }

  .empty {
    color: #777;
    font-style: italic;
    line-height: 1.45;
  }
</style>