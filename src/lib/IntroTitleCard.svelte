<script>
  export let progress = 0; // expected range: 0 -> 1 from your Scroll component

  $: clamped = Math.max(0, Math.min(1, progress));
  $: y = 40 - clamped * 40;          // move up as user scrolls
  $: opacity = 0.15 + clamped * 0.85; // fade in
</script>

<section
  class="intro-card"
  style="transform: translateY({y}px); opacity: {opacity};"
>
  <p class="eyebrow">Narrative Story</p>
  <h1>You just started running. Now what?</h1>
  <h2>
    Millions of people lace up every year, but most don’t know where to begin.
    We looked at real Strava data to find out what separates runners who improve
    from those who don’t.
  </h2>

  <p>
    Whether you ran your first mile last week or you’re just getting back into it,
    the question is always the same: <strong>Am I doing this right?</strong>
    We break it down through consistency, effort efficiency, and elevation.
  </p>

  <p>
    Over the past decade, running has steadily grown. Seasonal activity shows dips
    around February (~3,000 runs) and peaks in September–October (~3,900–4,000 runs),
    highlighting how routine and weather shape behavior.
  </p>

  <p>
    Most runners fall around 2–3 runs per week, while the top tier trains 4–6+.
    That consistency gap is where improvement begins.
  </p>

  <p class="closing">
    We’ll guide you through each finding so you can identify your current tier and
    your most realistic next step.
  </p>
</section>

<style>
  .intro-card {
    max-width: 760px;
    margin: 0 auto;
    padding: 20vh 1.25rem 18vh;
    transition: transform 120ms linear, opacity 120ms linear;
    will-change: transform, opacity;
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.75rem;
    opacity: 0.8;
    margin-bottom: 0.5rem;
  }

  h1 {
    font-size: clamp(2rem, 4vw, 3.2rem);
    line-height: 1.1;
    margin: 0 0 0.75rem;
  }

  h2 {
    font-size: clamp(1rem, 2.2vw, 1.35rem);
    font-weight: 500;
    line-height: 1.45;
    margin: 0 0 1.25rem;
    opacity: 0.95;
  }

  p {
    line-height: 1.65;
    margin: 0 0 1rem;
  }

  .closing {
    margin-top: 1.25rem;
    font-weight: 600;
  }
</style>