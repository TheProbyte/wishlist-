<script lang="ts">
	/** A top hat to draw names from, with slips peeking out. `shaking` jiggles it like it's being stirred. */
	let { size = 160, shaking = false, slips = 3, class: cls = '' }: { size?: number; shaking?: boolean; slips?: number; class?: string } = $props();
</script>

<svg class="{shaking ? 'hat-shake' : ''} {cls}" width={size} height={size * 0.82} viewBox="0 0 160 132" aria-hidden="true">
	<g stroke="#2B1D14" stroke-width="3" stroke-linejoin="round">
		<!-- slips sticking up out of the hat -->
		{#if slips > 0}<rect x="58" y="10" width="22" height="34" rx="3" fill="#F3E7CF" transform="rotate(-14 69 27)" />{/if}
		{#if slips > 1}<rect x="78" y="6" width="22" height="36" rx="3" fill="#F3E7CF" transform="rotate(9 89 24)" />{/if}
		{#if slips > 2}<rect x="68" y="16" width="20" height="30" rx="3" fill="#EFE2C6" transform="rotate(-2 78 31)" />{/if}
		<!-- crown -->
		<path d="M40 36 L46 108 H114 L120 36 Z" fill="#44301F" />
		<ellipse cx="80" cy="36" rx="40" ry="10" fill="#2B1D14" />
		<!-- band -->
		<path d="M44.5 86 L45.6 100 H114.4 L115.5 86 Z" fill="#D2602D" />
		<rect x="98" y="83" width="9" height="20" rx="2" fill="#E8A83A" />
		<!-- brim -->
		<ellipse cx="80" cy="110" rx="70" ry="14" fill="#533B28" />
		<path d="M14 108 C30 122 130 122 146 108" fill="none" stroke-width="3" />
	</g>
	<path d="M52 44 L56 98" stroke="#6A4C34" stroke-width="4" stroke-linecap="round" opacity="0.7" />
</svg>
