<script lang="ts">
  export let progress = 0;

  $: normalizedProgress = Math.max(0, Math.min(1, progress / 100));
  $: introOpacity = Math.min(1, normalizedProgress * 3);

  import { fade, fly } from "svelte/transition";
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
    
  {/if}
</section>

<style>
  .intro-card {
    max-width: 1000px;
    margin: 0 auto;
    /* min-height: 80vh; */
    padding: 8vh 1.25rem 0;
  }

  h1 {
    font-size: clamp(2rem, 4vw, 3.2rem);
    line-height: 1.1;
    margin: 0 0 0.75rem;
    text-align: center;
  }



  h2 {
    font-size: clamp(1rem, 2.1vw, 1.3rem);
    font-weight: 500;
    line-height: 1.45;
    margin: 0 0 1rem;
    text-align: center;
  }
</style>
