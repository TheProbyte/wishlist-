<script lang="ts">
	import { enhance } from '$app/forms';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PaperPicker from '#lib/components/PaperPicker.svelte';
	import { STICKER_ICONS, STICKER_INKS, makeSticker, readSticker } from '#lib/stickers.ts';
	import { INKS, INK_NAMES, type Ink } from '#lib/papers.ts';
	import { HIGHLIGHTS, SEASONAL, THEMES, resolveTheme, seasonalTheme, type HighlightId, type ThemeChoice, type ThemeId } from '#lib/themes.ts';
	import { getPref, setPref } from '#lib/prefs.ts';
	import type { PageProps } from './$types';

	/** Look & feel: how others see you (sticker, paper) and how the app looks to you (theme, highlight, pointer). */
	let { data }: PageProps = $props();

	// How others see you.
	// svelte-ignore state_referenced_locally
	const startSticker = readSticker(data.profile.sticker);
	let useSticker = $state(!!startSticker);
	let stickerIcon = $state<string>(startSticker?.icon ?? 'gift');
	let stickerInk = $state<Ink>(startSticker?.ink ?? 'mustard');
	// svelte-ignore state_referenced_locally
	let myPaper = $state(data.profile.paper ?? 'sunburst');
	let lookBusy = $state(false);
	let lookSaved = $state(false);

	// How the app looks: applied the moment you tap, saved behind it.
	// svelte-ignore state_referenced_locally
	let theme = $state<ThemeChoice>(data.profile.theme as ThemeChoice);
	// svelte-ignore state_referenced_locally
	let highlight = $state<HighlightId>(data.profile.highlight as HighlightId);
	let themeForm = $state<HTMLFormElement>();
	/** Show a theme across the whole app (Seasonal shows this month's). */
	function show(choice: ThemeChoice) {
		const root = document.documentElement;
		const t = resolveTheme(choice) ?? 'cocoa';
		if (t === 'cocoa') delete root.dataset.theme;
		else root.dataset.theme = t;
		const bg = THEMES.find((x) => x.id === t)?.page;
		if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
	}
	function apply() {
		const root = document.documentElement;
		show(theme);
		if (highlight === 'auto') delete root.dataset.highlight;
		else root.dataset.highlight = highlight;
		queueMicrotask(() => themeForm?.requestSubmit());
	}

	/* Hold a theme to try it on: the whole app wears it while you hold, and goes back when you
	   let go. A quick tap picks it. */
	let previewing = $state<ThemeChoice | null>(null);
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let held = false;
	function pressTheme(id: ThemeChoice) {
		held = false;
		clearTimeout(holdTimer);
		holdTimer = setTimeout(() => {
			held = true;
			previewing = id;
			show(id);
			navigator.vibrate?.(6);
		}, 280);
	}
	function releaseTheme() {
		clearTimeout(holdTimer);
		if (!previewing) return;
		previewing = null;
		show(theme);
	}
	function tapTheme(id: ThemeChoice) {
		if (held) return void (held = false);
		theme = id;
		apply();
	}
	const nowSeason = seasonalTheme();
	const seasonLook = THEMES.find((t) => t.id === nowSeason)!;

	// The paper pointer, remembered on this computer.
	let paperPointer = $state(false);
	$effect(() => {
		paperPointer = getPref('pointer') !== 'normal';
	});
</script>

<svelte:head><title>Look &amp; feel · The Giver</title></svelte:head>

<a href="/me" class="-mt-2 mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-fg-faint hover:text-fg"><Icon name="chevron-left" size={18} />You</a>
<h1 class="display accent-bar mb-6 text-[34px] leading-tight">Look &amp; feel</h1>

<!-- The app's colours -->
<form method="POST" action="?/saveTheme" bind:this={themeForm} use:enhance={() => async () => {}} class="mb-8">
	<input type="hidden" name="theme" value={theme} />
	<input type="hidden" name="highlight" value={highlight} />
	<h2 class="text-lg font-bold">App theme</h2>
	<p class="mt-0.5 mb-3 text-sm text-fg-muted">The whole app’s background and cards. Mustard, rust and teal stay, so it still feels like The Giver. <span class="text-fg-faint">Hold one to try it on.</span></p>
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
		{#each [...THEMES, { ...seasonLook, id: SEASONAL.id, name: SEASONAL.name, note: `Now: ${seasonLook.name}` }] as t (t.id)}
			<button
				type="button"
				class="relative overflow-hidden rounded-[var(--radius-card)] text-left ring-3 transition select-none [-webkit-touch-callout:none] {theme === t.id ? 'ring-[var(--accent)]' : 'ring-transparent hover:ring-cocoa-600'} {previewing === t.id ? 'scale-[1.03]' : ''}"
				style="background: {t.page}; color: {t.text}"
				aria-pressed={theme === t.id}
				onpointerdown={() => pressTheme(t.id as ThemeChoice)}
				onpointerup={releaseTheme}
				onpointerleave={releaseTheme}
				onpointercancel={releaseTheme}
				onclick={() => tapTheme(t.id as ThemeChoice)}
			>
				{#if t.id === SEASONAL.id}<span class="absolute top-2 right-2 rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] font-bold">Auto</span>{/if}
				<!-- A tiny version of the app in this theme. -->
				<span class="block h-1.5" style="background: linear-gradient(to bottom, #e8a83a 0 33%, #d2602d 33% 66%, #3e8e87 66%)"></span>
				<span class="flex gap-1.5 p-2.5">
					<span class="h-12 flex-1 rounded-[8px] p-1.5" style="background: {t.card}">
						<span class="block h-5 rounded-[5px]" style="background: repeating-linear-gradient(135deg, #e8a83a 0 5px, #f3e7cf 5px 10px)"></span>
						<span class="mt-1.5 block h-1.5 w-2/3 rounded-full" style="background: {t.text}; opacity: 0.7"></span>
					</span>
					<span class="h-12 flex-1 rounded-[8px] p-1.5" style="background: {t.card}">
						<span class="block h-5 rounded-[5px]" style="background: repeating-linear-gradient(90deg, #3e8e87 0 6px, #f3e7cf 6px 12px)"></span>
						<span class="mt-1.5 block h-1.5 w-1/2 rounded-full" style="background: {t.text}; opacity: 0.7"></span>
					</span>
				</span>
				<span class="flex items-center justify-between px-2.5 pb-2.5">
					<span><span class="block text-sm font-bold">{t.name}</span><span class="block text-[11px] opacity-70">{t.note}</span></span>
					{#if theme === t.id}<span class="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]"><Icon name="check" size={14} /></span>{/if}
				</span>
			</button>
		{/each}
	</div>

	<h2 class="mt-7 text-lg font-bold">Highlight colour</h2>
	<p class="mt-0.5 mb-3 text-sm text-fg-muted">The colour of picked chips, the tab you’re on and the bars under titles. “By tab” gives Lists, People and You a colour each.</p>
	<div class="flex flex-wrap gap-3">
		{#each HIGHLIGHTS as h (h.id)}
			<button
				type="button"
				class="flex flex-col items-center gap-1.5 text-xs font-bold {highlight === h.id ? 'text-fg' : 'text-fg-faint hover:text-fg'}"
				aria-pressed={highlight === h.id}
				onclick={() => {
					highlight = h.id;
					apply();
				}}
			>
				<span class="h-11 w-11 rounded-full ring-3 ring-offset-2 ring-offset-cocoa-950 transition {highlight === h.id ? 'ring-[var(--accent)]' : 'ring-transparent'}" style="background: {h.color}; box-shadow: inset 0 0 0 2px rgb(0 0 0 / 0.25)"></span>
				{h.name}
			</button>
		{/each}
	</div>
</form>

<!-- How others see you: a sticker instead of your photo, and your signature paper. -->
<form
	method="POST"
	action="?/saveLook"
	class="card mb-8 p-4 sm:p-5"
	use:enhance={() => {
		lookBusy = true;
		return async ({ update }) => {
			await update({ reset: false });
			lookBusy = false;
			lookSaved = true;
			setTimeout(() => (lookSaved = false), 1800);
		};
	}}
>
	<h2 class="text-lg font-bold">How others see you</h2>
	<p class="mt-0.5 text-sm text-fg-muted">How you show up to your people: on your tag, your share links, and the paper your gifts get wrapped in.</p>
	<input type="hidden" name="sticker" value={useSticker ? makeSticker(stickerIcon, stickerInk) : ''} />

	<div class="mt-4 flex items-center gap-4">
		<Avatar name={data.profile.name} src={data.profile.avatar_url} sticker={useSticker ? makeSticker(stickerIcon, stickerInk) : null} size={64} />
		<div class="flex gap-1.5 rounded-full bg-cocoa-950 p-1 text-sm font-bold">
			<button type="button" class="rounded-full px-3 py-1.5 {useSticker ? 'bg-cocoa-800 text-fg' : 'text-fg-faint'}" aria-pressed={useSticker} onclick={() => (useSticker = true)}>Sticker</button>
			<button type="button" class="rounded-full px-3 py-1.5 {!useSticker ? 'bg-cocoa-800 text-fg' : 'text-fg-faint'}" aria-pressed={!useSticker} onclick={() => (useSticker = false)}>{data.profile.avatar_url ? 'My photo' : 'My initial'}</button>
		</div>
	</div>
	{#if useSticker}
		<div class="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-9">
			{#each STICKER_ICONS as icon (icon)}
				<button type="button" class="grid aspect-square place-items-center rounded-[12px] transition {stickerIcon === icon ? 'bg-mustard-400 text-cocoa-950' : 'bg-cocoa-800 text-fg-muted hover:text-fg'}" aria-label={icon} aria-pressed={stickerIcon === icon} onclick={() => (stickerIcon = icon)}>
					<Icon name={icon} size={20} />
				</button>
			{/each}
		</div>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each STICKER_INKS as ink (ink)}
				<button type="button" class="h-9 w-9 rounded-full ring-3 ring-offset-2 ring-offset-cocoa-850 transition {stickerInk === ink ? 'ring-mustard-400' : 'ring-transparent hover:ring-cocoa-600'}" style="background: {INKS[ink]}; box-shadow: inset 0 0 0 2px rgb(0 0 0 / 0.25)" aria-label={INK_NAMES[ink]} aria-pressed={stickerInk === ink} onclick={() => (stickerInk = ink)}></button>
			{/each}
		</div>
	{/if}

	<span class="label mt-5">Your paper</span>
	<PaperPicker bind:value={myPaper} name="paper" />

	<div class="mt-4 flex justify-end">
		<button class="btn-primary" disabled={lookBusy}>{lookSaved ? 'Saved' : lookBusy ? 'Saving…' : 'Save my look'}</button>
	</div>
</form>

<!-- Computers only: the paper pointer. -->
<label class="card mb-8 hidden cursor-pointer items-center gap-3 p-4 sm:flex">
	<span class="grid h-11 w-11 place-items-center rounded-full bg-cocoa-950 text-rust-300"><Icon name="sparkle" size={22} /></span>
	<span class="flex-1"><span class="block font-bold">Paper pointer</span><span class="text-sm text-fg-muted">A cream arrow that turns mustard over anything you can click</span></span>
	<input
		type="checkbox"
		class="h-6 w-6 rounded-md border-2 border-cocoa-600 bg-sunken text-rust-500 focus:ring-0 focus:ring-offset-0"
		checked={paperPointer}
		onchange={(e) => {
			paperPointer = e.currentTarget.checked;
			setPref('pointer', paperPointer ? 'paper' : 'normal');
			if (paperPointer) document.documentElement.dataset.pointer = 'paper';
			else delete document.documentElement.dataset.pointer;
		}}
	/>
</label>

