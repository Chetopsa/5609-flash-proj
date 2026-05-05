<script lang="ts">
    const members = [
      "Sarthak Chandna",
      "Michael Fera",
      "Mete Kremers",
      "Cheston Opsasnick",
      "Sharon Soedarto",
    ];
  </script>
  
  <section class="ack-wrap">
  
    <header class="ack-header">
      <p class="section-label"><span class="label-pip"></span>Acknowledgments</p>
      <h2>About this project</h2>
    </header>
  
    <div class="ack-grid">
      <div class="ack-block">
        <h3 class="block-heading">Team Members</h3>
        <ul class="member-list">
          {#each members as name}
            <li>{name}</li>
          {/each}
        </ul>
      </div>
  
      <div class="ack-block">
        <h3 class="block-heading">Data Sources & References</h3>
        <p class="ack-text">
          <a
            href="https://www.kaggle.com/datasets/olegoaer/running-races-strava"
            target="_blank"
            rel="noopener noreferrer"
          >Running Races from Strava</a> by Olegoaer, via Kaggle.
        </p>
        <p class="ack-text built-with">
          Built using <span class="tech-tag">Svelte</span><span class="tech-tag">D3</span>
        </p>
      </div>
  
      <div class="ack-block">
        <h3 class="block-heading">Assistance & Feedback</h3>
        <p class="ack-text">
          We thank our classmates and Professor Wang for the valuable feedback
          and guidance throughout this project.
        </p>
      </div>
  
    </div>
  
    <footer class="ack-footer">
      <span class="footer-pip"></span>
    </footer>
  
  </section>
  
  <style>
    .ack-wrap {
      max-width: 860px;
      margin: 0 auto;
      padding: 5vh 2rem 6vh;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
  
    .ack-header {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
  
    .section-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #9a8e7a;
      margin: 0;
    }
  
    .label-pip {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #b5a882;
      flex-shrink: 0;
    }
  
    h2 {
      font-family: 'DM Serif Display', Georgia, serif;
      font-size: clamp(1.6rem, 3vw, 2.2rem);
      font-weight: 400;
      line-height: 1.15;
      margin: 0;
      color: #1a1a18;
      letter-spacing: -0.01em;
    }
  
    .ack-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid rgba(160, 148, 120, 0.25);
    }
  
    @media (max-width: 640px) {
      .ack-grid {
        grid-template-columns: 1fr;
      }
    }
  
    .ack-block {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
  
    .block-heading {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #9a8e7a;
      margin: 0;
    }
  
    .member-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
  
    .member-list li {
      font-family: 'DM Serif Display', Georgia, serif;
      font-size: clamp(0.9rem, 1.5vw, 1.05rem);
      font-weight: 400;
      color: #2a2820;
      line-height: 1.3;
    }
  
    .ack-text {
      font-size: 0.88rem;
      font-weight: 300;
      line-height: 1.6;
      color: #5a5248;
      margin: 0;
    }
  
    .ack-text a {
      color: #3a5c38;
      text-decoration: underline;
      text-decoration-color: rgba(58, 92, 56, 0.35);
      text-underline-offset: 3px;
      transition: text-decoration-color 0.15s;
    }
  
    .ack-text a:hover {
      text-decoration-color: rgba(58, 92, 56, 0.85);
    }
  
    .built-with {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
      margin-top: 0.35rem;
    }
  
    .tech-tag {
      display: inline-block;
      font-size: 10.5px;
      font-weight: 500;
      padding: 2px 9px;
      border-radius: 20px;
      border: 1px solid rgba(160, 148, 120, 0.4);
      background: rgba(245, 241, 232, 0.7);
      color: #6b6050;
      letter-spacing: 0.03em;
    }
  
    .ack-footer {
      display: flex;
      justify-content: center;
      padding-top: 1rem;
      border-top: 1px solid rgba(160, 148, 120, 0.2);
    }
  
    .footer-pip {
      display: block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #c8bc9c;
    }
  </style>