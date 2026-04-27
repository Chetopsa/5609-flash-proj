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

  type MetricType = "pace" | "hr";

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
    scrollProgress?: number; // 0–100, drives left-to-right line reveal
  };

  const props = $props<Props>();

  const series = $derived(props.series);
  const width = $derived(props.width ?? 950);
  const height = $derived(props.height ?? 450);
  const title = $derived(props.title ?? "Run Trends");
  const yLabel = $derived(props.yLabel ?? "Value");
  const note = $derived(props.note ?? "");
  const metric = $derived(props.metric ?? "hr");
  const legendTitle = $derived(props.legendTitle ?? "Legend");
  const totalRuns = $derived(props.totalRuns ?? null);
  // Default to fully revealed when no scrollProgress passed (e.g. individual explorer)
  const scrollProgress = $derived(props.scrollProgress ?? 100);

  const margin = { top: 50, right: 220, bottom: 70, left: 85 };

  const usable = $derived({
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
  });

  const allPoints = $derived(series.flatMap((s) => s.values));
  const allX = $derived(allPoints.map((d) => d.x));
  const allValues = $derived(allPoints.map((d) => d.value));
  const labels = $derived(series.map((s) => s.label));

  const xMin = $derived(allX.length ? d3.min(allX)! : 0);
  const xMax = $derived(allX.length ? d3.max(allX)! : 1);

  // Data x value up to which lines are revealed
  const revealedXMax = $derived(xMin + (xMax - xMin) * (scrollProgress / 100));

  function getSeriesColor(label: string): string {
    if (label.includes("Low")) return "#4C72B0";
    if (label.includes("Medium")) return "#55A868";
    if (label.includes("High")) return "#C44E52";
    return "#E83E8C";
  }

  const xScale = $derived(
    d3.scaleLinear()
      .domain(allX.length ? [xMin, xMax] : [0, 1])
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
      d3.axisBottom(xScale).ticks(8).tickFormat(d3.format("d"))
    );
    d3.select(yAxis).call(d3.axisLeft(yScale).ticks(6));
  }

  $effect(() => {
    if (xAxis && yAxis && series.length) updateAxis();
  });

  const unitText = $derived(
    metric === "pace" ? "min/km" : metric === "hr" ? "bpm" : "m"
  );

  let hoverX = $state<number | null>(null);
  let pinnedRun: number | null = $state(null);

  function handleSvgMouseMove(event: MouseEvent) {
    if (!svgEl) return;
    const [mx, my] = d3.pointer(event, svgEl);
    if (mx < usable.left || mx > usable.right || my < usable.top || my > usable.bottom) {
      hoverX = null;
      return;
    }
    hoverX = mx;
  }

  function clearHover() {
    hoverX = null;
  }

  const hoverRun = $derived(
    hoverX !== null ? Math.round(xScale.invert(hoverX)) : null
  );

  function handleSvgClick() {
    if (hoverRun !== null) {
      pinnedRun = pinnedRun === hoverRun ? null : hoverRun;
    }
  }

  function handleSvgKeydown(event: KeyboardEvent) {
    if ((event.key === "Enter" || event.key === " ") && hoverRun !== null) {
      event.preventDefault();
      handleSvgClick();
    }
  }

  function getClosestPoint(points: LinePoint[], run: number): LinePoint | null {
    const revealed = points.filter((p) => p.x <= revealedXMax);
    if (!revealed.length) return null;
    return revealed.reduce((best, current) =>
      Math.abs(current.x - run) < Math.abs(best.x - run) ? current : best
    );
  }

  const hoverData = $derived(
    hoverRun === null
      ? []
      : series
          .map((s) => ({
            label: s.label,
            point: getClosestPoint(s.values, hoverRun),
          }))
          .filter((d): d is { label: string; point: LinePoint } => d.point !== null)
  );


  // Pixel x of the reveal boundary
  const revealPixelX = $derived(
    Math.max(usable.left, Math.min(xScale(revealedXMax), usable.right))
  );

  // Unique clip ID per instance
  const clipId = `line-clip-${Math.random().toString(36).slice(2, 7)}`;
</script>

<div class="elevation-chart-wrap">
  <h3 class="chart-title">{title}</h3>

  {#if note && metric !== "hr"}
    <p class="chart-note">{note}</p>
  {/if}

  {#if series.length}
    <svg
      bind:this={svgEl}
      {width}
      {height}
      onmousemove={handleSvgMouseMove}
      onmouseleave={clearHover}
    >
      <defs>
        <!-- Clip rect grows rightward as scrollProgress increases -->
        <clipPath id={clipId}>
          <rect
            x={usable.left}
            y={usable.top - 10}
            width={Math.max(0, revealPixelX - usable.left)}
            height={usable.bottom - usable.top + 20}
          />
        </clipPath>
      </defs>

      <!-- Horizontal grid lines -->
      <g class="grid">
        {#each yScale.ticks(6) as tick}
          <line
            x1={usable.left}
            x2={usable.right}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="#999"
            stroke-opacity="0.14"
          />
        {/each}

        <text
          x={usable.right + 48}
          y={usable.top + 262}
          font-size="10.5"
          fill="#666"
        >
          Click the same run again to unpin
        </text>
      </g>

      <!-- Vertical grid lines -->
      <g class="grid">
        {#each xScale.ticks(8) as tick}
          <line
            x1={xScale(tick)}
            x2={xScale(tick)}
            y1={usable.top}
            y2={usable.bottom}
            stroke="#999"
            stroke-opacity="0.07"
          />
        {/each}
      </g>

      <!-- Series lines — clipped to revealed portion -->
      <g class="lines" clip-path={`url(#${clipId})`}>
        {#each series as s (s.label)}
          <path
            d={lineGen(s.values) ?? ""}
            fill="none"
            stroke={getSeriesColor(s.label)}
            stroke-width="2.2"
            opacity={hoverRun !== null ? 0.7 : 0.9}
          />
        {/each}
      </g>

      <!-- Subtle dots — clipped -->
      <g class="points" clip-path={`url(#${clipId})`}>
        {#each series as s (s.label)}
          {#each s.values as v (s.label + "-" + v.x)}
            <circle
              cx={xScale(v.x)}
              cy={yScale(v.value)}
              r="1.5"
              fill={getSeriesColor(s.label)}
              opacity="0.07"
            />
          {/each}
        {/each}
      </g>

      <!-- Reveal edge line (hidden when fully revealed) -->
      {#if scrollProgress < 99}
        <line
          x1={revealPixelX}
          x2={revealPixelX}
          y1={usable.top}
          y2={usable.bottom}
          stroke="#bbb"
          stroke-width="1.5"
          stroke-dasharray="4,3"
          opacity="0.7"
        />
      {/if}

      <!-- Hover crosshair + dots -->
      {#if hoverRun !== null && hoverData.length > 0}
        <line
          x1={xScale(hoverRun)}
          x2={xScale(hoverRun)}
          y1={usable.top}
          y2={usable.bottom}
          stroke="#888"
          stroke-width="1"
          stroke-dasharray="4,4"
          opacity="0.7"
        />
        {#each hoverData as d}
          <circle
            cx={xScale(d.point.x)}
            cy={yScale(d.point.value)}
            r="5"
            fill={getSeriesColor(d.label)}
            stroke="white"
            stroke-width="1.5"
          />
        {/each}
      {/if}

      <!-- Axes -->
      <g transform={`translate(0, ${usable.bottom})`} bind:this={xAxis} />
      <g transform={`translate(${usable.left}, 0)`} bind:this={yAxis} />

      <!-- Axis labels -->
      <text
        x={(usable.left + usable.right) / 2}
        y={height - 14}
        text-anchor="middle"
        font-size="12"
        fill="#444"
      >Run Number</text>

      <text
        x="22"
        y={(usable.top + usable.bottom) / 2}
        text-anchor="middle"
        font-size="12"
        fill="#444"
        transform={`rotate(-90, 22, ${(usable.top + usable.bottom) / 2})`}
      >{yLabel}</text>

      <!-- Legend -->
      <g transform={`translate(${usable.right + 28}, ${usable.top + 20})`}>
        <text x="0" y="0" font-size="12" font-weight="700" fill="#333">{legendTitle}</text>
        {#each labels as label, i (label)}
          <rect x="0" y={14 + i * 22} width="12" height="12" fill={getSeriesColor(label)} />
          <text x="18" y={24 + i * 22} font-size="12" fill="#333">{label}</text>
        {/each}
        {#if totalRuns !== null}
          <text
            x="0"
            y={14 + labels.length * 22 + 16}
            font-size="12"
            font-weight="500"
            fill="#666"
          >Total runs: {totalRuns}</text>
        {/if}
      </g>

      <!-- Hover tooltip -->
      {#if hoverRun !== null && hoverData.length > 0}
        {@const boxX = Math.min(xScale(hoverRun) + 14, width - 260)}
        {@const boxY = usable.top + 20}
        {@const boxHeight = 34 + hoverData.length * 22}
        <g class="tooltip" pointer-events="none">
          <rect x={boxX} y={boxY} width="250" height={boxHeight} rx="8" />
          <text x={boxX + 12} y={boxY + 20} font-size="12" font-weight="700" fill="#333">
            Run #{hoverRun}
          </text>
          {#each hoverData as d, i}
            <rect x={boxX + 12} y={boxY + 30 + i * 22} width="10" height="10" fill={getSeriesColor(d.label)} />
            <text x={boxX + 28} y={boxY + 39 + i * 22} font-size="12" fill="#333">
              {d.label}: {d.point.value.toFixed(2)} {unitText}
            </text>
          {/each}
        </g>
      {/if}
    </svg>
  {/if}
</div>

<style>
  .elevation-chart-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .chart-title {
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0 0 4px;
    color: #222;
  }

  .chart-note {
    margin: 0 0 8px;
    font-size: 0.9rem;
    color: #666;
    max-width: 820px;
    line-height: 1.5;
  }

  .lines path {
    vector-effect: non-scaling-stroke;
    transition: opacity 0.25s ease;
  }
  .tooltip rect {
    fill: white;
    stroke: #ddd;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.10));
  }
</style>