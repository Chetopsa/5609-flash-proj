<script lang="ts">
  import Vis1 from "./Story/Vis1.svelte";
  import Vis2 from "./Story/Vis2.svelte";
  import Vis3 from "./Story/Vis3.svelte";
  import Conclusion from "./Story/Conclusion.svelte";
  import IntroTitleCard from "./Story/IntroTitleCard.svelte";
</script>

<div class="container">
  <section class="section-card intro-section">
    <IntroTitleCard />
  </section>

  <section class="section-card viz-section">
    <Vis1 />
  </section>

  <section class="section-card viz-section">
    <Vis2 />
  </section>

  <section class="section-card viz-section">
    <Vis3 />
  </section>

  <section class="section-card conclusion-section">
    <Conclusion />
  </section>
</div>


<style>

:global(body) {
    margin: 0;
    padding: 0;
    /* A "Road & Energy" gradient: Dark asphalt to a sunrise/safety orange */
    background: linear-gradient(
      180deg, 
      #59cdf0 0%,    /* Asphalt */    /* 59cdf0 */
      #59cdf0 70%,   /* Pavement */   /* 2d3436 */
      #d35400 100%   /* Safety Orange /* d35400 */     
    );
    background-attachment: fixed;
    min-height: 100vh;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .page-wrapper {
    min-height: 100vh;
    /* A gradient reminiscent of a sunrise run or athletic gear */
    background: linear-gradient(90deg, #74a6f1 0%, #6398ee 100%);
    background-attachment: fixed;
    padding: 1px 0; /* Prevents margin collapse */
  }

  .container {
    width: min(1200px, 94vw);
    margin: 1.25rem auto 2rem;
    padding: 0 0.75rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .section-card {
    border: 1px solid rgba(229, 235, 244, 0.5);
    /* Glassmorphism effect: high blur and semi-transparent white */
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  }

  .viz-section {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    padding: 1rem 1rem 1.4rem;
  }

  .viz-card {
    border: 1px solid #e5ebf4;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.86);
    padding: 0.9rem;
  }

  @media (max-width: 700px) {
    .container {
      width: min(1200px, 96vw);
      padding: 0 0.4rem 1rem;
      gap: 0.9rem;
    }

    .section-card,
    .viz-section {
      padding: 0.75rem;
    }

    .viz-card {
      padding: 0.65rem;
    }
  }
</style>