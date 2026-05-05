<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { onMount, onDestroy } from "svelte";

  let localProgress = 0;
  let sentinel: HTMLElement;

  $: normalizedProgress = Math.max(0, Math.min(1, localProgress / 100));
  $: titleOpacity = Math.min(1, normalizedProgress * 2.4);
  $: bodyOpacity = Math.max(0, Math.min(1, (normalizedProgress - 0.18) * 2.2));

  function update() {
    if (typeof window === "undefined" || !sentinel) return;
    const rect = sentinel.getBoundingClientRect();
    const windowH = window.innerHeight;
    const scrollable = rect.height - windowH;
    const scrolled = -rect.top;
    localProgress = Math.max(0, Math.min(100, (scrolled / scrollable) * 100));
  }

  onMount(() => {
    window.addEventListener("scroll", update, { passive: true });
    update();
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("scroll", update);
    }
  });

  const takeaways = [
    {
      threshold: 8,
      number: "01",
      title: "Consistency is everything",
      body: "Across frequency, efficiency, and terrain, one pattern holds: runners who train regularly improve more predictably over time. Volume beats intensity almost every time.",
    },
    {
      threshold: 24,
      number: "02",
      title: "Small habits, compounding gains",
      body: "The biggest improvements come from small habits repeated consistently — not occasional all-out sessions. One extra run per week compounds dramatically over months.",
    },
    {
      threshold: 42,
      number: "03",
      title: "Start with frequency",
      body: "Adding just one extra run per week can move you out of the lowest frequency tier. You don't need elite training volume to see meaningful pace improvements.",
    },
    {
      threshold: 60,
      number: "04",
      title: "Prioritize consistency over intensity",
      body: "Early runs may feel random, but improvement comes from showing up regularly. Over time, consistent runners become faster and more efficient as progress compounds.",
    },
    {
      threshold: 76,
      number: "05",
      title: "Introduce difficulty gradually",
      body: "Stick to flatter routes early on to build rhythm and base fitness. As your aerobic base deepens, introduce elevation — the challenge then builds endurance rather than breaking momentum.",
    },
  ];
</script>

<div class="sentinel" bind:this={sentinel}>
  <div class="sticky-panel">
    <section class="conclusion-wrap">

      <header class="conclusion-header" style="opacity: {titleOpacity};">
        <p class="section-label">
          <span class="label-pip"></span>
          Key takeaways
        </p>
        <h1>What the data tells us</h1>
        <p class="header-sub">
          Three visualizations. One clear pattern. Here's what it means for your running.
        </p>
      </header>

      <div class="takeaways-list">
        {#each takeaways as t, i}
          {#if localProgress > t.threshold}
            <div
              class="takeaway-row"
              style="opacity: {bodyOpacity};"
              in:fly={{ duration: 300, y: 24, delay: i * 40 }}
            >
              <span class="takeaway-number">{t.number}</span>
              <div class="takeaway-content">
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </div>
            </div>
          {/if}
        {/each}

        {#if localProgress > 90}
          <div class="closing-banner" in:fade={{ duration: 380 }}>
            <p class="closing-text">
              Stay consistent. Add runs gradually. Increase difficulty over time.
            </p>
            <p class="closing-kicker">You've got this.</p>
          </div>
        {/if}
      </div>

    </section>
  </div>
</div>

<style>
  .sentinel {
    position: relative;
    height: 500vh;
    width: 100%;
  }

  .sticky-panel {
    position: sticky;
    top: 0;
    width: 100%;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    box-sizing: border-box;
    padding: 6vh 0 4vh;
  }

  .conclusion-wrap {
    width: 100%;
    max-width: 820px;
    padding: 0 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .conclusion-header {
    text-align: center;
  }

  .section-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #7a7260;
    margin: 0 0 1rem;
  }

  .label-pip {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #b5a882;
  }

  h1 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(2rem, 4vw, 3.2rem);
    line-height: 1.08;
    margin: 0 0 0.75rem;
    letter-spacing: -0.02em;
    color: #1a1a18;
  }

  .header-sub {
    font-size: clamp(0.9rem, 1.7vw, 1.1rem);
    font-weight: 300;
    line-height: 1.55;
    color: #6b6456;
    margin: 0 auto;
    max-width: 500px;
  }

  .takeaways-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .takeaway-row {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 1.25rem;
    align-items: start;
    padding: 1.25rem 0;
    border-bottom: 1px solid rgba(160, 148, 120, 0.2);
    transition: opacity 0.4s ease;
  }

  .takeaway-row:last-of-type {
    border-bottom: none;
  }

  .takeaway-number {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 2rem;
    font-weight: 400;
    color: #c8bc9c;
    line-height: 1;
    padding-top: 2px;
    user-select: none;
  }

  .takeaway-content h3 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(1rem, 1.8vw, 1.2rem);
    font-weight: 400;
    margin: 0 0 0.4rem;
    color: #1a1a18;
    line-height: 1.3;
  }

  .takeaway-content p {
    margin: 0;
    font-size: clamp(0.88rem, 1.5vw, 1rem);
    font-weight: 300;
    line-height: 1.65;
    color: #5a5248;
  }
  .closing-banner {
    margin-top: 1.5rem;
    background: linear-gradient(135deg, #2c3a2a 0%, #3e5238 100%);
    border-radius: 14px;
    padding: 2.5rem 2rem;
    text-align: center;
  }

  .closing-text {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(1rem, 2.2vw, 1.4rem);
    font-weight: 400;
    font-style: italic;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.78);
    margin: 0 0 0.75rem;
  }

  .closing-kicker {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(1.6rem, 3vw, 2.4rem);
    color: #c8e8b8;
    margin: 0;
    letter-spacing: -0.01em;
  }
</style>