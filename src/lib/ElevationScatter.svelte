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
  };

  const props = $props<Props>();

  const points = $derived(props.points);
  const width = $derived(props.width ?? 980);
  const height = $derived(props.height ?? 520);

  const margin = { top: 50, right: 300, bottom: 90, left: 90 };
  const groups = ["Low", "Medium", "High"];

  const usable = $derived({
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom
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
        count: groupPoints.length
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
          ? d3.extent(visiblePoints, (d) => d.improvementPct) as [number, number]
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
      d3.select(yAxis).call(d3.axisLeft(yScale));
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

  function pinPoint(point: ImprovementPoint) {
    pinned = pinned?.athlete === point.athlete ? null : point;
  }

  function handlePointKeydown(event: KeyboardEvent, point: ImprovementPoint) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pinPoint(point);
    }
  }
</script>

<p class="note">
  Each dot is a runner. Positive values mean the runner got faster from the first half of their runs to the second half.
</p>

{#if points.length}
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
      stroke-width="1"
      stroke-dasharray="4,4"
      opacity="0.6"
    />

    {#each visiblePoints as p}
      {@const group = p.group.includes("Low") ? "Low" : p.group.includes("Medium") ? "Medium" : "High"}

      <circle
        cx={jitterX(group, p.athlete)}
        cy={yScale(p.improvementPct)}
        r={hovered?.athlete === p.athlete || pinned?.athlete === p.athlete ? 7 : 4.5}
        fill={getColor(group)}
        opacity={pinned?.athlete === p.athlete ? "0.95" : "0.42"}
        stroke={pinned?.athlete === p.athlete ? "#222" : "white"}
        stroke-width={pinned?.athlete === p.athlete ? "2.2" : "1.2"}
        onmouseenter={() => hovered = p}
        onmouseleave={() => hovered = null}
        onclick={() => pinPoint(p)}
        onkeydown={(event) => handlePointKeydown(event, p)}
        role="button"
        tabindex="0"
        aria-label={`Pin runner ${p.athlete}`}
        style="cursor: pointer;"
      />
    {/each}

    {#each outlierPoints as p}
      {@const group = p.group.includes("Low") ? "Low" : p.group.includes("Medium") ? "Medium" : "High"}

      <circle
        cx={jitterX(group, p.athlete)}
        cy={p.improvementPct < -45 ? usable.bottom - 6 : usable.top + 6}
        r={hovered?.athlete === p.athlete || pinned?.athlete === p.athlete ? 7 : 4.5}
        fill={getColor(group)}
        opacity={pinned?.athlete === p.athlete ? "0.95" : "0.3"}
        stroke={pinned?.athlete === p.athlete ? "#222" : "#333"}
        stroke-width={pinned?.athlete === p.athlete ? "2.2" : "1"}
        onmouseenter={() => hovered = p}
        onmouseleave={() => hovered = null}
        onclick={() => pinPoint(p)}
        onkeydown={(event) => handlePointKeydown(event, p)}
        role="button"
        tabindex="0"
        aria-label={`Pin runner ${p.athlete}`}
        style="cursor: pointer;"
      />
    {/each}

    {#each groupStats as stat}
      {@const x = xScale(stat.group) ?? usable.left}

      <line
        x1={x - 32}
        x2={x + 32}
        y1={yScale(stat.median)}
        y2={yScale(stat.median)}
        stroke={getColor(stat.group)}
        stroke-width="4"
        opacity="0.95"
      />

      <text
        x={x + 42}
        y={yScale(stat.median) + 4}
        text-anchor="start"
        font-size="11"
        font-weight="700"
        fill={getColor(stat.group)}
      >
        {stat.median.toFixed(1)}%
      </text>

      <text
        x={x}
        y={usable.bottom + 42}
        text-anchor="middle"
        font-size="11"
        fill="#555"
      >
        n = {stat.count}
      </text>
    {/each}

    <g transform={`translate(0, ${usable.bottom})`} bind:this={xAxis} />
    <g transform={`translate(${usable.left}, 0)`} bind:this={yAxis} />

    <text
      x={(usable.left + usable.right) / 2}
      y={height - 22}
      text-anchor="middle"
      font-size="12"
    >
      Elevation Group
    </text>

    <text
      x="24"
      y={(usable.top + usable.bottom) / 2}
      text-anchor="middle"
      font-size="12"
      transform={`rotate(-90, 24, ${(usable.top + usable.bottom) / 2})`}
    >
      Pace Improvement (%)
    </text>

    <text
      x={usable.left}
      y={usable.top - 18}
      font-size="11"
      fill="#444"
    >
      Improvement = (first-half pace - second-half pace) / first-half pace × 100
    </text>

    <g transform={`translate(${usable.right + 28}, ${usable.top})`}>
      <text font-size="12" font-weight="700">How to read</text>

      <circle cx="7" cy="25" r="5" fill="#777" opacity="0.55" />
      <text x="22" y="29" font-size="12">Runner</text>

      <line x1="0" x2="26" y1="52" y2="52" stroke="#777" stroke-width="5" />
      <text x="34" y="56" font-size="12">Median</text>

      <line
        x1="0"
        x2="26"
        y1="82"
        y2="82"
        stroke="#555"
        stroke-width="1"
        stroke-dasharray="4,4"
      />
      <text x="34" y="86" font-size="12">No change</text>
    </g>

    {#if pinned}
      <g class="pinned-box">
        <rect
          x={usable.right + 28}
          y={usable.top + 118}
          width="265"
          height="168"
          rx="10"
        />
    
        <text x={usable.right + 45} y={usable.top + 145} font-size="14" font-weight="700">
          Runner #{pinned.athlete}
        </text>
    
        <text x={usable.right + 45} y={usable.top + 172} font-size="12">
          Group: {pinned.group}
        </text>
    
        <text x={usable.right + 45} y={usable.top + 194} font-size="12">
          Improvement: {pinned.improvementPct.toFixed(1)}%
        </text>
    
        <text x={usable.right + 45} y={usable.top + 216} font-size="12">
          Pace: {pinned.firstPace.toFixed(2)} → {pinned.lastPace.toFixed(2)}
        </text>
    
        <text x={usable.right + 45} y={usable.top + 238} font-size="12">
          Average elevation: {pinned.avgElevation.toFixed(1)} m/run
        </text>
    
        <text x={usable.right + 45} y={usable.top + 268} font-size="10.5" fill="#666">
          Click the same point again to unpin
        </text>
      </g>
    {/if}
  </svg>
{:else}
  <p>No runners had enough valid runs for this chart.</p>
{/if}

<style>
  .note {
    margin-top: -4px;
    color: #555;
    font-size: 0.95rem;
  }

  .grid line {
    stroke: #999;
    stroke-opacity: 0.12;
  }

  .pinned-box rect {
    fill: white;
    stroke: #ccc;
  }

  circle {
    transition:
      r 0.25s ease,
      opacity 0.25s ease,
      stroke-width 0.25s ease,
      transform 0.25s ease;
  }

  .pinned-point {
    animation: pulseScatter 1.3s ease-in-out infinite alternate;
  }

  .pinned-box {
    animation: fadeIn 0.6s ease;
  }

  @keyframes pulseScatter {
    from {
      opacity: 0.75;
      stroke-width: 1.5;
    }

    to {
      opacity: 1;
      stroke-width: 3;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>