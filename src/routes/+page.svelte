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

  .container {
    width: min(1200px, 94vw);
    margin: 1.25rem auto 2rem;
    padding: 0 0.75rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .section-card {
    border: 1px solid #e5ebf4;
    background: rgba(255, 255, 255, 0.82);
    border-radius: 12px;
    padding: 1rem;
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