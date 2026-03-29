<script lang="ts">
    import * as d3 from "d3";
  
    type LinePoint = {
      date: Date;
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
    const title = $derived(props.title ?? "Monthly Trends");
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
    const allDates = $derived(allPoints.map((d) => d.date));
    const allValues = $derived(allPoints.map((d) => d.value));
    const labels = $derived(series.map((s) => s.label));
  
    const xScale = $derived(
      d3.scaleTime()
        .domain(
          allDates.length
            ? [d3.min(allDates)!, d3.max(allDates)!]
            : [new Date(), new Date()]
        )
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
  
    const color = $derived(
      d3.scaleOrdinal<string, string>()
        .domain(labels)
        .range(["#4C72B0", "#DD8452"])
    );
  
    const lineGen = $derived(
      d3.line<LinePoint>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.value))
        .curve(d3.curveMonotoneX)
    );
  
    let xAxis: SVGGElement = $state();
    let yAxis: SVGGElement = $state();
    let svgEl: SVGSVGElement = $state();
  
    function updateAxis() {
      d3.select(xAxis).call(
        d3.axisBottom(xScale)
          .ticks(d3.timeYear.every(1))
          .tickFormat(d3.timeFormat("%Y") as any)
      );
  
      d3.select(yAxis).call(d3.axisLeft(yScale));
    }
  
    $effect(() => {
      if (xAxis && yAxis && series.length) updateAxis();
    });
  
    let focusLabel: string | null = $state(null);
    let hoveredDate: Date | null = $state(null);
    let tooltipX = $state(0);
    let tooltipY = $state(0);
  
    type TooltipRow = {
      label: string;
      value: number;
      color: string;
    };
  
    const tooltipRows = $derived.by(() => {
      if (!hoveredDate) return [];
  
      const rows: TooltipRow[] = [];
  
      for (const s of series) {
        const nearest = d3.least(
          s.values,
          (d) => Math.abs(d.date.getTime() - hoveredDate.getTime())
        );
  
        if (nearest) {
          rows.push({
            label: s.label,
            value: nearest.value,
            color: color(s.label)
          });
        }
      }
  
      return rows;
    });
  
    function onMove(event: MouseEvent) {
      if (!svgEl || !series.length) return;
  
      const [mx, my] = d3.pointer(event, svgEl);
  
      if (mx < usable.left || mx > usable.right || my < usable.top || my > usable.bottom) {
        hoveredDate = null;
        return;
      }
  
      hoveredDate = xScale.invert(mx);
      tooltipX = mx;
      tooltipY = my;
    }
  
    function onLeave() {
      hoveredDate = null;
    }
  
    const unitText = $derived(metric === "pace" ? "min/km" : "bpm");
  </script>
  
  <h3>{title}</h3>
  
  {#if series.length}
    <svg bind:this={svgEl} {width} {height} onmousemove={onMove} onmouseleave={onLeave}>
  
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
        {#each xScale.ticks(d3.timeYear.every(1)) as tick}
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
            stroke={color(s.label)}
            stroke-width={focusLabel ? (s.label === focusLabel ? 3.2 : 1.6) : 2.4}
            opacity={focusLabel ? (s.label === focusLabel ? 1 : 0.28) : 0.95}
          />
        {/each}
      </g>
  
      <g class="points">
        {#each series as s (s.label)}
          {#each s.values as v (s.label + v.date.toISOString())}
            <circle
              cx={xScale(v.date)}
              cy={yScale(v.value)}
              r={focusLabel ? (s.label === focusLabel ? 4 : 2.3) : 3}
              fill={color(s.label)}
              opacity={focusLabel ? (s.label === focusLabel ? 1 : 0.28) : 0.9}
              onmouseover={() => (focusLabel = s.label)}
              onmouseout={() => (focusLabel = null)}
            />
          {/each}
        {/each}
      </g>
  
      <g transform={`translate(0, ${usable.bottom})`} bind:this={xAxis} />
      <g transform={`translate(${usable.left}, 0)`} bind:this={yAxis} />
  
      <text x={(usable.left + usable.right) / 2} y={height - 15} text-anchor="middle" font-size="12">
        Year
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
          <rect x="0" y={14 + i * 22} width="12" height="12" fill={color(label)} />
          <text x="18" y={24 + i * 22} font-size="12">{label}</text>
        {/each}
      </g>
  
      {#if hoveredDate && tooltipRows.length}
        {@const boxX = Math.min(tooltipX + 12, width - 290)}
        {@const boxY = Math.max(tooltipY - 70, 12)}
        <g class="tooltip">
          <rect
            x={boxX}
            y={boxY}
            width="275"
            height={42 + tooltipRows.length * 20}
            rx="8"
            fill="white"
            stroke="#999"
          />
  
          <text x={boxX + 12} y={boxY + 20} font-size="12" font-weight="600">
            {d3.timeFormat("%b %Y")(hoveredDate)}
          </text>
  
          {#each tooltipRows as row, i (row.label)}
            <circle
              cx={boxX + 10}
              cy={boxY + 34 + i * 20}
              r="4"
              fill={row.color}
            />
            <text x={boxX + 20} y={boxY + 38 + i * 20} font-size="12">
              {row.label}: {row.value.toFixed(2)} {unitText}
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
