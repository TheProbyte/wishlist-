<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import SantaHat from '#lib/components/SantaHat.svelte';
	import { fade } from 'svelte/transition';
	import { dur } from '#lib/motion.ts';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import Confetti from '#lib/components/Confetti.svelte';
	import { countdownLabel, formatDate, formatPrice } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let confirmDelete = $state(false);

	const invite = $derived(`${page.url.origin}/santa/join/${data.exchange.invite_token}`);
	let copied = $state(false);
	async function copy() {
		await navigator.clipboard.writeText(invite);
		copied = true;
		setTimeout(() => (copied = false), 1800);
	}
	// Your slip: folded every time you come back (so nobody glancing sees it); tap to unfold.
	// The first unfold each visit is the full show: a tug, the slip opens, the stamp lands, then
	// the name writes itself on and the confetti goes. After that it simply opens.
	let revealed = $state(false);
	let tugging = $state(false);
	let theatre = $state(false);
	let fire = $state(0);
	let firstUnfold = true;
	function unfold() {
		if (tugging) return;
		if (!firstUnfold || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			revealed = true;
			return;
		}
		firstUnfold = false;
		tugging = true;
		// Let the organiser know you've seen yours (just that, never who).
		fetch('?/seen', { method: 'POST', body: new FormData(), headers: { 'x-sveltekit-action': 'true' } });
		setTimeout(() => {
			tugging = false;
			theatre = true;
			revealed = true;
			setTimeout(() => fire++, 2100);
		}, 420);
	}

	/* Keeping people apart: tap two people, then keep them apart. */
	let picking = $state<string[]>([]);
	const nameOf = (id: string) => (id === data.me?.id ? 'You' : (data.members.find((m) => m.id === id)?.name.split(' ')[0] ?? 'Someone'));
	function pick(id: string) {
		picking = picking.includes(id) ? picking.filter((x) => x !== id) : [...picking, id].slice(-2);
	}
	// Drawing names: the hat gets a good shake while the server pairs everyone up.
	let drawing = $state(false);
	let confirmRedraw = $state(false);
</script>

<svelte:head><title>{data.exchange.name} · The Giver</title></svelte:head>

<a href="/people" class="-mt-2 mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-fg-faint hover:text-fg"><Icon name="chevron-left" size={18} />People</a>

<section class="mb-6">
	<p class="text-sm font-bold text-rust-300">Secret Santa</p>
	<h1 class="display text-[38px] leading-tight">{data.exchange.name}</h1>
	<div class="mt-3 flex flex-wrap gap-2">
		{#if data.exchange.budget_cents}<GiftTag tone="mustard">{formatPrice(data.exchange.budget_cents, data.exchange.currency)} budget</GiftTag>{/if}
		{#if data.exchange.exchange_date}<GiftTag>{formatDate(data.exchange.exchange_date)} · {countdownLabel(data.exchange.exchange_date)}</GiftTag>{/if}
	</div>
</section>

{#if data.exchange.drawn && data.recipient}
	<!-- Your match: a folded slip in the hat. -->
	<div class="card relative mb-8 overflow-hidden px-6 pt-6 pb-7 text-center">
		<Confetti {fire} />
		{#if !revealed}
			<button class="group mx-auto block" onclick={unfold} aria-label="Unfold your slip">
				<div class="relative mx-auto w-fit {tugging ? 'slip-tug' : ''}">
					<SantaHat size={170} slips={2} />
					<!-- your slip, folded, sticking out of the hat -->
					<span class="slip-rise absolute top-[2%] left-1/2 -ml-[64px] block w-32 rounded-[6px] border-[3px] border-cocoa-950 bg-cream px-3 py-2.5 text-cocoa-950 shadow-[0_3px_0_0_var(--color-edge)] transition group-hover:-translate-y-1">
						<span class="block border-b border-dashed border-cocoa-950/40 pb-1 text-[11px] font-bold tracking-widest uppercase">Your slip</span>
						<span class="block pt-1 text-xs font-bold text-rust-500">Tap to unfold</span>
					</span>
				</div>
				<p class="mt-4 text-sm text-fg-muted">It’s folded again each time you come back, so nobody peeks.</p>
			</button>
		{:else}
			<div class="slip-unfold mx-auto max-w-xs rounded-[10px] border-[3px] border-cocoa-950 bg-cream px-6 pt-5 pb-6 text-cocoa-950 shadow-[0_4px_0_0_var(--color-edge)] {theatre ? 'theatre' : ''}">
				<!-- the fold line across the middle of the paper -->
				<div class="relative">
					<p class="text-xs font-bold tracking-widest text-rust-500 uppercase">You’re Secret Santa for</p>
					<div class="stamp mx-auto mt-3 w-fit {theatre ? 'stamp-late' : ''}"><Avatar name={data.recipient.name} src={data.recipient.avatar_url} sticker={data.recipient.sticker} size={84} /></div>
					<h2 class="display relative mx-auto mt-2 w-fit text-[32px] leading-tight {theatre ? 'write-on' : ''}">{data.recipient.name}</h2>
					{#if theatre}
						<!-- A pen stroke under the name, drawn once it's written. -->
						<svg class="mx-auto -mt-1 block h-3 w-40" viewBox="0 0 160 12" aria-hidden="true"><path class="pen-line" d="M4 8 C 40 2, 80 11, 156 4" fill="none" stroke="var(--color-rust-500)" stroke-width="3" stroke-linecap="round" /></svg>
					{/if}
					<div class="my-3 border-t-2 border-dashed border-cocoa-950/25"></div>
					<p class="text-sm text-cocoa-700">Shh! Only you can see this.</p>
				</div>
			</div>
			<div class="mt-5 flex flex-wrap justify-center gap-2">
				<a href="/people/{data.recipient.id}" class="btn-teal">See their wish list <Icon name="chevron-right" size={18} /></a>
				<button class="btn-quiet text-sm" onclick={() => (revealed = false)}>Fold it back</button>
			</div>
		{/if}
	</div>
{:else if data.exchange.drawn}
	<p class="card mb-8 p-5 text-sm text-fg-muted">Names were drawn before you joined. Ask the organiser to draw again.</p>
{/if}

<section class="mb-8">
	<div class="mb-3 flex items-baseline justify-between">
		<h2 class="text-lg font-bold">Who’s in ({data.members.length})</h2>
		{#if data.isOrganiser}<span class="text-xs font-bold text-fg-faint">Only you see this board</span>{/if}
	</div>
	{#if data.isOrganiser}
		<!-- The organiser's board: who's opened their slip, who has ideas on their list. Never who has whom. -->
		<div class="card divide-y-2 divide-cocoa-800 overflow-hidden">
			{#each data.members as m (m.id)}
				<div class="flex items-center gap-3 px-3.5 py-2.5">
					<Avatar name={m.name} src={m.avatar_url} sticker={m.sticker} size={34} />
					<span class="min-w-0 flex-1 truncate font-bold">{m.id === data.me?.id ? 'You' : m.name}</span>
					{#if data.exchange.drawn}
						<span class="pill shrink-0 {m.seen ? 'bg-teal-600/30 text-teal-300' : ''}">{#if m.seen}<Icon name="check" size={12} />Opened slip{:else}Not opened{/if}</span>
					{/if}
					<span class="pill shrink-0 {m.gifts ? '' : 'bg-rust-500/20 text-rust-300'}">{m.gifts ? `${m.gifts} ${m.gifts === 1 ? 'idea' : 'ideas'}` : 'No ideas yet'}</span>
					{#if !data.exchange.drawn && m.id !== data.me?.id}
						<form method="POST" action="?/remove" use:enhance class="inline-flex">
							<input type="hidden" name="user" value={m.id} />
							<button class="grid h-8 w-8 place-items-center rounded-full text-fg-faint hover:bg-cocoa-800 hover:text-rust-300" aria-label="Remove {m.name}"><Icon name="close" size={15} /></button>
						</form>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="flex flex-wrap gap-2">
			{#each data.members as m (m.id)}
				<span class="chip pr-3 pl-1"><Avatar name={m.name} src={m.avatar_url} sticker={m.sticker} size={28} />{m.id === data.me?.id ? 'You' : m.name.split(' ')[0]}</span>
			{/each}
		</div>
	{/if}
</section>

{#if data.isOrganiser && !data.exchange.drawn && data.members.length >= 3}
	<!-- Keep apart: couples, or last year's pairs. The draw never pairs them, either way round. -->
	<section class="card mb-8 p-5">
		<h2 class="font-bold">Keep apart</h2>
		<p class="mt-1 text-sm text-fg-muted">Couples, or last year’s pairs: tap two people who shouldn’t draw each other.</p>
		{#if data.apart.length}
			<div class="mt-3 flex flex-wrap gap-1.5">
				{#each data.apart as pr (pr.a + pr.b)}
					<form method="POST" action="?/together" use:enhance class="inline-flex">
						<input type="hidden" name="a" value={pr.a} /><input type="hidden" name="b" value={pr.b} />
						<button class="chip pr-2 hover:text-fg" aria-label="Let {nameOf(pr.a)} and {nameOf(pr.b)} draw each other">{nameOf(pr.a)} <span class="text-rust-300">✕</span> {nameOf(pr.b)}<Icon name="close" size={13} class="opacity-60" /></button>
					</form>
				{/each}
			</div>
		{/if}
		<div class="mt-3 flex flex-wrap gap-1.5">
			{#each data.members as m (m.id)}
				<button type="button" class="chip pr-3 pl-1 {picking.includes(m.id) ? 'chip-on' : 'hover:text-fg'}" aria-pressed={picking.includes(m.id)} onclick={() => pick(m.id)}>
					<Avatar name={m.name} src={m.avatar_url} sticker={m.sticker} size={26} />{m.id === data.me?.id ? 'You' : m.name.split(' ')[0]}
				</button>
			{/each}
		</div>
		<form method="POST" action="?/apart" use:enhance={() => async ({ update }) => { await update(); picking = []; }} class="mt-3">
			<input type="hidden" name="a" value={picking[0] ?? ''} /><input type="hidden" name="b" value={picking[1] ?? ''} />
			<button class="btn-ghost text-sm" disabled={picking.length !== 2}>{picking.length === 2 ? `Keep ${nameOf(picking[0])} and ${nameOf(picking[1])} apart` : 'Pick two people'}</button>
		</form>
	</section>
{/if}

{#if !data.exchange.drawn}
	<section class="card mb-8 p-5">
		<h2 class="font-bold">Invite people</h2>
		<p class="mt-1 text-sm text-fg-muted">Send this link to everyone taking part. They sign in with Google and they’re in.</p>
		<div class="mt-3 flex gap-2">
			<input class="field font-mono text-xs" readonly value={invite} onfocus={(e) => e.currentTarget.select()} />
			<button class="btn-teal shrink-0" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
		</div>
	</section>
{/if}

{#if data.isOrganiser}
	<section class="mb-8">
		{#if !data.exchange.drawn}
			<form
				method="POST"
				action="?/draw"
				use:enhance={() => {
					drawing = true;
					const started = Date.now();
					return async ({ update }) => {
						// Give the hat a proper shake, however quick the server is.
						await new Promise((r) => setTimeout(r, Math.max(0, 1700 - (Date.now() - started))));
						await update();
						drawing = false;
					};
				}}
			>
				<button class="btn-primary w-full" disabled={data.members.length < 3 || drawing}><Icon name="shuffle" size={18} />Draw names</button>
			</form>
			<p class="mt-2 text-center text-xs text-fg-faint">{data.members.length < 3 ? 'You need at least 3 people.' : 'Everyone gets one person, and nobody gets themselves. Not even you will see the pairs.'}</p>
		{:else}
			<form method="POST" action="?/reopen" use:enhance class="text-center">
				{#if confirmRedraw}
					<p class="mb-2 text-sm text-fg-muted">This clears everyone’s match and reopens joining. Then draw again.</p>
					<button class="btn-danger">Clear the draw</button>
				{:else}
					<button type="button" class="btn-quiet text-sm" onclick={() => (confirmRedraw = true)}>Someone missing? Reopen and draw again</button>
				{/if}
			</form>
		{/if}
	</section>
{/if}

{#if data.isOrganiser}
	<!-- Delete, any time, with one confirm. -->
	<form method="POST" action="?/delete" use:enhance class="mt-4 rounded-[var(--radius-card)] bg-rust-500/10 p-4 text-center">
		{#if confirmDelete}
			<p class="mb-3 text-sm text-fg-muted">Delete {data.exchange.name} for everyone?{#if data.exchange.drawn}&nbsp;Everyone’s match is lost too.{/if}</p>
			<div class="flex justify-center gap-2">
				<button type="button" class="btn-quiet text-sm" onclick={() => (confirmDelete = false)}>Keep it</button>
				<button class="btn-danger text-sm">Delete Secret Santa</button>
			</div>
		{:else}
			<button type="button" class="btn-quiet text-sm text-rust-300 hover:text-rust-300" onclick={() => (confirmDelete = true)}>Delete this Secret Santa</button>
		{/if}
	</form>
{:else}
	<form method="POST" action="?/leave" use:enhance class="text-center">
		<button class="btn-quiet text-sm hover:text-rust-300" disabled={data.exchange.drawn}>{data.exchange.drawn ? 'Names are drawn, so you’re in' : 'Leave'}</button>
	</form>
{/if}
{#if form?.error}<p class="mt-3 text-center text-sm font-bold text-rust-300">{form.error}</p>{/if}

{#if drawing}
	<!-- Drawing names: the hat shakes and slips fly out. -->
	<div class="fixed inset-0 z-[80] grid place-items-center bg-[#120b07]/85" transition:fade={{ duration: dur(180) }} role="status" aria-label="Drawing names">
		<div class="text-center">
			<div class="relative mx-auto w-fit">
				<SantaHat size={200} shaking slips={3} />
				{#each [[-70, -160, 0], [60, 140, 160], [-20, 220, 320], [90, -120, 480], [-90, 90, 640]] as [x, r, d], i (i)}
					<span class="slip-fly" style="--x: {x}px; --r: {r}deg; --d: {d}ms"></span>
				{/each}
			</div>
			<p class="display mt-4 text-2xl">Shaking the hat…</p>
			<p class="mt-1 text-sm text-fg-muted">Everyone gets one person. Nobody gets themselves.</p>
		</div>
	</div>
{/if}
