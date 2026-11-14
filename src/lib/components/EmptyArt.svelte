<script lang="ts">
	/**
	 * Little drawings for empty places: an open box with tissue paper (nothing wrapped yet), or
	 * two empty chairs waiting for people (no one in your circle yet).
	 */
	let { kind = 'box', class: cls = '' }: { kind?: 'box' | 'chairs'; class?: string } = $props();
</script>

{#if kind === 'box'}
	<svg viewBox="0 0 120 92" width="120" height="92" class={cls} aria-hidden="true">
		<g stroke="#2B1D14" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
			<!-- back flaps -->
			<path d="M28 40l10-14h44l10 14z" fill="#9c6a1c" />
			<!-- tissue paper poking out -->
			<path d="M34 42c2-14 10-10 13-24 5 12 9 4 13-6 4 10 9 16 14 4 3 12 9 10 12 26z" fill="#f3e7cf" />
			<path d="M47 18c2 6 2 12 0 22M60 12c1 8 1 18-1 28M74 16c-1 8-1 16 1 24" stroke="#c9b79a" stroke-width="1.6" fill="none" />
			<!-- the box -->
			<rect x="28" y="40" width="64" height="44" rx="4" fill="#e8a83a" />
			<rect x="55" y="40" width="10" height="44" fill="#d2602d" />
			<!-- open front flaps -->
			<path d="M28 40L10 50l8 10 10-12z" fill="#c58a26" />
			<path d="M92 40l18 10-8 10-10-12z" fill="#c58a26" />
		</g>
	</svg>
{:else}
	<svg viewBox="0 0 132 92" width="132" height="92" class={cls} aria-hidden="true">
		<g stroke="#2B1D14" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
			<!-- left chair -->
			<rect x="14" y="14" width="34" height="34" rx="6" fill="#3e8e87" />
			<rect x="10" y="48" width="42" height="10" rx="4" fill="#2f6f69" />
			<path d="M16 58v26M46 58v26" fill="none" />
			<!-- right chair -->
			<rect x="84" y="14" width="34" height="34" rx="6" fill="#d2602d" />
			<rect x="80" y="48" width="42" height="10" rx="4" fill="#9a4220" />
			<path d="M86 58v26M116 58v26" fill="none" />
			<!-- a little present waiting between them -->
			<rect x="56" y="62" width="20" height="22" rx="3" fill="#e8a83a" />
			<path d="M66 62v22M56 70h20" stroke="#d2602d" stroke-width="3" />
			<path d="M66 62c-6-8-12-4-8 0M66 62c6-8 12-4 8 0" fill="none" />
		</g>
	</svg>
{/if}
