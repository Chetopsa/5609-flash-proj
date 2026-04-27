<script lang="ts">
  import { Scroll } from "$lib";
  import { leastIndex } from "d3";
  import { fade, fly } from "svelte/transition";

  let localProgress = 0;
  $: normalizedProgress = Math.max(0, Math.min(1, localProgress / 100));
  $: titleOpacity = Math.min(1, normalizedProgress * 2.4);
  $: bodyOpacity = Math.max(0, Math.min(1, (normalizedProgress - 0.18) * 2.2));
  $: closeOpacity = Math.max(0, Math.min(1, (normalizedProgress - 0.65) * 3));
</script>

<Scroll bind:progress={localProgress} --scrolly-story-width="0">
  <div id="virtual"></div>
  <div slot="viz">
    <section class="conclusion-card">
      <h1 style="opacity: {titleOpacity};">Conclusion: What's the Deal?</h1>

      {#if localProgress > 8}
        <p style="opacity: {bodyOpacity};" in:fly={{ duration: 260, y: 18 }}>
          Across frequency, efficiency, and terrain, one pattern stays consistent:
          runners who <strong>train regularly</strong> improve more predictably over time.
        </p>
      {/if}

      {#if localProgress > 28}
       <p style="opacity: {bodyOpacity};" in:fade={{ duration: 220 }}>
          The biggest gains come from small habits repeated consistently, not from
          occasional all-out sessions.
        </p>
      {/if}

      {#if localProgress > 48}
       <p style="opacity: {bodyOpacity};" in:fade={{ duration: 220 }}>
          So, Start by focusing on <strong>frequency</strong>. You don’t need to run every day to move out of the lowest frequency range. 
          Adding <strong>one extra run per week</strong> can significantly improve your pace and overall performance
        </p>
      {/if}

      {#if localProgress > 68}
       <p style="opacity: {bodyOpacity};" in:fade={{ duration: 220 }}>
          Next, prioritize <strong>consistency over intensity</strong>. Early runs may feel random, but improvement comes from showing up regularly. 
          Over time, consistent runners become faster and more efficient as progress compounds.
        </p>
      {/if}

      {#if localProgress > 88}
       <p style="opacity: {bodyOpacity};" in:fade={{ duration: 220 }}>
          Finally, introduce <strong>difficulty gradually</strong>. If you are constantly running at high elevations, you won't see much improvement, so stick to flatter routes in the beginning to build rhythm. As your fitness improves, incorporate challenges 
          like elevation, so as it may slow you down initially, it helps build endurance and leads to better performance over time.
        </p>
      {/if}

      {#if localProgress > 98}
        <p style="opacity: {bodyOpacity};" in:fade={{ duration: 220 }}>
          <strong>In Short...</strong> Stay consistent, slowly add runs overtime, and increase difficulty step by step and you'll be the best runner in no time!
        </p>
      {/if}
    </section>
  </div>
</Scroll>

<style>
  #virtual {
    height: 220vh;
  }

  .conclusion-card {
    max-width: 900px;
    margin: 0 auto;
    min-height: 78vh;
    padding: 10vh 1.25rem 6vh;
  }

  h1 {
    font-size: clamp(2rem, 4vw, 3.1rem);
    line-height: 1.08;
    margin: 0 0 1rem;
    text-align: center;
  }

  p {
    margin: 0.7rem 0;
    line-height: 1.62;
    font-size: clamp(1rem, 1.85vw, 1.22rem);
    text-align: center;
  }

  .closing {
    margin-top: 1.2rem;
    font-weight: 600;
  }
</style>