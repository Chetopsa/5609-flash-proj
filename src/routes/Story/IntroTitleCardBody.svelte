<script lang="ts">
  export let progress = 0;
  import { fly } from "svelte/transition";

  $: normalizedProgress = Math.max(0, Math.min(1, progress / 100));
  $: introOpacity = Math.min(1, normalizedProgress * 3);
  $: eyebrowVisible = progress > 2;
  $: sub1Visible = progress > 15;
  $: sub2Visible = progress > 30;
</script>

<section class="intro-body">
  {#if eyebrowVisible}
    <p class="eyebrow" in:fly={{ duration: 400, y: -10 }}>
      <span class="eyebrow-dot"></span>
      A data story about running
    </p>
  {/if}
  <h1 style="opacity: {introOpacity};">
    You just started running.<br />
    <em>Now what?</em>
  </h1>
  {#if sub1Visible}
    <p class="lead" in:fly={{ duration: 350, y: 22 }}>
      We analyzed real Strava data to find out what separates runners who improve
      from those who plateau — and the answer might surprise you.
    </p>
  {/if}
  {#if sub2Visible}
    <p class="body-text" in:fly={{ duration: 280, y: 18 }}>
      Over the past decade, running has grown steadily in popularity. Platforms like
      Strava now capture activity across runners of all levels, letting us move beyond
      assumptions and understand how behavior actually varies in practice.
    </p>
  {/if}
  {#if sub2Visible}
    <div class="scroll-hint" in:fly={{ duration: 300, y: 10, delay: 200 }}>
      <span class="scroll-arrow"></span>
      Scroll to explore
    </div>
  {/if}
</section>

<style>
  .intro-body {
    max-width: 900px;
    width: 100%;
    margin: 0 7rem 0 auto;
    padding: 10vh 2rem 4vh;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    gap: 0;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #7a7260;
    margin: 0 0 1.5rem;
  }

  .eyebrow-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #b5a882;
  }

  h1 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(2.4rem, 5vw, 4rem);
    line-height: 1.08;
    margin: 0 0 1.5rem;
    color: #1a1a18;
    letter-spacing: -0.02em;
  }

  h1 em {
    font-style: italic;
    color: #5c7a5a;
  }

  .lead {
    font-size: clamp(1.05rem, 2vw, 1.25rem);
    font-weight: 400;
    line-height: 1.55;
    margin: 0 0 1.25rem;
    color: #3a3830;
    max-width: 620px;
  }

  .body-text {
    font-size: clamp(0.9rem, 1.6vw, 1.05rem);
    font-weight: 300;
    line-height: 1.65;
    margin: 0 0 2.5rem;
    color: #6b6456;
    max-width: 580px;
  }

  .scroll-hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #9a9080;
    margin-top: 1rem;
  }

  .scroll-arrow {
    display: block;
    width: 1px;
    height: 32px;
    background: linear-gradient(to bottom, transparent, #b5a882);
    animation: pulse-down 1.8s ease-in-out infinite;
  }

  @keyframes pulse-down {
    0%, 100% { opacity: 0.4; transform: scaleY(0.7); transform-origin: top; }
    50% { opacity: 1; transform: scaleY(1); }
  }
</style>