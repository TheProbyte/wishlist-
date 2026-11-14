<script lang="ts">
	import { paperFor } from '#lib/papers.ts';
	import EmptyArt from '#lib/components/EmptyArt.svelte';
	import { enhance, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { shell } from '#lib/shell.svelte.ts';
	import { contextMenu, type MenuSpec } from '#lib/menu.svelte.ts';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import { countdownLabel, formatDate, formatPrice, withKid } from '#lib/format.ts';
	import type { TabForm } from './types.ts';
	import type { PeopleData } from '#lib/server/tabs/people.ts';

	/** One of the three tabs; the shell around it is in routes/[[tab=tab]]. */
	let { data, form, me = null }: { data: PeopleData; form: TabForm; me?: { id: string; name: string } | null } = $props();

	// "Coming up" lists only what the person cards above don't already show (each card carries
	// that person's next occasion), so nothing appears twice.
	const key = (u: { personId: string; label: string; date: string; kid: string | null }) => `${u.personId}|${u.kid ?? ''}|${u.label}|${u.date}`;
	const later = $derived.by(() => {
		if (!data.authEnabled) return [];
		const onCards = new Set(data.people.flatMap((p) => (p.next ? [key(p.next)] : [])));
		return data.upcoming.filter((u) => !onCards.has(key(u)));
	});

	let newCircle = $state(false);
	let newSanta = $state(false);
	// Asked for from the tab bar's hold menu.
	$effect(() => {
		const r = shell.request;
		if (r !== 'new-circle' && r !== 'new-santa') return;
		shell.request = null;
		untrack(() => (r === 'new-circle' ? (newCircle = true) : (newSanta = true)));
	});

	/* Hold (or right-click) a person or a circle for its options. */
	type Person = NonNullable<PeopleData['people']>[number];
	type Circle = NonNullable<PeopleData['circles']>[number];
	function personMenu(p: Person): MenuSpec {
		return {
			title: p.name,
			sub: p.circles.join(' · '),
			items: [
				{ label: 'Wish lists', icon: 'gift', href: `/people/${p.id}`, hint: p.gift_count ? String(p.gift_count) : undefined },
				...(p.next?.listId ? [{ label: `${p.next.label} list`, icon: 'calendar', href: `/people/${p.id}?list=${p.next.listId}` }] : []),
				{ label: 'Gifts I’m getting', icon: 'check', href: '/getting' }
			]
		};
	}
	let leaving = $state<string[]>([]);
	async function leave(id: string) {
		leaving = [...leaving, id];
		const fd = new FormData();
		fd.set('id', id);
		const res = await fetch('/people?/leaveCircle', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
		if (deserialize(await res.text()).type !== 'success') leaving = leaving.filter((x) => x !== id);
		await invalidateAll();
	}
	function circleMenu(c: Circle): MenuSpec {
		return {
			title: c.name,
			sub: `${c.members.length} ${c.members.length === 1 ? 'person' : 'people'}`,
			items: [
				{ label: copied === c.invite_token ? 'Invite link copied' : 'Copy invite link', icon: 'link', run: () => copyInvite(c.invite_token) },
				'divider',
				{ label: 'Leave circle', icon: 'close', danger: true, confirm: 'Tap again to leave', run: () => leave(c.id) }
			]
		};
	}
	let copied = $state<string | null>(null);
	async function copyInvite(token: string) {
		await navigator.clipboard.writeText(`${page.url.origin}/circles/join/${token}`);
		copied = token;
		setTimeout(() => (copied = null), 1800);
	}
</script>

<section class="mb-6">
	<h1 class="display accent-bar text-[40px] leading-[1.05]">People</h1>
	<p class="mt-2 max-w-lg text-fg-muted">Everyone in your circles. Tap someone to see their wish lists and pick a gift.</p>
</section>

{#if !data.authEnabled}
	<div class="card p-6 text-center">
		<div class="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-cocoa-950 text-teal-300"><Icon name="people" size={30} /></div>
		<h2 class="display text-2xl">Coming with sign-in</h2>
		<p class="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Circles, Secret Santa and “gifts I’m getting” need everyone to have their own account. They switch on as soon as Google sign-in is set up.</p>
	</div>
{:else}
	<!-- Your people: the main thing this page is for. -->
	<section class="mb-8">
		{#if data.people.length}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{#each data.people as person, i (person.id)}
					<!-- Each person is a gift tag on a string: "To: Sam". -->
					<a href="/people/{person.id}" use:contextMenu={{ spec: () => personMenu(person) }} class="group rise relative block pt-5 transition active:translate-y-0.5" style="--i: {i}">
						<svg class="absolute top-0 left-1/2 -translate-x-1/2 transition-transform duration-300 group-hover:rotate-6" width="34" height="30" viewBox="0 0 34 30" aria-hidden="true">
							<path d="M17 28C9 22 4 12 9 6s14-3 12 4" fill="none" stroke="var(--color-cream)" stroke-width="2" stroke-linecap="round" opacity="0.7" />
						</svg>
						<div data-lift class="relative origin-top transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-rotate-2">
						<!-- The tag's shadow: the same shape a little lower, as a plain layer. (A shadow filter over
						     the whole tag is slow for iPhones to paint, and could leave a tag blank for a while.) -->
						<span class="tag-shape absolute inset-0 translate-y-[3px] bg-[var(--color-edge)]" aria-hidden="true"></span>
						<div class="tag-shape paper-grain relative isolate flex flex-col items-center gap-1.5 overflow-hidden bg-cocoa-850 px-3 pt-8 pb-4 text-center">
							{#if person.paper}<span class="absolute inset-x-0 top-0 h-14 opacity-90" style="background: {paperFor(person.paper).background}" aria-hidden="true"></span>{/if}
							<span class="absolute top-3 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-cocoa-950 ring-3 ring-[var(--accent)]/60"></span>
							<Avatar name={person.name} src={person.avatar_url} sticker={person.sticker} size={58} />
							<span class="w-full truncate"><span class="mr-1 text-xs font-bold text-fg-faint">To:</span><span class="display text-[20px]">{person.name.split(' ')[0]}</span></span>
							<span class="-mt-1 w-full truncate text-xs text-fg-faint">{person.circles.join(' · ')}</span>
							{#if person.next}
								<span class="pill max-w-full bg-rust-500/20 text-rust-300"><span class="truncate">{withKid(person.next.kid, person.next.label)} {countdownLabel(person.next.date)}</span></span>
							{/if}
							<span class="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-bold text-[var(--accent-text)]">
								{person.gift_count ? `${person.gift_count} ${person.gift_count === 1 ? 'gift' : 'gifts'}` : 'Wish lists'}<Icon name="chevron-right" size={16} />
							</span>
						</div>
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<div class="card p-5 text-center">
				<EmptyArt kind="chairs" class="mx-auto mb-3" />
				<p class="font-bold">No one here yet</p>
				<p class="mt-1 text-sm text-fg-muted">
					{data.circles.length ? 'Your circle is just you so far. Send the invite link below to family or friends; once they join, they show up here.' : 'Make a circle for your family or friends and send them the invite link. Once they join, they show up here and you can see each other’s wish lists.'}
				</p>
				{#if !data.circles.length}<button class="btn-teal mt-4" onclick={() => (newCircle = true)}><Icon name="plus" size={16} />Make a circle</button>{/if}
			</div>
		{/if}
	</section>

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
	{#if later.length}
		<section class="mb-10">
			<h2 class="mb-3 text-lg font-bold">Also coming up</h2>
			<div class="grid gap-2.5 md:grid-cols-2">
				{#each later.slice(0, 6) as u, i (u.personId + u.label + u.date)}
					<a href={u.listId ? `/people/${u.personId}?list=${u.listId}` : `/people/${u.personId}`} class="card rise flex items-center gap-3 p-3 pr-4 transition active:translate-y-0.5" style="--i: {i}">
						<Avatar name={u.kid ?? u.name} src={u.kid ? null : u.avatar_url} sticker={u.kid ? null : u.sticker} size={44} />
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
		<div class="mb-1 flex items-baseline justify-between">
			<h2 class="text-lg font-bold">Your circles</h2>
			<button class="text-sm font-bold text-teal-300 hover:underline" onclick={() => (newCircle = true)}>+ New circle</button>
		</div>
		<p class="mb-3 text-sm text-fg-muted">
			{#if data.circles.length}You’re in {data.circles.length} {data.circles.length === 1 ? 'circle' : 'circles'}. {/if}Everyone in a circle can see each other’s wish lists and birthdays. To add someone, send them the circle’s invite link; they sign in with Google and they’re in.
		</p>
		{#if data.circles.length === 0}
			<button class="flex w-full flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 py-8 text-sm font-bold text-fg-muted transition hover:border-teal-300 hover:text-teal-300" onclick={() => (newCircle = true)}>
				<Icon name="people" size={24} />Make your first circle
			</button>
		{:else}
			<div class="grid gap-3 md:grid-cols-2">
				{#each data.circles.filter((c) => !leaving.includes(c.id)) as c (c.id)}
					{@const others = c.members.filter((m) => m.id !== me?.id)}
					<div class="card p-4" use:contextMenu={{ spec: () => circleMenu(c) }}>
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<h3 class="display truncate text-xl">{c.name}</h3>
								<p class="text-xs font-bold text-fg-faint">{c.owner_id === me?.id ? 'You made this' : 'You joined'} · {c.members.length} {c.members.length === 1 ? 'person' : 'people'}</p>
							</div>
							<!-- Everyone's faces, overlapping -->
							<div class="flex shrink-0 -space-x-2.5">
								{#each c.members.slice(0, 5) as m (m.id)}<span class="rounded-full ring-3 ring-cocoa-850"><Avatar name={m.name} src={m.avatar_url} sticker={m.sticker} size={30} /></span>{/each}
								{#if c.members.length > 5}<span class="grid h-[30px] min-w-[30px] place-items-center rounded-full bg-cocoa-800 px-1 text-xs font-bold ring-3 ring-cocoa-850">+{c.members.length - 5}</span>{/if}
							</div>
						</div>
						{#if others.length}
							<div class="mt-3 flex flex-wrap gap-1.5">
								{#each others as m (m.id)}
									<a href="/people/{m.id}" class="chip pr-3 pl-1 hover:text-fg"><Avatar name={m.name} src={m.avatar_url} sticker={m.sticker} size={26} />{m.name.split(' ')[0]}<Icon name="chevron-right" size={14} /></a>
								{/each}
							</div>
						{:else}
							<p class="mt-3 text-sm text-fg-muted">Just you so far. Send the invite link to get people in.</p>
						{/if}
						<div class="mt-4 flex items-center justify-between gap-2">
							<button class="btn-teal text-sm" onclick={() => copyInvite(c.invite_token)}><Icon name={copied === c.invite_token ? 'check' : 'link'} size={16} />{copied === c.invite_token ? 'Invite link copied' : 'Copy invite link'}</button>
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
