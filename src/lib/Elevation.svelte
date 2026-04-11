<script lang="ts">
  import * as d3 from "d3";

  type LinePoint = {
    x: number;
    value: number;
  };

  type Series = {
    label: string;
    values: LinePoint[];
  };

  type MetricType = "pace" | "hr" | "elevation";

  type Props = {
    series: Series[];
    width?: number;
    height?: number;
    title?: string;
    yLabel?: string;
    note?: string;
    metric?: MetricType;
    legendTitle?: string;
    totalRuns?: number;
  };

  const props = $props<Props>();

  const series = $derived(props.series);
  const width = $derived(props.width ?? 950);
  const height = $derived(props.height ?? 450);
  const title = $derived(props.title ?? "Run Trends");
  const yLabel = $derived(props.yLabel ?? "Value");
  const note = $derived(props.note ?? "");
  const metric = $derived(props.metric ?? "pace");
  const legendTitle = $derived(props.legendTitle ?? "Legend");
  const totalRuns = $derived(props.totalRuns ?? null);

  const margin = { top: 35, right: 250, bottom: 70, left: 85 };

  const usable = $derived({
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom
  });

  const allPoints = $derived(series.flatMap((s) => s.values));
  const allX = $derived(allPoints.map((d) => d.x));
  const allValues = $derived(allPoints.map((d) => d.value));
  const labels = $derived(series.map((s) => s.label));

  function getSeriesColor(label: string): string {
    if (label.includes("10th percentile")) return "#4C72B0";
    if (label.includes("50th percentile")) return "#55A868";
    if (label.includes("90th percentile")) return "#C44E52";
    return "#333";
  }

  const xScale = $derived(
    d3.scaleLinear()
      .domain(allX.length ? [d3.min(allX)!, d3.max(allX)!] : [0, 1])
      .nice()
      .range([usable.left, usable.right])
  );

  const yScale = $derived(
    d3.scaleLinear()
      .domain(allValues.length ? [d3.min(allValues)!, d3.max(allValues)!] : [0, 1])
      .nice()
      .range([usable.bottom, usable.top])
  );

  const lineGen = $derived(
    d3.line<LinePoint>()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX)
  );

  let xAxis: SVGGElement = $state();
  let yAxis: SVGGElement = $state();
  let svgEl: SVGSVGElement = $state();

  function updateAxis() {
    d3.select(xAxis).call(
      d3.axisBottom(xScale)
        .ticks(8)
        .tickFormat(d3.format("d"))
    );

    d3.select(yAxis).call(d3.axisLeft(yScale));
  }

  $effect(() => {
    if (xAxis && yAxis && series.length) updateAxis();
  });

  const unitText = $derived(
    metric === "pace" ? "min/km" :
    metric === "hr" ? "bpm" :
    "m"
  );

  let hoverX = $state<number | null>(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);

  function handleSvgMouseMove(event: MouseEvent) {
    if (!svgEl) return;

    const [mx, my] = d3.pointer(event, svgEl);

    if (
      mx < usable.left ||
      mx > usable.right ||
      my < usable.top ||
      my > usable.bottom
    ) {
      hoverX = null;
      return;
    }

    hoverX = mx;
    tooltipX = mx;
    tooltipY = my;
  }

  function clearHover() {
    hoverX = null;
  }

  const hoverRun = $derived(
    hoverX !== null ? Math.round(xScale.invert(hoverX)) : null
  );

  function getClosestPoint(points: LinePoint[], run: number): LinePoint | null {
    if (!points.length) return null;

    return points.reduce((best, current) => {
      return Math.abs(current.x - run) < Math.abs(best.x - run) ? current : best;
    });
  }

  const hoverData = $derived(
    hoverRun === null
      ? []
      : series
          .map((s) => ({
            label: s.label,
            point: getClosestPoint(s.values, hoverRun)
          }))
          .filter((d): d is { label: string; point: LinePoint } => d.point !== null)
  );

  const focusLabel = $derived(
    hoverData.length === 1 ? hoverData[0].label : null
  );
</script>

<h3>{title}</h3>

{#if series.length}
  <svg
    bind:this={svgEl}
    {width}
    {height}
    onmousemove={handleSvgMouseMove}
    onmouseleave={clearHover}
  >
    <g class="grid">
      {#each yScale.ticks(6) as tick}
        <line
          x1={usable.left}
          x2={usable.right}
          y1={yScale(tick)}
          y2={yScale(tick)}
          stroke="#999"
          stroke-opacity="0.15"
        />
      {/each}
    </g>

    <g class="grid">
      {#each xScale.ticks(8) as tick}
        <line
          x1={xScale(tick)}
          x2={xScale(tick)}
          y1={usable.top}
          y2={usable.bottom}
          stroke="#999"
          stroke-opacity="0.08"
        />
      {/each}
    </g>

    <g class="lines">
      {#each series as s (s.label)}
        <path
          d={lineGen(s.values) ?? ""}
          fill="none"
          stroke={getSeriesColor(s.label)}
          stroke-width={focusLabel === s.label ? 3.2 : 2}
          opacity={hoverRun !== null ? 0.78 : 0.85}
        />
      {/each}
    </g>

    <g class="points">
      {#each series as s (s.label)}
        {#each s.values as v (s.label + "-" + v.x)}
          <circle
            cx={xScale(v.x)}
            cy={yScale(v.value)}
            r="2"
            fill={getSeriesColor(s.label)}
            stroke={getSeriesColor(s.label)}
            stroke-width="1"
            opacity="0.55"
          />
        {/each}
      {/each}
    </g>

    {#if hoverRun !== null && hoverData.length > 0}
      <line
        x1={xScale(hoverRun)}
        x2={xScale(hoverRun)}
        y1={usable.top}
        y2={usable.bottom}
        stroke="#888"
        stroke-width="1"
        stroke-dasharray="4,4"
        opacity="0.8"
      />

      {#each hoverData as d}
        <circle
          cx={xScale(d.point.x)}
          cy={yScale(d.point.value)}
          r="4"
          fill={getSeriesColor(d.label)}
          stroke="white"
          stroke-width="1.5"
        />
      {/each}
    {/if}

    <g transform={`translate(0, ${usable.bottom})`} bind:this={xAxis} />
    <g transform={`translate(${usable.left}, 0)`} bind:this={yAxis} />

    <text
      x={(usable.left + usable.right) / 2}
      y={height - 15}
      text-anchor="middle"
      font-size="12"
    >
      Run Number
    </text>

    <text
      x={22}
      y={(usable.top + usable.bottom) / 2}
      text-anchor="middle"
      font-size="12"
      transform={`rotate(-90, 22, ${(usable.top + usable.bottom) / 2})`}
    >
      {yLabel}
    </text>

    {#if note}
      <text x={usable.left} y={usable.top - 12} font-size="11" fill="#444">
        {note}
      </text>
    {/if}

    <g transform={`translate(${usable.right + 26}, ${usable.top + 10})`}>
      <text x="0" y="0" font-size="12" font-weight="600">{legendTitle}</text>

      {#each labels as label, i (label)}
        <rect
          x="0"
          y={14 + i * 22}
          width="12"
          height="12"
          fill={getSeriesColor(label)}
        />
        <text x="18" y={24 + i * 22} font-size="12">{label}</text>
      {/each}

      {#if totalRuns !== null}
        <text
          x="0"
          y={14 + labels.length * 22 + 10}
          font-size="12"
          font-weight="500"
          fill="#666"
        >
          Total runs: {totalRuns}
        </text>
      {/if}
    </g>

    {#if hoverRun !== null && hoverData.length > 0}
      {@const boxX = Math.min(xScale(hoverRun) + 14, width - 280)}
      {@const boxY = usable.top + 20}
      {@const boxHeight = 34 + hoverData.length * 22}

      <g class="tooltip" pointer-events="none">
        <rect
          x={boxX}
          y={boxY}
          width="260"
          height={boxHeight}
          rx="8"
          fill="white"
          stroke="#ccc"
        />

        <text
          x={boxX + 12}
          y={boxY + 20}
          font-size="12"
          font-weight="700"
          fill="#333"
        >
          Run Number: {hoverRun}
        </text>

        {#each hoverData as d, i}
          <rect
            x={boxX + 12}
            y={boxY + 30 + i * 22}
            width="10"
            height="10"
            fill={getSeriesColor(d.label)}
          />
          <text
            x={boxX + 28}
            y={boxY + 39 + i * 22}
            font-size="12"
            fill="#333"
          >
            {d.label}: {d.point.value.toFixed(2)} {unitText}
          </text>
        {/each}
      </g>
    {/if}
  </svg>
{/if}

<style>
  .lines path {
    vector-effect: non-scaling-stroke;
  }
</style>