<script lang="ts">
	let { size = 30 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
	<rect x="11" y="27" width="42" height="26" rx="4" fill="var(--color-mustard-400)" />
	<rect x="8" y="19" width="48" height="10" rx="3" fill="var(--color-rust-500)" />
	<rect x="28" y="19" width="8" height="34" fill="var(--color-teal-500)" />
	<path d="M32 19c-3-8-13-10-13-4s10 4 13 4zM32 19c3-8 13-10 13-4s-10 4-13 4z" fill="var(--color-teal-500)" />
</svg>
