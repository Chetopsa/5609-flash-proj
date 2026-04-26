<script lang="ts">
  const COLOR = {
    low:  { line: "#4e90d9", band: "rgba(78,144,217,0.13)", label: "Low volume"  },
    mid:  { line: "#2ec495", band: "rgba(46,196,149,0.13)", label: "Mid volume"  },
    high: { line: "#f05a5a", band: "rgba(240,90,90,0.13)",  label: "High volume" },
  };

  let runsInput = "";
  let paceInput = "";
  let calcError = "";
  let result: null | {
    group: "low" | "mid" | "high";
    label: string;
    desc: string;
    tips: string[];
    nextGroupMsg: string;
    volumeScore: number;
    paceScore: number;
    composite: number;
  } = null;

  // Dual-factor classifier: frequency (65%) + pace (35%)
  // Volume score: 0 runs/wk → 0,  5+ runs/wk → 100
  // Pace score:   7.5 min/km → 0,  4.5 min/km → 100  (faster = higher)
  // Composite 0–100 → low <35, mid 35–65, high >65
  function classify(runs: number, pace: number): "low" | "mid" | "high" {
    const volumeScore = Math.min(100, Math.max(0, (runs / 5) * 100));
    const paceScore   = Math.min(100, Math.max(0, ((7.5 - pace) / (7.5 - 4.5)) * 100));
    const score       = volumeScore * 0.65 + paceScore * 0.35;
    if (score >= 65) return "high";
    if (score >= 35) return "mid";
    return "low";
  }

  function calculate() {
    calcError = "";
    result    = null;

    const runs = parseFloat(runsInput);
    const pace = parseFloat(paceInput);
    if (isNaN(runs) || runs <= 0) { calcError = "Enter a valid number of runs per week."; return; }
    if (isNaN(pace) || pace <= 0) { calcError = "Enter a valid pace (min/km).";           return; }

    const group = classify(runs, pace);

    const volumeScore = Math.round(Math.min(100, Math.max(0, (runs / 5) * 100)));
    const paceScore   = Math.round(Math.min(100, Math.max(0, ((7.5 - pace) / (7.5 - 4.5)) * 100)));
    const composite   = Math.round(volumeScore * 0.65 + paceScore * 0.35);

    const descs: Record<string, string> = {
      low:  `Your profile — ${runs} runs/week at ${pace.toFixed(1)} min/km — places you in the bottom third. You scored ${volumeScore}/100 on frequency and ${paceScore}/100 on speed (composite: ${composite}/100). Runners here still have the most room to grow.`,
      mid:  `Your profile — ${runs} runs/week at ${pace.toFixed(1)} min/km — lands you in the middle tier. You scored ${volumeScore}/100 on frequency and ${paceScore}/100 on speed (composite: ${composite}/100). Mid-volume runners show consistent, sustainable improvement.`,
      high: `Your profile — ${runs} runs/week at ${pace.toFixed(1)} min/km — puts you in the top third. You scored ${volumeScore}/100 on frequency and ${paceScore}/100 on speed (composite: ${composite}/100). High-volume runners build deep aerobic fitness fast.`,
    };

    const tipsMap: Record<string, string[]> = {
      low: [
        "Add just one more easy run per week (even 20–30 min) to cross into the mid tier.",
        "Focus on consistency first — same days each week builds habit faster than intensity.",
        "At this frequency, prioritise recovery between runs over pushing pace.",
      ],
      mid: [
        "To reach the high tier, aim for 4+ runs/week with one being a longer effort.",
        "Add a tempo run once a week — mid runners see the biggest pace gains from structured workouts.",
        "Vary your paces: one easy, one moderate, one slightly faster. This builds aerobic range.",
      ],
      high: [
        "Your volume is excellent. Further gains come from quality — intervals, tempo, long runs.",
        "Watch for accumulated fatigue. High volume needs a recovery week every 3–4 weeks.",
        "If pace has plateaued, add one dedicated speed session per week to break through.",
      ],
    };

    const nextMsgs: Record<string, string> = {
      low:  `To enter the mid tier: aim for ~2 runs/week consistently. Your pace of ${pace.toFixed(1)} min/km is normal for this volume — mid runners average 5.36–6.32.`,
      mid:  `To enter the high tier: build toward ~4 runs/week. High-volume runners average 4.81–5.96 min/km — a significant step from your current ${pace.toFixed(1)}.`,
      high: `You're in the top tier. Focus on race-specific training to push below 4.81 min/km. Elite amateur runners typically run 5–7× per week with structured periodisation.`,
    };

    result = {
      group,
      label: { low: "Low volume runner", mid: "Mid volume runner", high: "High volume runner" }[group],
      desc:         descs[group],
      tips:         tipsMap[group],
      nextGroupMsg: nextMsgs[group],
      volumeScore,
      paceScore,
      composite,
    };
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === "Enter") calculate();
  }
</script>

<div class="calc-card">
  <div class="calc-header">
    <h3 class="calc-title">Where do you fit?</h3>
    <p class="calc-subtitle">
      Enter your weekly runs and current pace to find your tier and what it takes to level up.
    </p>
  </div>

  <div class="input-row">
    <div class="input-group">
      <label for="calc-runs">Runs per week</label>
      <input
        id="calc-runs"
        type="number"
        min="0" max="14" step="0.5"
        placeholder="e.g. 3"
        bind:value={runsInput}
        on:keydown={handleKey}
      />
    </div>
    <div class="input-group">
      <label for="calc-pace">Current pace (min/km)</label>
      <input
        id="calc-pace"
        type="number"
        min="3" max="12" step="0.1"
        placeholder="e.g. 5.8"
        bind:value={paceInput}
        on:keydown={handleKey}
      />
    </div>
  </div>

  {#if calcError}
    <p class="calc-error">{calcError}</p>
  {/if}

  <button class="calc-btn" on:click={calculate}>Find my group →</button>

  {#if result}
    {@const c  = COLOR[result.group].line}
    {@const bg = COLOR[result.group].band}
    <div class="result" style="border-color:{c};background:{bg}">
      <div class="result-group" style="color:{c}">{result.label}</div>

      <!-- Score breakdown -->
      <div class="score-grid">
        <div class="score-row">
          <span class="score-label">Frequency</span>
          <div class="score-track">
            <div class="score-fill" style="width:{result.volumeScore}%;background:{c};"></div>
          </div>
          <span class="score-val" style="color:{c}">{result.volumeScore}/100</span>
        </div>
        <div class="score-row">
          <span class="score-label">Speed</span>
          <div class="score-track">
            <div class="score-fill" style="width:{result.paceScore}%;background:{c};"></div>
          </div>
          <span class="score-val" style="color:{c}">{result.paceScore}/100</span>
        </div>
        <div class="score-row composite-row">
          <span class="score-label">Overall</span>
          <div class="score-track">
            <div class="score-fill" style="width:{result.composite}%;background:{c};opacity:0.55;"></div>
          </div>
          <span class="score-val" style="color:{c}">{result.composite}/100</span>
        </div>
      </div>

      <p class="result-desc">{result.desc}</p>

      <div class="tips">
        {#each result.tips as tip}
          <div class="tip">
            <span class="tip-dot" style="background:{c}"></span>
            <span>{tip}</span>
          </div>
        {/each}
      </div>

      <div class="next-group" style="border-color:{c};color:{c}">
        {result.nextGroupMsg}
      </div>
    </div>
  {/if}
</div>

<style>
  .calc-card {
    background: var(--color-background-primary, #fff);
    border: 0.5px solid var(--color-border-tertiary, #e5e5e5);
    border-radius: 12px;
    padding: 1.5rem;
    width: 100%;
    box-sizing: border-box;
  }

  .calc-header   { margin-bottom: 1.25rem; }
  .calc-title    { font-size: 18px; font-weight: 600; margin: 0 0 6px; color: var(--color-text-primary, #111); }
  .calc-subtitle { font-size: 13px; color: var(--color-text-secondary, #888); margin: 0; line-height: 1.5; }

  .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }

  .input-group label {
    display: block;
    font-size: 11px;
    color: var(--color-text-secondary, #888);
    margin-bottom: 5px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .input-group input {
    width: 100%;
    padding: 10px 12px;
    font-size: 15px;
    border: 0.5px solid var(--color-border-secondary, #ccc);
    border-radius: 8px;
    background: var(--color-background-secondary, #f9f9f9);
    color: var(--color-text-primary, #111);
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .input-group input:focus { border-color: var(--color-border-primary, #888); }

  .calc-error { font-size: 12px; color: #e05252; margin: 0 0 10px; }

  .calc-btn {
    width: 100%;
    padding: 11px;
    font-size: 14px;
    font-weight: 500;
    border: 0.5px solid var(--color-border-secondary, #ccc);
    border-radius: 8px;
    background: var(--color-background-primary, #fff);
    color: var(--color-text-primary, #111);
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: background 0.15s;
  }
  .calc-btn:hover { background: var(--color-background-secondary, #f5f5f5); }

  .result       { margin-top: 16px; padding: 1.1rem 1.2rem; border: 0.5px solid; border-radius: 10px; }
  .result-group { font-size: 22px; font-weight: 600; margin-bottom: 10px; }
  .result-desc  { font-size: 13px; color: var(--color-text-secondary, #666); line-height: 1.55; margin: 0 0 12px; }

  /* score breakdown bars */
  .score-grid    { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .score-row     { display: flex; align-items: center; gap: 8px; }
  .composite-row { margin-top: 3px; padding-top: 7px; border-top: 0.5px solid rgba(0,0,0,0.08); }
  .score-label   { font-size: 11px; font-weight: 500; color: var(--color-text-secondary, #888); width: 72px; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.03em; }
  .score-track   { flex: 1; height: 7px; background: var(--color-background-primary, #fff); border-radius: 4px; overflow: hidden; opacity: 0.9; }
  .score-fill    { height: 100%; border-radius: 4px; transition: width 0.5s cubic-bezier(.4,0,.2,1); }
  .score-val     { font-size: 11px; font-weight: 600; width: 46px; text-align: right; flex-shrink: 0; }

  .tips     { margin-bottom: 12px; }
  .tip      { display: flex; gap: 9px; align-items: flex-start; font-size: 13px; margin-bottom: 8px; line-height: 1.5; }
  .tip-dot  { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }

  .next-group {
    font-size: 12px;
    font-weight: 500;
    padding: 9px 11px;
    border: 0.5px solid;
    border-radius: 7px;
    background: var(--color-background-primary, #fff);
    line-height: 1.5;
    opacity: 0.9;
  }
</style>