<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Modal from '#lib/components/Modal.svelte';
	import ListForm from '#lib/components/ListForm.svelte';
	import Present from '#lib/components/Present.svelte';
	import ListCard from '#lib/components/ListCard.svelte';
	import EverythingCard from '#lib/components/EverythingCard.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PasteBar from '#lib/components/PasteBar.svelte';
	import CountUp from '#lib/components/CountUp.svelte';
	import { countdownLabel, formatDate, milestone, daysUntil } from '#lib/format.ts';
	import type { TabForm } from './types.ts';
	import type { ListsData } from '#lib/server/tabs/lists.ts';

	/** One of the three tabs; the shell around it is in routes/[[tab=tab]]. */
	let { data, form, me = null }: { data: ListsData; form: TabForm; me?: { id: string; name: string } | null } = $props();

	// New list: for you, or for one of your kids.
	let creating = $state(false);
	// Who the new list is for: 'me', one of the kids (their id), or 'new-kid' to add a kid.
	let creatingFor = $state<string>('me');
	let busy = $state(false);
	function newList(kidId: string | null = null) {
		creatingFor = kidId ?? 'me';
		creating = true;
	}


	// Share an Everything list (yours, or a kid's).
	let sharing = $state<{ id: string; token: string | null; who: string } | null>(null);
	let shareOpen = $state(false);
	let copied = $state(false);
	const shareUrl = $derived(sharing?.token ? `${page.url.origin}/s/${sharing.token}` : null);
	function openShare(id: string, token: string | null, who: string) {
		sharing = { id, token, who };
		shareOpen = true;
	}
	// Keep the open share sheet in step with fresh data after creating or stopping a link.
	$effect(() => {
		if (!sharing) return;
		const all = [data.everything, ...data.kids.map((k) => k.everything)];
		const fresh = all.find((e) => e.id === sharing!.id);
		if (fresh && fresh.share_token !== sharing.token) sharing = { ...sharing, token: fresh.share_token };
	});
	async function copy() {
		if (!shareUrl) return;
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 1800);
	}

	const next = $derived(data.next);
	const nextKid = $derived(data.kids.find((k) => k.lists.some((l) => l.id === data.nextId))?.kid.name ?? null);
	const gifts = (n: number) => `${n} ${n === 1 ? 'gift' : 'gifts'}`;
</script>

<section class="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
	<div>
		<p class="mb-1 text-[15px] font-bold text-mustard-400">Hey{data.everything.item_count ? ' again' : ''}{me?.name && me.name !== 'You' ? `, ${me.name.split(' ')[0]}` : ''}!</p>
		<h1 class="display text-[40px] leading-[1.05] text-fg sm:text-5xl">Your wish lists</h1>
	</div>
	<div class="flex gap-2 self-start sm:self-auto">
		<button class="btn-primary" onclick={() => newList()}>
			<Icon name="plus" size={18} />
			New list
		</button>
		<button class="btn-teal" onclick={() => openShare(data.everything.id, data.everything.share_token, 'your')} title="Share your whole wish list (Everything)">
			<Icon name={data.everything.share_token ? 'check' : 'share'} size={18} />
			{data.everything.share_token ? 'Sharing all' : 'Share all'}
		</button>
	</div>
</section>

<!-- Bigger screens: the paste bar sits here. Phones get it docked above the tab bar (the shell). -->
<PasteBar class="mb-6 hidden sm:flex" />

<EverythingCard id={data.everything.id} count={data.everything.item_count} wrap={data.everything.wrap} />

{#each data.reminders as r (r.id)}
	<a href="/lists/{r.id}" class="rise mt-4 flex items-center gap-3 rounded-[var(--radius-card)] bg-rust-500/15 px-4 py-3 text-sm text-rust-300 transition hover:bg-rust-500/20">
		<Icon name="calendar" size={20} />
		<span class="flex-1">
			<span class="font-bold">{r.kid ? `${r.kid}’s ${r.name}` : r.name}</span> is {r.days === 0 ? 'today' : r.days === 1 ? 'tomorrow' : `in ${r.days} days`} and
			{r.count === 0 ? 'has no gifts yet' : `only has ${gifts(r.count)}`}. Add a few so people have choices.
		</span>
		<Icon name="chevron-right" size={18} />
	</a>
{/each}

{#if data.friends.length}
	<section class="mt-8">
		<h2 class="mb-3 flex items-center justify-between text-lg font-bold">Coming up for your people <a href="/people" class="text-sm text-teal-300 hover:underline">See all</a></h2>
		<div class="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 no-scrollbar" data-no-swipe>
			{#each data.friends.slice(0, 8) as f, i (f.personId + f.label + f.date)}
				<a href={f.listId ? `/people/${f.personId}?list=${f.listId}` : `/people/${f.personId}`} class="card rise flex w-56 shrink-0 items-center gap-3 p-3 transition active:translate-y-0.5" style="--i: {i}">
					<Avatar name={f.name} src={f.avatar_url} size={44} />
					<div class="min-w-0">
						<p class="truncate text-sm font-bold">{f.kid ? f.kid : f.name.split(' ')[0]}</p>
						<p class="truncate text-xs text-fg-muted">{f.label}</p>
						<p class="text-xs font-bold text-rust-300">{countdownLabel(f.date)}</p>
					</div>
				</a>
			{/each}
		</div>
	</section>
{/if}

{#if next}
	{@const days = daysUntil(next.next_date) ?? 0}
	{@const turning = milestone(next.occasion, next.occasion_date)}
	<a href="/lists/{next.id}" class="card group rise mt-8 flex overflow-hidden transition active:translate-y-0.5">
		<Present wrap={next.wrap} occasion={next.occasion} ribbonAt={50} class="w-[30%] shrink-0 rounded-l-[var(--radius-card)] sm:w-64" />
		<div class="flex min-w-0 flex-1 items-center justify-between gap-3 py-4 pr-3.5 pl-4 sm:p-6">
			<div class="min-w-0">
				<p class="text-xs font-bold tracking-wider text-rust-300 uppercase">Next up{nextKid ? ` · ${nextKid}` : ''}</p>
				<h2 class="display mt-1 line-clamp-2 text-[22px] leading-tight break-words sm:text-3xl">{next.name}</h2>
				<p class="mt-1 text-sm text-fg-muted">{gifts(next.item_count)} · {formatDate(next.next_date)}{#if turning}<span class="font-bold text-rust-300"> · {turning}</span>{/if}</p>
			</div>
			<div class="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-cocoa-950 text-center sm:h-24 sm:w-24">
				<div>
					<div class="display text-[28px] leading-none text-mustard-400 sm:text-4xl"><CountUp value={days} /></div>
					<div class="text-[11px] font-bold text-fg-muted">{days === 1 ? 'day' : 'days'}</div>
				</div>
			</div>
		</div>
	</a>
	<a href="/upcoming" class="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-fg-faint hover:text-fg"><Icon name="calendar" size={16} />See everything coming up<Icon name="chevron-right" size={16} /></a>
{/if}

<section class="mt-9">
	<div class="mb-3 flex items-baseline justify-between">
		<h2 class="text-lg font-bold">Lists</h2>
	</div>
	<div class="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
		{#each data.lists as list, i (list.id)}<ListCard {list} index={i} />{:else}
		<button class="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 text-sm font-bold text-fg-muted transition hover:border-mustard-400 hover:text-mustard-400" onclick={() => newList()}>
			<Icon name="plus" size={22} />New list
		</button>
		{/each}
	</div>
</section>

{#each data.kids as section (section.kid.id)}
	<section class="mt-12">
		<div class="mb-3 flex items-center justify-between gap-3">
			<h2 class="display flex items-center gap-2.5 text-[28px]"><Avatar name={section.kid.name} size={36} />{section.kid.name}</h2>
			<button class="btn-ghost px-3 text-sm" onclick={() => openShare(section.everything.id, section.everything.share_token, `${section.kid.name}’s`)}>
				<Icon name={section.everything.share_token ? 'check' : 'share'} size={16} />{section.everything.share_token ? 'Shared' : 'Share'}
			</button>
		</div>
		<EverythingCard id={section.everything.id} count={section.everything.item_count} wrap={section.everything.wrap} title="{section.kid.name}’s wish list" subtitle="What {section.kid.name} would love, picked by you" compact />
		<div class="mt-4 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
			{#each section.lists as list, i (list.id)}<ListCard {list} index={i} />{/each}
			<button class="flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 text-sm font-bold text-fg-muted transition hover:border-mustard-400 hover:text-mustard-400" onclick={() => newList(section.kid.id)}>
				<Icon name="plus" size={22} />List for {section.kid.name}
			</button>
		</div>
	</section>
{/each}



<Modal bind:open={creating} title={creatingFor === 'new-kid' ? 'Add a kid’s wish list' : creatingFor === 'me' ? 'New list' : `New list for ${data.kids.find((k) => k.kid.id === creatingFor)?.kid.name}`}>
	<div class="mb-6">
		<span class="label">Who’s it for?</span>
		<div class="flex flex-wrap gap-2">
			<button type="button" class="chip {creatingFor === 'me' ? 'chip-on' : 'hover:text-fg'}" aria-pressed={creatingFor === 'me'} onclick={() => (creatingFor = 'me')}><Icon name="user" size={15} />Me</button>
			{#each data.kids as k (k.kid.id)}
				<button type="button" class="chip {creatingFor === k.kid.id ? 'chip-on' : 'hover:text-fg'}" aria-pressed={creatingFor === k.kid.id} onclick={() => (creatingFor = k.kid.id)}><Icon name="teddy" size={15} />{k.kid.name}</button>
			{/each}
			<button type="button" class="chip {creatingFor === 'new-kid' ? 'chip-on' : 'bg-transparent ring-2 ring-cocoa-700 ring-inset hover:text-fg'}" aria-pressed={creatingFor === 'new-kid'} onclick={() => (creatingFor = 'new-kid')}><Icon name="plus" size={15} />A kid</button>
		</div>
	</div>

	{#if creatingFor === 'new-kid'}
		<form id="new-list" method="POST" action="?/addKid" use:enhance={() => { busy = true; return async ({ update }) => { await update(); busy = false; }; }} class="space-y-5">
			<p class="text-sm text-fg-muted">Keep a wish list for a child: you pick what goes on it, and it’s clearly labelled with their name when you share it.</p>
			<label class="block">
				<span class="label">Their name</span>
				<input class="field" name="name" required maxlength="40" placeholder="e.g. Maya" />
			</label>
			<label class="block">
				<span class="label">Birthday <span class="normal-case text-fg-faint">(optional)</span></span>
				<input class="field sm:max-w-56" type="date" name="birthday" />
				<span class="mt-1.5 block text-xs text-fg-faint">Adds a birthday list that counts down to their next birthday every year.</span>
			</label>
			{#if form?.kidError}<p class="text-sm font-bold text-rust-300">{form.kidError}</p>{/if}
		</form>
	{:else}
		<form
			id="new-list"
			method="POST"
			action="?/create"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update();
					busy = false;
				};
			}}
		>
			<input type="hidden" name="kid_id" value={creatingFor === 'me' ? '' : creatingFor} />
			<ListForm />
			{#if form?.error}<p class="mt-4 text-sm font-bold text-rust-300">{form.error}</p>{/if}
		</form>
	{/if}
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-quiet" onclick={() => (creating = false)}>Cancel</button>
			<button form="new-list" class="btn-primary" disabled={busy}>{busy ? 'Wrapping…' : creatingFor === 'new-kid' ? 'Add kid' : 'Make list'}</button>
		</div>
	{/snippet}
</Modal>

<Modal bind:open={shareOpen} title="Share {sharing?.who ?? 'your'} whole wish list">
	{#if sharing}
		{#if shareUrl}
			<p class="mb-4 text-sm text-fg-muted">This link shows <span class="font-bold text-fg">every gift</span> on {sharing.who} wish list (Everything) as one list. Anyone with it can mark a gift as theirs, and it’s crossed off everywhere so nobody doubles up. To share just one list, like Christmas, open it and tap Share there.</p>
			<div class="flex gap-2">
				<input class="field font-mono text-xs" readonly value={shareUrl} onfocus={(e) => e.currentTarget.select()} />
				<button class="btn-teal shrink-0" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
			</div>
			<div class="mt-6 flex items-center justify-between">
				<a href={shareUrl} target="_blank" rel="noopener" class="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-teal-300 hover:underline">See what givers see <Icon name="external" size={15} /></a>
				<form method="POST" action="?/unshareAll" use:enhance={() => async ({ update }) => { await update(); shareOpen = false; }}>
					<input type="hidden" name="list" value={sharing.id} />
					<button class="btn-quiet hover:text-rust-300">Stop sharing</button>
				</form>
			</div>
		{:else}
			<p class="mb-6 text-sm text-fg-muted">Make one private link that shows <span class="font-bold text-fg">every gift</span> on {sharing.who} wish list (Everything) as one list. New gifts show up on it automatically. To share just one list, like Christmas, open it and tap Share there.</p>
			<form method="POST" action="?/shareAll" use:enhance={() => async ({ update }) => update({ reset: false })}>
				<input type="hidden" name="list" value={sharing.id} />
				<button class="btn-teal w-full">Create link</button>
			</form>
		{/if}
	{/if}
</Modal>
