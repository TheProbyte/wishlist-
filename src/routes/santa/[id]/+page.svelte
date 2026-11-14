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
	let revealed = $state(false);
	let fire = $state(0);
	let firstUnfold = true;
	function unfold() {
		revealed = true;
		if (firstUnfold) fire++;
		firstUnfold = false;
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
				<div class="relative mx-auto w-fit">
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
			<div class="slip-unfold mx-auto max-w-xs rounded-[10px] border-[3px] border-cocoa-950 bg-cream px-6 pt-5 pb-6 text-cocoa-950 shadow-[0_4px_0_0_var(--color-edge)]">
				<!-- the fold line across the middle of the paper -->
				<div class="relative">
					<p class="text-xs font-bold tracking-widest text-rust-500 uppercase">You’re Secret Santa for</p>
					<div class="stamp mx-auto mt-3 w-fit"><Avatar name={data.recipient.name} src={data.recipient.avatar_url} size={84} /></div>
					<h2 class="display mt-2 text-[32px] leading-tight">{data.recipient.name}</h2>
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
	</div>
	<div class="flex flex-wrap gap-2">
		{#each data.members as m (m.id)}
			<span class="chip pr-2 pl-1">
				<Avatar name={m.name} src={m.avatar_url} size={28} />{m.id === data.me?.id ? 'You' : m.name.split(' ')[0]}
				{#if data.isOrganiser && !data.exchange.drawn && m.id !== data.me?.id}
					<form method="POST" action="?/remove" use:enhance class="inline-flex">
						<input type="hidden" name="user" value={m.id} />
						<button class="grid h-6 w-6 place-items-center rounded-full hover:bg-cocoa-700 hover:text-rust-300" aria-label="Remove {m.name}"><Icon name="close" size={14} /></button>
					</form>
				{/if}
			</span>
		{/each}
	</div>
</section>

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
