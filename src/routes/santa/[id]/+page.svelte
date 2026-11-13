<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Present from '#lib/components/Present.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import Confetti from '#lib/components/Confetti.svelte';
	import { countdownLabel, formatDate, formatPrice } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const invite = $derived(`${page.url.origin}/santa/join/${data.exchange.invite_token}`);
	let copied = $state(false);
	async function copy() {
		await navigator.clipboard.writeText(invite);
		copied = true;
		setTimeout(() => (copied = false), 1800);
	}
	// The big reveal: tap the present to see who you got.
	let revealed = $state(false);
	let fire = $state(0);
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
	<!-- Your match, revealed with a tap. -->
	<div class="card relative mb-8 overflow-hidden">
		{#if !revealed}
			<button class="block w-full text-left" onclick={() => { revealed = true; fire++; }}>
				<Present occasion="christmas" ribbonAt={50} class="h-52 rounded-t-[var(--radius-card)]" />
				<p class="p-5 text-center font-bold">Tap the present to see who you’re buying for</p>
			</button>
		{:else}
			<div class="relative p-6 text-center">
				<Confetti {fire} />
				<p class="text-sm font-bold text-teal-300">You’re Secret Santa for</p>
				<div class="stamp mx-auto mt-3 w-fit"><Avatar name={data.recipient.name} src={data.recipient.avatar_url} size={88} /></div>
				<h2 class="display mt-3 text-[34px] leading-tight">{data.recipient.name}</h2>
				<p class="mt-1 text-sm text-fg-muted">Shh! Only you can see this.</p>
				<a href="/people/{data.recipient.id}" class="btn-teal mt-5">See their wish list <Icon name="chevron-right" size={18} /></a>
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
			<form method="POST" action="?/draw" use:enhance>
				<button class="btn-primary w-full" disabled={data.members.length < 3}><Icon name="shuffle" size={18} />Draw names</button>
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

{#if form?.error}<p class="mb-6 text-center text-sm font-bold text-rust-300">{form.error}</p>{/if}

<form method="POST" action="?/leave" use:enhance class="text-center">
	<button class="btn-quiet text-sm hover:text-rust-300">{data.isOrganiser ? 'Cancel this Secret Santa' : 'Leave'}</button>
</form>
