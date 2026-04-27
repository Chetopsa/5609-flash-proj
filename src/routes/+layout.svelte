<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(body) {
		margin: 0;
		font-family: 'Inter', sans-serif;
		/* Subtle gradient keeps the UI clean without distracting from charts. */
		background: linear-gradient(180deg, #f4f8ff 0%, #f8fbff 45%, #fbfdff 100%);
		color: #333;
		overflow-x: hidden;
	}

	:global(*) {
		box-sizing: border-box;
	}
</style>

