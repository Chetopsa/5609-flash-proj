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
      rendererSettings: {
        preserveAspectRatio: "xMidYMid meet",
      },
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
     <!--  runing guy lottie in here and have it go across the screen as it scrolls -->
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
    <section class="chart-card">
      <h2 in:fade={{ duration: 350 }}>First let's look at when people typically run throughout the year.</h2>

      {#if chartProgress > 10}
        <div class="months-wrap" style="opacity: {chartOpacity};" in:fade={{ duration: 150 }}>
          <div class="chart-shell">
            <Months highlightedMonths={highlightedMonths} yMax={4000} />
          </div>

          {#if chartProgress < 55}
            <p class="helper-text">
              February dips to around 3,000 runs, showing a common early-year slowdown.
            </p>
          {:else}
            <p class="helper-text">
              By fall, especially September and October, activity climbs near 3,900–4,000.
              Next, we use this momentum lens to compare weekly consistency tiers.
            </p>
          {/if}
        </div>
      {/if}
    </section>

  </div>
</Scroll>

<style>
  .virtual.intro {
    height: 170vh;
  }

  .virtual.chart {
    height: 220vh;
  }

  .chart-card {
    max-width: 1180px;
    margin: 0 auto;
    min-height: 80vh;
    padding: 8vh 1.25rem 5vh;
  }

  h2 {
    font-size: clamp(1rem, 2.1vw, 1.3rem);
    font-weight: 500;
    line-height: 1.45;
    margin: 0 0 1rem;
  }

  .months-wrap {
    display: grid;
    grid-template-columns: auto minmax(180px, 240px);
    align-items: start;
    gap: 1rem;
    margin: 0 auto 0.5rem;
    width: 100%;
  }

  .chart-shell {
    width: 920px;
    flex: 0 0 auto;
  }

  .helper-text {
    margin: 0;
    font-size: 1.2rem;
    line-height: 1.45;
    max-width: 230px;
  }

  .runner-overlay {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 140ms ease;
  }

  .runner-lane {
    position: relative;
    width: min(920px, 100%);
    height: 120px;
    margin: 0.5rem auto 0;
  }

  .runner-overlay.show-runner {
    opacity: 1;
  }

  .runner-player {
    width: 120px;
    height: 120px;
  }
</style>