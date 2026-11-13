<script lang="ts">
	import { ICONS, isIcon } from '#lib/icons.ts';

	let { name, size = 20, class: cls = '', label }: { name: string; size?: number; class?: string; label?: string } = $props();
</script>

{#if isIcon(name)}
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="shrink-0 {cls}"
		role={label ? 'img' : undefined}
		aria-label={label}
		aria-hidden={label ? undefined : 'true'}
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html ICONS[name]}
	</svg>
{:else}
	<!-- A custom category made before the icon set existed: show what it was saved with. -->
	<span class="inline-grid shrink-0 place-items-center leading-none {cls}" style="width: {size}px; height: {size}px; font-size: {size * 0.8}px" aria-hidden="true">{name}</span>
{/if}
