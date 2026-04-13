<script lang="ts">
  import Vis1 from "./Vis1.svelte";
  import Vis2 from "./Vis2.svelte";
  import Vis3 from "./Vis3.svelte";
  import Conclusion from "./Conclusion.svelte";
  import IntroTitleCard from "./IntroTitleCard.svelte";
</script>

<div class="container">
  <IntroTitleCard />
  <Vis1 />
  <Vis2 />
  <Vis3 />
  <Conclusion />
</div>

<style>
  .container {
    width: 80vw;
    margin: 10px auto;
    padding: 10px;
    align-content: center;

  }
</style>