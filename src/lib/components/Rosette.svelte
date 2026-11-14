<script lang="ts">
	/**
	 * A prize rosette for the top three most-wanted gifts: a scalloped badge with two ribbon
	 * tails. Gold, silver (cream) and bronze (rust).
	 */
	let { place, size = 44, class: cls = '' }: { place: 1 | 2 | 3; size?: number; class?: string } = $props();

	const TONES = {
		1: { face: '#E8A83A', ring: '#F3C56A', text: '#2B1D14', tails: ['#D2602D', '#3E8E87'] },
		2: { face: '#F3E7CF', ring: '#FFFFFF', text: '#2B1D14', tails: ['#3E8E87', '#E8A83A'] },
		3: { face: '#D2602D', ring: '#EC9468', text: '#F3E7CF', tails: ['#E8A83A', '#3E8E87'] }
	} as const;
	const t = $derived(TONES[place]);

	// A scalloped edge: 14 bumps around a circle.
	const scallop = (() => {
		const n = 14;
		const pts: string[] = [];
		for (let i = 0; i < n * 2; i++) {
			const a = (Math.PI * i) / n - Math.PI / 2;
			const r = i % 2 ? 15.5 : 18;
			pts.push(`${(22 + r * Math.cos(a)).toFixed(2)},${(20 + r * Math.sin(a)).toFixed(2)}`);
		}
		return pts.join(' ');
	})();
</script>

<svg class="drop-shadow-[0_2px_0_var(--color-edge)] {cls}" width={size} height={size * (52 / 44)} viewBox="0 0 44 52" role="img" aria-label="Number {place}">
	<g stroke="#2B1D14" stroke-width="1.8" stroke-linejoin="round">
		<path d="M14 30 L8 50 L13 47 L16 51 L21 33 Z" fill={t.tails[0]} />
		<path d="M30 30 L36 50 L31 47 L28 51 L23 33 Z" fill={t.tails[1]} />
		<polygon points={scallop} fill={t.face} />
	</g>
	<circle cx="22" cy="20" r="11.5" fill="none" stroke={t.ring} stroke-width="1.6" stroke-dasharray="2 2.2" opacity="0.9" />
	<text x="22" y="25" text-anchor="middle" font-family="var(--font-display)" font-size="14" fill={t.text}>{place}</text>
</svg>
