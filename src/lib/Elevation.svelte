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
    scrollProgress?: number;
  };

  const props = $props<Props>();

  const series = $derived(props.series);
  const width = $derived(props.width ?? 760);
  const height = $derived(props.height ?? 430);
  const title = $derived(props.title ?? "Run Trends");
  const yLabel = $derived(props.yLabel ?? "Value");
  const note = $derived(props.note ?? "");
  const metric = $derived(props.metric ?? "hr");
  const legendTitle = $derived(props.legendTitle ?? "Legend");
  const totalRuns = $derived(props.totalRuns ?? null);
  const scrollProgress = $derived(props.scrollProgress ?? 100);

  const margin = { top: 45, right: 30, bottom: 62, left: 78 };

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

  const revealedXMax = $derived(
    xMin + (xMax - xMin) * (scrollProgress / 100)
  );

  function getSeriesColor(label: string): string {
    if (label.includes("Low")) return "#4C72B0";
    if (label.includes("Medium")) return "#55A868";
    if (label.includes("High")) return "#C44E52";
    return "#E83E8C";
  }

  const xScale = $derived(
    d3
      .scaleLinear()
      .domain(allX.length ? [xMin, xMax] : [0, 1])
      .nice()
      .range([usable.left, usable.right])
  );

  const yScale = $derived(
    d3
      .scaleLinear()
      .domain(allValues.length ? [d3.min(allValues)!, d3.max(allValues)!] : [0, 1])
      .nice()
      .range([usable.bottom, usable.top])
  );

  const lineGen = $derived(
    d3
      .line<LinePoint>()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX)
  );

  let xAxis: SVGGElement = $state();
  let yAxis: SVGGElement = $state();
  let svgEl: SVGSVGElement = $state();

  $effect(() => {
    if (xAxis && yAxis && series.length) {
      d3.select(xAxis).call(
        d3.axisBottom(xScale).ticks(8).tickFormat(d3.format("d"))
      );
      d3.select(yAxis).call(d3.axisLeft(yScale).ticks(6));
    }
  });

  const unitText = $derived(
    metric === "pace" ? "min/km" : metric === "hr" ? "bpm" : "m"
  );

  let hoverX = $state<number | null>(null);
  let pinnedRun = $state<number | null>(null);

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
  }

  function clearHover() {
    hoverX = null;
  }

  const hoverRun = $derived(
    hoverX !== null ? Math.round(xScale.invert(hoverX)) : null
  );

  const activeRun = $derived(pinnedRun ?? hoverRun);

  function handleSvgClick() {
    if (hoverRun !== null) {
      pinnedRun = pinnedRun === hoverRun ? null : hoverRun;
    }
  }

  function getClosestPoint(points: LinePoint[], run: number): LinePoint | null {
    const revealed = points.filter((p) => p.x <= revealedXMax);
    if (!revealed.length) return null;

    return revealed.reduce((best, current) =>
      Math.abs(current.x - run) < Math.abs(best.x - run) ? current : best
    );
  }

  const activeData = $derived(
    activeRun === null
      ? []
      : series
          .map((s) => ({
            label: s.label,
            point: getClosestPoint(s.values, activeRun),
          }))
          .filter((d): d is { label: string; point: LinePoint } => d.point !== null)
  );

  const revealPixelX = $derived(
    Math.max(usable.left, Math.min(xScale(revealedXMax), usable.right))
  );

  const clipId = `line-clip-${Math.random().toString(36).slice(2, 7)}`;
</script>

<div class="elevation-chart-wrap">
  {#if title}
    <h3 class="chart-title">{title}</h3>
  {/if}

  {#if note && metric !== "hr"}
    <p class="chart-note">{note}</p>
  {/if}

  {#if series.length}
    <div class="hr-layout">
      <svg
        bind:this={svgEl}
        {width}
        {height}
        onmousemove={handleSvgMouseMove}
        onmouseleave={clearHover}
        onclick={handleSvgClick}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={usable.left}
              y={usable.top - 10}
              width={Math.max(0, revealPixelX - usable.left)}
              height={usable.bottom - usable.top + 20}
            />
          </clipPath>
        </defs>

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

        <g class="grid">
          {#each xScale.ticks(8) as tick}
            <line
              x1={xScale(tick)}
              x2={xScale(tick)}
              y1={usable.top}
              y2={usable.bottom}
              opacity="0.45"
            />
          {/each}
        </g>

        <g class="lines" clip-path={`url(#${clipId})`}>
          {#each series as s (s.label)}
            <path
              d={lineGen(s.values) ?? ""}
              fill="none"
              stroke={getSeriesColor(s.label)}
              stroke-width="2.2"
              opacity={activeRun !== null ? 0.72 : 0.9}
            />
          {/each}
        </g>

        <g class="points" clip-path={`url(#${clipId})`}>
          {#each series as s (s.label)}
            {#each s.values as v (s.label + "-" + v.x)}
              <circle
                cx={xScale(v.x)}
                cy={yScale(v.value)}
                r="1.5"
                fill={getSeriesColor(s.label)}
                opacity="0.08"
              />
            {/each}
          {/each}
        </g>

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

        {#if activeRun !== null && activeData.length > 0}
          <line
            x1={xScale(activeRun)}
            x2={xScale(activeRun)}
            y1={usable.top}
            y2={usable.bottom}
            stroke={pinnedRun !== null ? "#333" : "#888"}
            stroke-width={pinnedRun !== null ? "1.5" : "1"}
            stroke-dasharray="4,4"
            opacity="0.75"
          />

          {#each activeData as d}
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

        <g transform={`translate(0, ${usable.bottom})`} bind:this={xAxis} />
        <g transform={`translate(${usable.left}, 0)`} bind:this={yAxis} />

        <text
          x={(usable.left + usable.right) / 2}
          y={height - 12}
          text-anchor="middle"
          font-size="12"
          fill="#444"
        >
          Run Number
        </text>

        <text
          x="18"
          y={(usable.top + usable.bottom) / 2}
          text-anchor="middle"
          font-size="12"
          fill="#444"
          transform={`rotate(-90, 18, ${(usable.top + usable.bottom) / 2})`}
        >
          {yLabel}
        </text>
      </svg>

      <aside class="runner-panel" class:expanded={activeRun !== null}>
        {#if activeRun !== null && activeData.length > 0}
          <h3>Run #{activeRun}</h3>

          <div class="detail-card no-border">
            {#each activeData as d}
              <p>
                <span class="value-box" style={`background:${getSeriesColor(d.label)}`}></span>
                <strong>{d.label}:</strong> {d.point.value.toFixed(2)} {unitText}
              </p>
            {/each}

            {#if pinnedRun !== null}
              <p class="panel-hint">Pinned. Click the same run again to unpin.</p>
            {:else}
              <p class="panel-hint">Previewing. Click to pin this run.</p>
            {/if}
          </div>
        {:else}
          <h3>{legendTitle}</h3>

          <div class="legend-block">
            {#each labels as label}
              <div class="legend-row">
                <span class="legend-box" style={`background:${getSeriesColor(label)}`}></span>
                <span>{label}</span>
              </div>
            {/each}

            {#if totalRuns !== null}
              <p class="total-runs">Total runs: {totalRuns}</p>
            {/if}
          </div>

          <div class="detail-card empty">
            Hover over the chart to preview a run. Click to pin it.
          </div>
        {/if}
      </aside>
    </div>
  {:else}
    <p>No data available.</p>
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

  .hr-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 210px;
    gap: 12px;
    align-items: start;
  }

  .grid line {
    stroke: #999;
    stroke-opacity: 0.14;
  }

  .lines path {
    vector-effect: non-scaling-stroke;
    transition: opacity 0.25s ease;
  }

  circle {
    transition:
      r 0.2s ease,
      opacity 0.2s ease,
      cx 0.25s ease,
      cy 0.25s ease;
  }

  svg {
    cursor: crosshair;
    min-width: 0;
  }

  .runner-panel {
    margin-top: 48px;
    padding: 12px 14px;
    border: 1px solid #d6d6d6;
    border-radius: 14px;
    background: white;
    height: fit-content;
    font-size: 0.84rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }

  .runner-panel.expanded {
    min-height: 150px;
  }

  .runner-panel h3 {
    margin: 0 0 12px;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .legend-block {
    margin-bottom: 12px;
  }

  .legend-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0;
  }

  .legend-box,
  .value-box {
    display: inline-block;
    width: 11px;
    height: 11px;
    flex-shrink: 0;
  }

  .value-box {
    margin-right: 7px;
    vertical-align: -1px;
  }

  .total-runs {
    margin: 10px 0 0;
    color: #666;
  }

  .detail-card {
    padding-top: 12px;
    border-top: 1px solid #eee;
  }

  .detail-card.no-border {
    padding-top: 0;
    border-top: none;
  }

  .detail-card p {
    margin: 7px 0;
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
  }
</style>