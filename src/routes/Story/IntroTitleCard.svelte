<script lang="ts">
  import { base } from "$app/paths";
  import { onDestroy, onMount } from "svelte";
  import { Scroll } from "$lib";
  import { fade } from "svelte/transition";
  import Months from "./Months.svelte";
  import type { AnimationItem } from "lottie-web";
  import IntroTitleCardBody from "./IntroTitleCardBody.svelte";

  let introProgress = 0;
  let chartProgress = 0;
  let runnerContainer: HTMLDivElement | null = null;
  let runnerAnimation: AnimationItem | null = null;

  onMount(async () => {
    const lottie = await import("lottie-web");
    if (!runnerContainer) return;

    runnerAnimation = lottie.default.loadAnimation({
      container: runnerContainer,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: `${base}/RunningMan.json`,
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    });
    runnerAnimation.setSpeed(1.2);
  });

  onDestroy(() => {
    runnerAnimation?.destroy();
    runnerAnimation = null;
  });

  $: chartOpacity = Math.max(0, Math.min(1, (chartProgress / 100) * 3));
  $: highlightedMonths = chartProgress < 45 ? [2] : chartProgress < 75 ? [9, 10] : [2, 9, 10];
  $: runnerProgress = Math.max(0, Math.min(1, (introProgress - 80) / 20));
  $: runnerX = runnerProgress * 100;
  $: runnerVisible = introProgress >= 80;

  $: if (runnerAnimation) {
    if (runnerVisible) runnerAnimation.play();
    else runnerAnimation.pause();
  }
</script>

<Scroll bind:progress={introProgress} --scrolly-story-width="0" --layout="viz-first">
  <div class="virtual intro"></div>

  <div slot="viz">
    <IntroTitleCardBody progress={introProgress} />

    <div class="runner-lane">
      <div class="runner-overlay" class:show-runner={runnerVisible} style="left: {runnerX}%;">
        <div class="runner-player" bind:this={runnerContainer}></div>
      </div>
    </div>
  </div>
</Scroll>

<Scroll bind:progress={chartProgress} --scrolly-story-width="0" --layout="viz-first">
  <div class="virtual chart"></div>

  <div slot="viz">
    <section class="chart-section">
      <header class="chart-header">
        <p class="section-label">
          <span class="label-pip"></span>
          When people run
        </p>
        <h2 in:fade={{ duration: 350 }}>
          Running activity follows a predictable seasonal rhythm throughout the year.
        </h2>
      </header>

      {#if chartProgress > 10}
        <div class="chart-body" style="opacity: {chartOpacity};" in:fade={{ duration: 150 }}>
          <div class="chart-wrap">
            <Months {highlightedMonths} yMax={4000} />
          </div>

          <aside class="chart-annotation">
            {#if chartProgress < 55}
              <div class="annotation-card annotation-feb">
                <span class="annotation-tag">February</span>
                <p>Dips to ~3,000 runs — a common early-year slowdown as motivation wanes after January.</p>
              </div>
            {:else}
              <div class="annotation-card annotation-fall">
                <span class="annotation-tag">September – October</span>
                <p>Activity climbs near 3,900–4,000. Race season and cooler weather drives a late-year surge.</p>
              </div>
            {/if}
          </aside>
        </div>
      {/if}

      {#if chartProgress > 85}
        <div class="transition-callout" in:fade={{ duration: 400 }}>
          <p>Now you know <em>when</em> people run.</p>
          <p>But what <strong>actually makes a runner faster?</strong> Let's look at how training habits shape performance.</p>
        </div>
      {/if}
    </section>
  </div>
</Scroll>

<style>
  .virtual.intro  { height: 170vh; }
  .virtual.chart  { height: 220vh; }

  .chart-section {
    max-width: 1180px;
    margin: 0 auto;
    min-height: 80vh;
    padding: 8vh 2rem 5vh;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .chart-header {
    max-width: 680px;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #7a7260;
    margin: 0 0 0.75rem;
  }

  .label-pip {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #b5a882;
  }

  h2 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(1.1rem, 2.2vw, 1.5rem);
    font-weight: 400;
    line-height: 1.35;
    margin: 0;
    color: #1a1a18;
  }

  .chart-body {
    display: grid;
    grid-template-columns: 1fr minmax(200px, 240px);
    align-items: start;
    gap: 1.5rem;
    transition: opacity 0.3s ease;
  }

  .chart-wrap {
    overflow-x: auto;
  }

  .annotation-card {
    padding: 1rem 1.25rem;
    border-radius: 10px;
    border-left: 3px solid;
    background: rgba(255, 255, 255, 0.7);
    position: sticky;
    top: 80px;
  }

  .annotation-feb {
    border-left-color: #9bbbd4;
    background: rgba(235, 243, 250, 0.7);
  }

  .annotation-fall {
    border-left-color: #c2a96b;
    background: rgba(252, 247, 238, 0.8);
  }

  .annotation-tag {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
    color: #6b6050;
  }

  .annotation-card p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.55;
    color: #4a4438;
  }
  .transition-callout {
    margin: 1rem auto 0;
    margin-right: 260px;
    max-width: 560px;
    text-align: center;
    padding: 2rem 1.5rem;
    border-top: 1px solid rgba(160, 148, 120, 0.25);
  }

  .transition-callout p {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(1rem, 2vw, 1.3rem);
    font-weight: 400;
    line-height: 1.5;
    margin: 0 0 0.5rem;
    color: #2a2820;
  }

  .transition-callout p:last-child { margin: 0; }

  .runner-lane {
    position: relative;
    width: min(920px, 100%);
    height: 120px;
    margin: 0.5rem auto 0;
  }

  .runner-overlay {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 140ms ease;
  }

  .runner-overlay.show-runner { opacity: 1; }

  .runner-player {
    width: 120px;
    height: 120px;
  }
</style>