<script lang="ts">
  export let progress = 0;

  $: normalizedProgress = Math.max(0, Math.min(1, progress / 100));
  $: introOpacity = Math.min(1, normalizedProgress * 3);
  $: chartOpacity = Math.max(0, Math.min(1, (normalizedProgress - 0.42) * 2.8));
  $: closeOpacity = Math.max(0, Math.min(1, (normalizedProgress - 0.75) * 3));
  $: highlightedMonths = progress < 76 ? [2] : progress < 99 ? [9, 10] : [2, 9, 10];

  import { fade, fly } from "svelte/transition";
  import Months from "./Months.svelte";
</script>

<section class="intro-card">
  <h1 style="opacity: {introOpacity};">You just started running. Now what?</h1>

  {#if progress > 15}
    <h2 in:fly={{ duration: 300, y: 20 }}>
      We looked at real Strava data to find out what separates runners who improve
      from those who don’t.
    </h2>
  {/if}

  {#if progress > 30}
    <h2 in:fly={{ duration: 200, y: 20 }}>
      Over the past decade, running has grown steadily in popularity, with platforms like 
      Strava capturing activity data across runners of all levels. This allows us to move 
      beyond assumptions and understand how running behavior varies in practice. 
      <!-- Millions of people lace up every year, but most don’t know where to begin. -->

    </h2>
    <h2 in:fade={{ duration: 700}}>
    First let's look at when people typically run throughout the year.
    </h2>
  {/if}

  <div class="helper-slot">
    {#if progress > 43 && progress < 76}
      <p class="helper-text" style="opacity: {chartOpacity};" in:fade={{ duration: 200 }}>
        February dips to around 3,000 runs, showing a common early-year slowdown.
      </p>
    {:else if progress > 76}
      <p class="helper-text" style="opacity: {closeOpacity};" in:fly={{ duration: 200, y: 24 }}>
        By fall, especially September and October, activity climbs near 3,900–4,000.
        Next, we use this momentum lens to compare weekly consistency tiers.
      </p>
    {/if}
  </div>

  {#if progress > 45}
    <div class="months-wrap" style="opacity: {chartOpacity};" in:fade={{ duration: 100 }}>
      <Months highlightedMonths={highlightedMonths} yMax={4000} />
    </div>
  {/if}
</section>

<style>
  .intro-card {
    max-width: 900px;
    margin: 0 auto;
    min-height: 80vh;
    padding: 8vh 1.25rem 5vh;
  }


  h1 {
    font-size: clamp(2rem, 4vw, 3.2rem);
    line-height: 1.1;
    margin: 0 0 0.75rem;
  }

  h2 {
    font-size: clamp(1rem, 2.1vw, 1.3rem);
    font-weight: 500;
    line-height: 1.45;
    margin: 0 0 1rem;
  }

  p {
    line-height: 1.62;
    margin: 0.75rem 0;
  }

  .months-wrap {
    margin: 0 auto 0.5rem;
    max-width: min(92vw, 760px);
  }

  .helper-slot {
    min-height: 5.5rem;
    display: flex;
    align-items: flex-start;
  }

  .helper-text {
    margin: 0;
  }
</style>
