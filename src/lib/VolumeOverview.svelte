<script lang="ts">
  // Receives scroll progress (0–100) to drive fill animations
  export let progress: number = 0;

  const COLOR = {
    low:  { line: "#4e90d9", band: "rgba(78,144,217,0.13)", label: "Low volume"  },
    mid:  { line: "#2ec495", band: "rgba(46,196,149,0.13)", label: "Mid volume"  },
    high: { line: "#f05a5a", band: "rgba(240,90,90,0.13)",  label: "High volume" },
  };

  const GROUP_STATS = [
    { group: "high" as const, runsPerWeek: 4.9, paceMin: 4.81, paceMax: 5.89 },
    { group: "mid"  as const, runsPerWeek: 2.5, paceMin: 5.38, paceMax: 6.32 },
    { group: "low"  as const, runsPerWeek: 1.5, paceMin: 5.46, paceMax: 6.98 },
  ];

  const MAX_RUNS_PER_WEEK = 5.0;

  // Bars animate in as progress goes from 14 → 28 (matches when overview becomes visible)
  // Each bar fills sequentially: high first, then mid, then low
  $: barFillPcts = GROUP_STATS.map((s, i) => {
    const start  = i * 1.5;   // was 14 + i*3
    const end    = start + 3;    // was +8 (cut in half)
    const t      = Math.max(0, Math.min(1, (progress - start) / (end - start)));
    const target = (s.runsPerWeek / MAX_RUNS_PER_WEEK) * 100;
    return t * target;
  });

  // Pace ranges animate in slightly after bars
  $: paceFillTs = GROUP_STATS.map((_, i) => {
    const start = 2 + i * 1.5;
    const end   = start + 3;
    return Math.max(0, Math.min(1, (progress - start) / (end - start)));
  });

  // Bell curve fills in after bars (progress 22–34)
  $: bellOpacity =
    progress < 2 ? 0 :
    progress < 8 ? (progress - 2) / 6 :
    1;
  $: dividerOpacity =
    progress < 4 ? 0 :
    progress < 10 ? (progress - 4) / 6 :
    1;
  $: chipOpacity =
    progress < 4 ? 0 :
    progress < 10 ? (progress - 4) / 6 :
    1;
</script>

<div class="overview-grid">

  <!-- ── Bar chart card ─────────────────────────────────────────────── -->
  <div class="card">
    <h3 class="card-title">Average runs per week</h3>

    <div class="bar-chart">
      {#each GROUP_STATS as s, i}
        {@const pct = barFillPcts[i]}
        <div class="bar-row">
          <span class="bar-label" style="color:{COLOR[s.group].line}">{COLOR[s.group].label}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:{pct}%;background:{COLOR[s.group].line};"></div>
          </div>
          <span class="bar-end-label" style="color:{COLOR[s.group].line};opacity:{pct > 10 ? 1 : 0}">
            {s.runsPerWeek}/wk
          </span>
        </div>
      {/each}
    </div>

    <div class="pace-ranges">
      <div class="pace-heading">Pace range (min/km) — lower is faster</div>
      {#each GROUP_STATS as s, i}
        {@const lo  = ((s.paceMin - 4.5) / (7.5 - 4.5)) * 100}
        {@const hi  = ((s.paceMax - 4.5) / (7.5 - 4.5)) * 100}
        {@const t   = paceFillTs[i]}
        <div class="pace-row">
          <span class="pace-label" style="color:{COLOR[s.group].line}">{COLOR[s.group].label}</span>
          <div class="pace-track">
            <div class="pace-fill"
              style="left:{lo}%;width:{(hi - lo) * t}%;background:{COLOR[s.group].line};">
            </div>
          </div>
          <span class="pace-val" style="color:{COLOR[s.group].line};opacity:{t > 0.7 ? 1 : 0}">
            {s.paceMin}–{s.paceMax}
          </span>
        </div>
      {/each}
      <div class="pace-axis">
        <span>4.5</span><span>5.5</span><span>6.5</span><span>7.5</span>
      </div>
    </div>
  </div>

  <!-- ── Bell curve card ────────────────────────────────────────────── -->
  <div class="card">
    <h3 class="card-title">Runner distribution by volume</h3>

    <svg
      viewBox="0 0 320 170"
      width="100%"
      role="img"
      aria-label="Bell curve showing three volume groups"
    >
      <!-- filled regions animate in -->
      <path d="M20,130 C50,128 70,120 90,100 C105,85 115,62 107,130 Z"
        fill="{COLOR.low.band}" stroke="none" opacity="{bellOpacity}" />
      <path d="M107,130 C115,62 130,30 160,12 C190,30 205,62 213,130 Z"
        fill="{COLOR.mid.band}" stroke="none" opacity="{bellOpacity}" />
      <path d="M213,130 C205,62 215,85 230,100 C250,120 270,128 300,130 Z"
        fill="{COLOR.high.band}" stroke="none" opacity="{bellOpacity}" />

      <!-- curve outline — draws in early -->
      <path
        d="M20,130 C50,128 70,120 90,100 C110,80 130,30 160,12 C190,30 210,80 230,100 C250,120 270,128 300,130"
        fill="none" stroke="#bbb" stroke-width="1.5"
        opacity="{Math.max(0, Math.min(1, (progress - 4) / 6))}"
      />
      <line x1="20" y1="130" x2="300" y2="130" stroke="#bbb" stroke-width="0.5"
        opacity="{Math.max(0, Math.min(1, (progress - 4) / 6))}" />

      <!-- dividers -->
      <line x1="107" y1="24" x2="107" y2="130"
        stroke="{COLOR.low.line}" stroke-width="1" stroke-dasharray="4,3"
        opacity="{dividerOpacity * 0.6}" />
      <line x1="213" y1="24" x2="213" y2="130"
        stroke="{COLOR.high.line}" stroke-width="1" stroke-dasharray="4,3"
        opacity="{dividerOpacity * 0.6}" />

      <!-- labels fade in last -->
      <g opacity="{dividerOpacity}">
        <text x="58"  y="151" text-anchor="middle" font-size="10" fill="{COLOR.low.line}"  font-family="inherit">Low (0–33rd)</text>
        <text x="160" y="151" text-anchor="middle" font-size="10" fill="{COLOR.mid.line}"  font-family="inherit">Mid (33–67th)</text>
        <text x="258" y="151" text-anchor="middle" font-size="10" fill="{COLOR.high.line}" font-family="inherit">High (67–100th)</text>
        <text x="58"  y="116" text-anchor="middle" font-size="9"  fill="{COLOR.low.line}"  opacity="0.85" font-family="inherit">≤1.8 runs/wk</text>
        <text x="160" y="97"  text-anchor="middle" font-size="9"  fill="{COLOR.mid.line}"  opacity="0.85" font-family="inherit">1.8–3.5/wk</text>
        <text x="258" y="116" text-anchor="middle" font-size="9"  fill="{COLOR.high.line}" opacity="0.85" font-family="inherit">≥3.5 runs/wk</text>
      </g>
    </svg>

    <!-- percentile chips -->
    <div class="percentile-row" style="opacity:{chipOpacity}">
      <div class="percentile-chip" style="border-color:{COLOR.low.line};color:{COLOR.low.line}">
        <span class="chip-label">10th percentile</span>
        <span class="chip-val">&lt;1.2/wk</span>
      </div>
      <div class="percentile-chip" style="border-color:{COLOR.mid.line};color:{COLOR.mid.line}">
        <span class="chip-label">50th percentile</span>
        <span class="chip-val">~2.5/wk</span>
      </div>
      <div class="percentile-chip" style="border-color:{COLOR.high.line};color:{COLOR.high.line}">
        <span class="chip-label">90th percentile</span>
        <span class="chip-val">&gt;4.5/wk</span>
      </div>
    </div>
  </div>

</div>

<style>
  .overview-grid {
    display: flex;
    flex-direction: row;
    gap: 16px;
    width: 100%;
  }

  .card {
    flex: 1;
    background: var(--color-background-primary, #fff);
    border: 0.5px solid var(--color-border-tertiary, #e5e5e5);
    border-radius: 12px;
    padding: 1.1rem;
    box-sizing: border-box;
  }

  .card-title {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-secondary, #666);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin: 0 0 0.85rem;
  }

  /* ── bars ── */
  .bar-chart   { margin-bottom: 1rem; }
  .bar-row     { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
  .bar-label   { font-size: 11px; font-weight: 500; width: 72px; flex-shrink: 0; text-align: right; }
  .bar-track   { flex: 1; height: 22px; background: var(--color-background-secondary, #f5f5f5); border-radius: 4px; overflow: hidden; }
  .bar-fill    { height: 100%; border-radius: 4px; display: flex; align-items: center; min-width: 0; }
  .bar-end-label { font-size: 11px; font-weight: 500; width: 42px; flex-shrink: 0; transition: opacity 0.3s; }

  /* ── pace ranges ── */
  .pace-ranges  { border-top: 0.5px solid var(--color-border-tertiary, #e5e5e5); padding-top: 10px; }
  .pace-heading { font-size: 10px; color: var(--color-text-secondary, #888); margin-bottom: 7px; }
  .pace-row     { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
  .pace-label   { font-size: 11px; font-weight: 500; width: 72px; flex-shrink: 0; text-align: right; }
  .pace-track   { flex: 1; height: 9px; background: var(--color-background-secondary, #f5f5f5); border-radius: 4px; position: relative; }
  .pace-fill    { position: absolute; height: 100%; border-radius: 4px; opacity: 0.65; }
  .pace-val     { font-size: 10px; font-weight: 500; width: 58px; flex-shrink: 0; text-align: right; transition: opacity 0.3s; }
  .pace-axis    { display: flex; justify-content: space-between; padding-left: 79px; font-size: 9px; color: var(--color-text-secondary, #aaa); margin-top: 2px; }

  /* ── percentile chips ── */
  .percentile-row  { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; transition: opacity 0.4s; }
  .percentile-chip { flex: 1; min-width: 68px; border: 0.5px solid; border-radius: 8px; padding: 5px 7px; background: var(--color-background-secondary, #f9f9f9); display: flex; flex-direction: column; gap: 1px; }
  .chip-label      { font-size: 9px; opacity: 0.7; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
  .chip-val        { font-size: 13px; font-weight: 500; }
</style>