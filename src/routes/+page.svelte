<script lang="ts">
  import Vis1 from "./Story/Vis1.svelte";
  import Vis2 from "./Story/Vis2.svelte";
  import Vis3 from "./Story/Vis3.svelte";
  import Conclusion from "./Story/Conclusion.svelte";
  import IntroTitleCard from "./Story/IntroTitleCard.svelte";
  import Acknowledgements from "./Story/Acknowledgements.svelte";
</script>

<div class="container">
  <section class="section-card intro-section">
    <IntroTitleCard />
  </section>

  <div class="section-divider" aria-hidden="true">
    <span class="divider-label">Part 1</span>
  </div>

  <section class="section-card viz-section">
    <Vis1 />
  </section>

  <div class="section-divider" aria-hidden="true">
    <span class="divider-label">Part 2</span>
  </div>

  <section class="section-card viz-section">
    <Vis2 />
  </section>

  <div class="section-divider" aria-hidden="true">
    <span class="divider-label">Part 3</span>
  </div>

  <section class="section-card viz-section">
    <Vis3 />
  </section>

  <div class="section-divider" aria-hidden="true">
    <span class="divider-label">Conclusion</span>
  </div>

  <section class="section-card conclusion-section">
    <Conclusion />
  </section>

  <section class="section-card acknowledgements-section">
    <Acknowledgements />
  </section>
</div>


<style>

:global(body) {
    margin: 0;
    padding: 0;
    background-color: #f4f1eb;
    background-image:
      radial-gradient(circle at 20% 0%, rgba(214, 198, 163, 0.35) 0%, transparent 50%),
      radial-gradient(circle at 80% 100%, rgba(180, 210, 190, 0.2) 0%, transparent 50%);
    background-attachment: fixed;
    min-height: 100vh;
    font-family: 'DM Sans', system-ui, sans-serif;
    color: #1a1a18;
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
    padding: 0 0 1.5rem;
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

  .conclusion-section {
    padding: 0;
  }

  .intro-section {
    padding: 10vh 2rem 4vh;
  }

  .acknowledgements-section {
    padding: 0;
  }

  .viz-card {
    border: 1px solid #e5ebf4;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.86);
    padding: 0.9rem;
  }
  .section-divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1.5rem 1rem;
    opacity: 0.55;
  }
 
  .section-divider::before,
  .section-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(80, 70, 50, 0.3);
  }
 
  .divider-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #7a7260;
    white-space: nowrap;
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