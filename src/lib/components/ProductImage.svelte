<script lang="ts">
	let { src, alt = '', class: cls = '' }: { src: string | null | undefined; alt?: string; class?: string } = $props();
	let failed = $state(false);
	$effect(() => {
		void src;
		failed = false;
	});
</script>

<!-- Product shots are made for white backgrounds, so they sit on a soft light tile. -->
<div class="grid place-items-center overflow-hidden bg-cream {cls}">
	{#if src && !failed}
		<img {src} {alt} loading="lazy" referrerpolicy="no-referrer" class="h-full w-full object-contain p-3 mix-blend-multiply" onerror={() => (failed = true)} />
	{:else}
		<svg width="40" height="40" viewBox="0 0 64 64" class="text-[#c9b79a]" aria-hidden="true">
			<rect x="12" y="26" width="40" height="26" rx="5" fill="none" stroke="currentColor" stroke-width="3.5" />
			<rect x="9" y="19" width="46" height="9" rx="3" fill="currentColor" />
			<path d="M32 19v33" stroke="#F3E7CF" stroke-width="3.5" />
		</svg>
	{/if}
</div>
