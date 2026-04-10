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

  type Props = {
    series: Series[];
    width?: number;
    height?: number;
    title?: string;
    yLabel?: string;
    note?: string;
    metric?: "pace" | "hr";
    legendTitle?: string;
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
    if (label.includes("10th percentile")) return "#4C72B0"; // blue
    if (label.includes("50th percentile")) return "#55A868"; // green
    if (label.includes("90th percentile")) return "#C44E52"; // red
    if (label.includes("Outliers")) return "#888888";        // darker gray
    return "#8172B3"; 
  }

  const xScale = $derived(
    d3.scaleLinear()
      .domain(
        allX.length
          ? [d3.min(allX)!, d3.max(allX)!]
          : [0, 1]
      )
      .nice()
      .range([usable.left, usable.right])
  );

  const yScale = $derived(
    d3.scaleLinear()
      .domain(
        allValues.length
          ? [d3.min(allValues)!, d3.max(allValues)!]
          : [0, 1]
      )
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

  let focusLabel: string | null = $state(null);
  let hoveredPoint: { label: string; x: number; value: number } | null = $state(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);

  function onSeriesHover(label: string, point: LinePoint, event: MouseEvent) {
    focusLabel = label;
    hoveredPoint = {
      label,
      x: point.x,
      value: point.value
    };

    if (!svgEl) return;
    const [mx, my] = d3.pointer(event, svgEl);
    tooltipX = mx;
    tooltipY = my;
  }

  function clearHover() {
    focusLabel = null;
    hoveredPoint = null;
  }

  const unitText = $derived(metric === "pace" ? "min/km" : "bpm");
</script>

<h3>{title}</h3>

{#if series.length}
  <svg bind:this={svgEl} {width} {height}>
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
          stroke-width={
            focusLabel === s.label
              ? 3.6
              : (s.label.includes("Outliers") ? 2.2 : 1.8)
          }
          opacity={
            focusLabel
              ? (focusLabel === s.label ? 1 : 0.18)
              : (s.label.includes("Outliers") ? 0.4 : 0.95)
          }
        />
      {/each}
    </g>

    <g class="points">
      {#each series as s (s.label)}
        {#each s.values as v (s.label + "-" + v.x)}
          <circle
            cx={xScale(v.x)}
            cy={yScale(v.value)}
            r={focusLabel === s.label ? 3 : 2}
            fill={getSeriesColor(s.label)}
            stroke={getSeriesColor(s.label)}
            stroke-width="1"
            opacity={
              focusLabel
                ? (focusLabel === s.label ? 1 : 0.18)
                : (s.label.includes("Outliers") ? 0.45 : 0.9)
            }
            onmouseover={(event) => onSeriesHover(s.label, v, event)}
            onfocus={(event) => onSeriesHover(s.label, v, event as unknown as MouseEvent)}
            onmouseout={clearHover}
            onblur={clearHover}
          />
        {/each}
      {/each}
    </g>

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
        <rect x="0" y={14 + i * 22} width="12" height="12" fill={getSeriesColor(label)} />
        <text x="18" y={24 + i * 22} font-size="12">{label}</text>
      {/each}
    </g>

    {#if hoveredPoint}
      {@const boxX = Math.min(tooltipX + 12, width - 260)}
      {@const boxY = Math.max(tooltipY - 60, 12)}
      <g class="tooltip" pointer-events="none">
        <rect
          x={boxX}
          y={boxY}
          width="245"
          height="74"
          rx="8"
          fill="white"
          stroke={getSeriesColor(hoveredPoint.label)}
        />
        <text x={boxX + 12} y={boxY + 20} font-size="12" font-weight="600" fill={getSeriesColor(hoveredPoint.label)}>
          {hoveredPoint.label}
        </text>
        <text x={boxX + 12} y={boxY + 40} font-size="12">
          Run Number: {hoveredPoint.x}
        </text>
        <text x={boxX + 12} y={boxY + 60} font-size="12">
          Value: {hoveredPoint.value.toFixed(2)} {unitText}
        </text>
      </g>
    {/if}
  </svg>
{/if}

<style>
  .lines path {
    vector-effect: non-scaling-stroke;
  }
</style>