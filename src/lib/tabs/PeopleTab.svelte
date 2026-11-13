<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import { countdownLabel, formatDate, formatPrice } from '#lib/format.ts';
	import type { TabForm } from './types.ts';
	import type { PeopleData } from '#lib/server/tabs/people.ts';

	/** One of the three tabs; the shell around it is in routes/[[tab=tab]]. */
	let { data, form, me = null }: { data: PeopleData; form: TabForm; me?: { id: string; name: string } | null } = $props();

	let newCircle = $state(false);
	let newSanta = $state(false);
	let copied = $state<string | null>(null);
	async function copyInvite(token: string) {
		await navigator.clipboard.writeText(`${page.url.origin}/circles/join/${token}`);
		copied = token;
		setTimeout(() => (copied = null), 1800);
	}
</script>

<section class="mb-8">
	<h1 class="display text-[40px] leading-[1.05]">People</h1>
	<p class="mt-3 max-w-lg text-fg-muted">The people you buy for: your circles, what’s coming up for them, and what you’re getting.</p>
</section>

{#if !data.authEnabled}
	<div class="card p-6 text-center">
		<div class="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-cocoa-950 text-teal-300"><Icon name="people" size={30} /></div>
		<h2 class="display text-2xl">Coming with sign-in</h2>
		<p class="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Circles, Secret Santa and “gifts I’m getting” need everyone to have their own account. They switch on as soon as Google sign-in is set up.</p>
	</div>
{:else}
	<!-- Gifts I'm getting -->
	<a href="/getting" class="card mb-8 flex items-center gap-4 p-4 transition active:translate-y-0.5">
		<span class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-teal-600 text-cream"><Icon name="gift" size={24} /></span>
		<span class="flex-1">
			<span class="block font-bold">Gifts I’m getting</span>
			<span class="text-sm text-fg-muted">
				{#if data.getting.count}{data.getting.count} claimed{#if data.getting.todo} · <span class="font-bold text-rust-300">{data.getting.todo} still to buy</span>{:else} · all bought{/if}{:else}Nothing yet. Claim a gift on someone’s list and it shows up here.{/if}
			</span>
		</span>
		<Icon name="chevron-right" size={20} />
	</a>

	<!-- Coming up for your people -->
	{#if data.upcoming.length}
		<section class="mb-10">
			<h2 class="mb-3 text-lg font-bold">Coming up</h2>
			<div class="space-y-2.5">
				{#each data.upcoming.slice(0, 12) as u, i (u.personId + u.label + u.date)}
					<a href={u.listId ? `/people/${u.personId}?list=${u.listId}` : `/people/${u.personId}`} class="card rise flex items-center gap-3 p-3 pr-4 transition active:translate-y-0.5" style="--i: {i}">
						<Avatar name={u.kid ?? u.name} src={u.kid ? null : u.avatar_url} size={44} />
						<div class="min-w-0 flex-1">
							<p class="truncate font-bold">{u.kid ? `${u.kid} (${u.name.split(' ')[0]}’s)` : u.name}</p>
							<p class="truncate text-sm text-fg-muted">{u.label} · {formatDate(u.date)}</p>
						</div>
						<GiftTag tone={u.days <= 14 ? 'rust' : 'cream'} tilt={3}>{countdownLabel(u.date)}</GiftTag>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Circles -->
	<section class="mb-10">
		<div class="mb-3 flex items-baseline justify-between">
			<h2 class="text-lg font-bold">Circles</h2>
			<button class="text-sm font-bold text-teal-300 hover:underline" onclick={() => (newCircle = true)}>+ New circle</button>
		</div>
		{#if data.circles.length === 0}
			<div class="rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 p-5 text-sm text-fg-muted">
				Make a circle for your family or friends, then send them the invite link. Everyone in it can see each other’s wish lists and upcoming birthdays.
				<button class="mt-3 block font-bold text-teal-300 hover:underline" onclick={() => (newCircle = true)}>Make a circle</button>
			</div>
		{:else}
			<div class="grid gap-3 md:grid-cols-2">
				{#each data.circles as c (c.id)}
					<div class="card p-4">
						<div class="flex items-center justify-between gap-2">
							<h3 class="display text-xl">{c.name}</h3>
							<span class="text-xs font-bold text-fg-faint">{c.members.length} {c.members.length === 1 ? 'person' : 'people'}</span>
						</div>
						<div class="mt-3 flex flex-wrap gap-2">
							{#each c.members as m (m.id)}
								{#if m.id === me?.id}
									<span class="chip pr-3.5 pl-1"><Avatar name={m.name} src={m.avatar_url} size={26} />You</span>
								{:else}
									<a href="/people/{m.id}" class="chip pr-3.5 pl-1 hover:text-fg"><Avatar name={m.name} src={m.avatar_url} size={26} />{m.name.split(' ')[0]}</a>
								{/if}
							{/each}
						</div>
						<div class="mt-4 flex items-center justify-between gap-2">
							<button class="btn-teal text-sm" onclick={() => copyInvite(c.invite_token)}><Icon name={copied === c.invite_token ? 'check' : 'link'} size={16} />{copied === c.invite_token ? 'Invite copied' : 'Copy invite link'}</button>
							<form method="POST" action="?/leaveCircle" use:enhance>
								<input type="hidden" name="id" value={c.id} />
								<button class="btn-quiet text-sm hover:text-rust-300">Leave</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Secret Santa -->
	<section class="mb-6">
		<div class="mb-3 flex items-baseline justify-between">
			<h2 class="text-lg font-bold">Secret Santa</h2>
			<button class="text-sm font-bold text-mustard-400 hover:underline" onclick={() => (newSanta = true)}>+ Start one</button>
		</div>
		{#if data.exchanges.length === 0}
			<div class="rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 p-5 text-sm text-fg-muted">
				Start a gift exchange, invite everyone, then draw names. Each person only sees who they’re buying for, and gets their wish list.
				<button class="mt-3 block font-bold text-mustard-400 hover:underline" onclick={() => (newSanta = true)}>Start a Secret Santa</button>
			</div>
		{:else}
			<div class="grid gap-3 md:grid-cols-2">
				{#each data.exchanges as x (x.id)}
					<a href="/santa/{x.id}" class="card flex items-center gap-3 p-4 transition active:translate-y-0.5">
						<span class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-rust-500 text-cream"><Icon name="shuffle" size={22} /></span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-bold">{x.name}</span>
							<span class="text-sm text-fg-muted">{x.member_count} in{#if x.budget_cents} · {formatPrice(x.budget_cents, x.currency)} budget{/if}{#if x.exchange_date} · {formatDate(x.exchange_date)}{/if}</span>
						</span>
						{#if x.drawn_at}<span class="pill text-teal-300">Names drawn</span>{:else}<span class="pill">Open</span>{/if}
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<Modal bind:open={newCircle} title="New circle">
		<form id="circle-form" method="POST" action="?/createCircle" use:enhance={() => async ({ update, result }) => { await update(); if (result.type === 'success') newCircle = false; }}>
			<label class="block">
				<span class="label">Name</span>
				<input class="field" name="name" required maxlength="50" placeholder="e.g. The Garcias, Work friends" />
			</label>
			<p class="mt-3 text-sm text-fg-muted">You’ll get an invite link to send. Anyone who joins can see the others’ wish lists.</p>
			{#if form?.circleError}<p class="mt-3 text-sm font-bold text-rust-300">{form.circleError}</p>{/if}
		</form>
		{#snippet footer()}
			<div class="flex justify-end gap-2">
				<button type="button" class="btn-quiet" onclick={() => (newCircle = false)}>Cancel</button>
				<button form="circle-form" class="btn-teal">Make circle</button>
			</div>
		{/snippet}
	</Modal>

	<Modal bind:open={newSanta} title="Start a Secret Santa">
		<form id="santa-form" method="POST" action="?/createExchange" class="space-y-5" use:enhance>
			<label class="block"><span class="label">Name</span><input class="field" name="name" maxlength="60" placeholder="Family Secret Santa 2026" /></label>
			<div class="grid grid-cols-2 gap-3">
				<label class="block"><span class="label">Budget</span><input class="field" name="budget" inputmode="decimal" placeholder="$30" /></label>
				<label class="block"><span class="label">Exchange date</span><input class="field" type="date" name="date" /></label>
			</div>
			<p class="text-sm text-fg-muted">Next you’ll get an invite link. When everyone’s in, draw names: each person sees only who they’re buying for.</p>
		</form>
		{#snippet footer()}
			<div class="flex justify-end gap-2">
				<button type="button" class="btn-quiet" onclick={() => (newSanta = false)}>Cancel</button>
				<button form="santa-form" class="btn-primary">Start</button>
			</div>
		{/snippet}
	</Modal>
{/if}
