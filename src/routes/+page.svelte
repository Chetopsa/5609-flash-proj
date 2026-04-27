<script lang="ts">
  import Vis1 from "./Story/Vis1.svelte";
  import Vis2 from "./Story/Vis2.svelte";
  import Vis3 from "./Story/Vis3.svelte";
  import Conclusion from "./Story/Conclusion.svelte";
  import IntroTitleCard from "./Story/IntroTitleCard.svelte";
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