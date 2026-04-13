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
		background-color: #f8fafc;
		background-image: radial-gradient(rgba(0,0,0,0.07) 1px, transparent 1px);
		background-size: 24px 24px;
		color: #333;
	}
</style>

