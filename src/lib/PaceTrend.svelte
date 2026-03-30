<script lang="ts">
  import * as d3 from "d3";
  import type { TRun } from "../types";

  export let runs: TRun[] = [];
  export let yLabel: string = "Avg pace (min/km)";

  const width = 600;
  const height = 220;
  const margin = { top: 20, right: 140, bottom: 60, left: 60 };
  const innerWidth  = width  - margin.left - margin.right;
  const innerHeight = height - margin.top  - margin.bottom;

  const COLORS: Record<string, string> = {
    "High (4x+/wk)": "#ff6f00",
    "Mid (2-3x/wk)":  "#80cbc4",
    "Low (0-1x/wk)":  "#ef9a9a",
  };

  const TIERS = ["High (4x+/wk)", "Mid (2-3x/wk)", "Low (0-1x/wk)"];

  function getScales(data: TRun[]) {
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => d.year_month) as [Date, Date])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([
        d3.min(data, d => d.p25) ?? 0,
        d3.max(data, d => d.p75) ?? 15,
      ])
      .range([innerHeight, 0]);

    return { xScale, yScale };
  }

  function getChart(data: TRun[]) {
    const { xScale, yScale } = getScales(data);

    const grouped = d3.group(data, d => d.tier);

    const lineGen = d3.line<TRun>()
      .x(d => xScale(d.year_month))
      .y(d => yScale(d.median_pace))
      .curve(d3.curveCatmullRom);

    const areaGen = d3.area<TRun>()
      .x(d  => xScale(d.year_month))
      .y0(d => yScale(d.p25))
      .y1(d => yScale(d.p75))
      .curve(d3.curveCatmullRom);

    const xTicks = xScale.ticks(8);
    const yTicks = yScale.ticks(6);

    return { xScale, yScale, grouped, lineGen, areaGen, xTicks, yTicks };
  }

  // tooltip state — these are still regular let variables, no $ needed
  let tooltip: {
    x: number;
    y: number;
    tier: string;
    value: number;
    date: Date;
    count: number;
  } | null = null;
  let pinnedTooltip: typeof tooltip = null;

  function handleMouseOver(event: MouseEvent, d: TRun, tier: string, xScale: d3.ScaleTime<number,number>, yScale: d3.ScaleLinear<number,number>) {
    if (pinnedTooltip) return;
    tooltip = {
      x: xScale(d.year_month) + margin.left,
      y: yScale(d.median_pace) + margin.top,
      tier,
      value: d.median_pace,
      date: d.year_month,
      count: d.run_count,
    };
  }

  function handleMouseOut() {
    if (pinnedTooltip) return;
    tooltip = null;
  }

  function handleClick(event: MouseEvent, d: TRun, tier: string, xScale: d3.ScaleTime<number,number>, yScale: d3.ScaleLinear<number,number>) {
    event.stopPropagation();
    const clicked = {
      x: xScale(d.year_month) + margin.left,
      y: yScale(d.median_pace) + margin.top,
      tier,
      value: d.median_pace,
      date: d.year_month,
      count: d.run_count,
    };
    if (
      pinnedTooltip &&
      pinnedTooltip.date.getTime() === d.year_month.getTime() &&
      pinnedTooltip.tier === tier
    ) {
      pinnedTooltip = null;
      tooltip = null;
    } else {
      pinnedTooltip = clicked;
      tooltip = clicked;
    }
  }

  function clearPinned() {
    pinnedTooltip = null;
    tooltip = null;
  }
</script>

<!-- compute everything once at the top of the template -->
{#if runs.length > 0}
  {@const { xScale, yScale, grouped, lineGen, areaGen, xTicks, yTicks } = getChart(runs)}

  <svg {width} {height} viewBox="0 0 {width} {height}" style="width:100%;height:auto;">
    <g transform="translate({margin.left},{margin.top})">

      <!-- click background to clear pinned tooltip -->
      <rect
        x={-margin.left} y={-margin.top}
        width={width} height={height}
        fill="transparent"
        on:click={clearPinned}
      />

      <!-- x axis gridlines + labels -->
      {#each xTicks as tick}
        <line
          x1={xScale(tick)} y1={0}
          x2={xScale(tick)} y2={innerHeight}
          stroke="#ccc" stroke-width="0.5" stroke-dasharray="4,4"
        />
        <text
          x={xScale(tick)} y={innerHeight + 20}
          text-anchor="middle" font-size="6" fill="#888"
        >
          {d3.timeFormat("%b %Y")(tick)}
        </text>
      {/each}

      <!-- x axis label -->
      <text
        x={innerWidth / 2}
        y={innerHeight + 45}
        text-anchor="middle"
        font-size="8"
        fill="#888"
      >
        Date (Month / Year)
      </text>

      <!-- y axis gridlines + labels -->
      {#each yTicks as tick}
        <line
          x1={0}          y1={yScale(tick)}
          x2={innerWidth} y2={yScale(tick)}
          stroke="#ccc" stroke-width="0.5" stroke-dasharray="4,4"
        />
        <text
          x={-8} y={yScale(tick)}
          text-anchor="end" dominant-baseline="central"
          font-size="8" fill="#888"
        >
          {tick.toFixed(1)}
        </text>
      {/each}

      <!-- y axis label -->
      <text
        transform="rotate(-90)"
        x={-innerHeight / 2} y={-44}
        text-anchor="middle" font-size="8" fill="#888"
      >
        {yLabel}
      </text>

      <!-- tier lines, bands, and points -->
      {#each TIERS as tier}
        {#if grouped.has(tier)}
          {@const tierData = (grouped.get(tier) ?? []).sort((a, b) => +a.year_month - +b.year_month)}
          {@const color = COLORS[tier]}

          <!-- confidence band -->
          <path
            class="band"
            d={areaGen(tierData) ?? ""}
            fill={color}
            opacity="0.15"
          />

          <!-- median line -->
          <path
            class="line"
            d={lineGen(tierData) ?? ""}
            fill="none"
            stroke={color}
            stroke-width="2.5"
          />

          <!-- individual clickable points -->
          {#each tierData as d}
            {@const isPinned =
              pinnedTooltip?.date.getTime() === d.year_month.getTime() &&
              pinnedTooltip?.tier === tier}
            <circle
              cx={xScale(d.year_month)}
              cy={yScale(d.median_pace)}
              r={isPinned ? 6 : 3}
              fill={color}
              opacity={isPinned ? 1 : 0.7}
              stroke={isPinned ? "white" : "none"}
              stroke-width={isPinned ? 1.5 : 0}
              style="cursor:pointer;"
              on:mouseover={(e) => handleMouseOver(e, d, tier, xScale, yScale)}
              on:mouseout={handleMouseOut}
              on:click={(e) => handleClick(e, d, tier, xScale, yScale)}
              on:focus={(e) => handleMouseOver(e, d, tier, xScale, yScale)}
              on:blur={handleMouseOut}
              on:keydown={(e) => e.key === "Enter" && handleClick(e, d, tier, xScale, yScale)}
              role="button"
              tabindex="0"
              aria-label="{tier} {d3.timeFormat('%b %Y')(d.year_month)}: {d.median_pace.toFixed(2)}"
            />
          {/each}

          <!-- legend dot + label -->
          <circle
            class="legend-dot"
            cx={innerWidth + 10}
            cy={yScale((tierData.at(-1)?.median_pace) ?? 0)}
            r="3"
            fill={color}
          />
          <text
            class="legend-label"
            x={innerWidth + 18}
            y={yScale((tierData.at(-1)?.median_pace) ?? 0)}
            dominant-baseline="central"
            font-size="6"
            fill={color}
          >
            {tier}
          </text>
        {/if}
      {/each}

      <!-- tooltip -->
      {#if tooltip}
        {@const tx = Math.min(tooltip.x, width - margin.left - 180)}
        {@const ty = Math.max(tooltip.y - margin.top - 10, 0)}
        <g transform="translate({tx},{ty})" on:click|stopPropagation={() => {}}>
          <rect
            x={0} y={-18}
            width="175" height="72"
            rx="6"
            fill="white"
            stroke={pinnedTooltip ? "#ff6f00" : "#ccc"}
            stroke-width={pinnedTooltip ? 1.5 : 0.5}
            opacity="0.97"
          />
          {#if pinnedTooltip}
            <circle cx="163" cy="-8" r="4" fill="#ff6f00" />
          {/if}
          <text x="8" y="-4" font-size="8" font-weight="500" fill="#333">
            {tooltip.tier}
          </text>
          <text x="8" y="13" font-size="6" fill="#666">
            {d3.timeFormat("%b %Y")(tooltip.date)}
          </text>
          <text x="8" y="28" font-size="6" fill="#666">
            Value: {tooltip.value.toFixed(2)}
          </text>
          <text x="8" y="43" font-size="6" fill="#666">
            Runs logged: {tooltip.count}
          </text>
        </g>
      {/if}

    </g>
  </svg>

{:else}
  <p style="color:#888;font-size:13px;">Loading chart data...</p>
{/if}

<style>
  path.band {
    transition: d 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
  }
  path.line {
    transition: d 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease;
  }
  circle.legend-dot {
    transition: cy 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }
  text.legend-label {
    transition: y 0.6s ease;
  }
  circle:not(.legend-dot):hover {
    opacity: 1;
  }
</style>