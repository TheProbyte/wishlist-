<script lang="ts">
	/** A person's picture, or their initial on a palette colour. */
	let { name, src = null, size = 36 }: { name: string; src?: string | null; size?: number } = $props();
	const COLORS = ['#E8A83A', '#D2602D', '#3E8E87', '#F3E7CF'];
	const color = $derived(COLORS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length]);
	let failed = $state(false);
</script>

{#if src && !failed}
	<img {src} alt="" width={size} height={size} referrerpolicy="no-referrer" class="shrink-0 rounded-full object-cover shadow-[0_2px_0_0_var(--color-edge)]" style="width: {size}px; height: {size}px" onerror={() => (failed = true)} />
{:else}
	<span class="display grid shrink-0 place-items-center rounded-full text-cocoa-950 shadow-[0_2px_0_0_var(--color-edge)]" style="width: {size}px; height: {size}px; background: {color}; font-size: {size * 0.45}px" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
{/if}
