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
      <h1 style="opacity: {titleOpacity};">Conclusion: Build consistency first</h1>

      {#if localProgress > 12}
        <p style="opacity: {bodyOpacity};" in:fly={{ duration: 260, y: 18 }}>
          Across frequency, efficiency, and terrain, one pattern stays consistent:
          runners who train regularly improve more predictably over time.
        </p>
      {/if}

      {#if localProgress > 33}
       <p style="opacity: {bodyOpacity};" in:fade={{ duration: 220 }}>
          The biggest gains come from small habits repeated consistently, not from
          occasional all-out sessions.
        </p>
      {/if}

      {#if localProgress > 55}
        <p style="opacity: {bodyOpacity};" in:fade={{ duration: 220 }}>
          <strong> Keep running...</strong>
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
  }

  p {
    margin: 0.7rem 0;
    line-height: 1.62;
    font-size: clamp(1rem, 1.85vw, 1.22rem);
  }

  .closing {
    margin-top: 1.2rem;
    font-weight: 600;
  }
</style>