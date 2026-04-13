<script lang="ts">
  import { Scroll } from "$lib";
  import IntroTitleCardBody from "./IntroTitleCardBody.svelte";

  let localProgress = 0;
</script>

<Scroll bind:progress={localProgress} --scrolly-story-width="0">
  <div id="virtual"></div>
  <div slot="viz">
    <IntroTitleCardBody progress={localProgress} />
  </div>
</Scroll>

<style>
  #virtual {
    height: 270vh;
  }
</style>