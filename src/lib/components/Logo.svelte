<script lang="ts">
	let { size = 28 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
	<defs>
		<linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#f8d9a0" />
			<stop offset=".55" stop-color="#eaa94a" />
			<stop offset="1" stop-color="#f2829b" />
		</linearGradient>
	</defs>
	<rect x="12" y="26" width="40" height="26" rx="5" fill="none" stroke="url(#logo-g)" stroke-width="4" />
	<rect x="9" y="19" width="46" height="9" rx="3" fill="url(#logo-g)" />
	<path d="M32 19v33" stroke="var(--color-ink-950)" stroke-width="4" />
	<path
		d="M32 19c-3-7-12-9-12-3s9 3 12 3c3 0 12 3 12-3s-9-4-12 3z"
		fill="none"
		stroke="url(#logo-g)"
		stroke-width="3.5"
		stroke-linejoin="round"
	/>
</svg>
