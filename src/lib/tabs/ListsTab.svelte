<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { dur } from '#lib/motion.ts';
	import { PAPERS } from '#lib/papers.ts';
	import { shell } from '#lib/shell.svelte.ts';
	import type { MenuItem } from '#lib/menu.svelte.ts';
	import { undoable, isHidden } from '#lib/undo.svelte.ts';
	import Modal from '#lib/components/Modal.svelte';
	import ListForm from '#lib/components/ListForm.svelte';
	import Present from '#lib/components/Present.svelte';
	import ShelfItem from '#lib/components/ShelfItem.svelte';
	import Countdown from '#lib/components/Countdown.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PasteBar from '#lib/components/PasteBar.svelte';
	import { countdownLabel, formatDate, milestone, daysUntil, occasionMeta, withKid } from '#lib/format.ts';
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

	// Asked for from the tab bar's hold menu.
	$effect(() => {
		const r = shell.request;
		if (r !== 'new-list' && r !== 'share-all') return;
		shell.request = null;
		untrack(() => (r === 'new-list' ? newList() : openShare(data.everything.id, data.everything.share_token, 'your')));
	});

	/* A list's own menu on the shelf (hold it, or right-click): paper, sharing, settings, delete.
	   What you pick shows straight away; the server catches up behind. */
	let wraps = $state<Record<string, string>>({});
	const swatches = PAPERS.map((p) => ({ id: p.id, name: p.name, background: p.background }));
	async function act(listId: string, action: string, body: Record<string, string> = {}) {
		const fd = new FormData();
		for (const [k, v] of Object.entries(body)) fd.set(k, v);
		const res = await fetch(`/lists/${listId}?/${action}`, { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await res.text());
		await invalidateAll();
		return result.type === 'success' || result.type === 'redirect';
	}
	async function setWrap(id: string, wrap: string) {
		const before = wraps[id];
		wraps[id] = wrap;
		if (!(await act(id, 'setWrap', { wrap }))) {
			if (before) wraps[id] = before;
			else delete wraps[id];
		}
	}
	function removeList(id: string, name: string) {
		undoable({
			message: `Deleted “${name.length > 28 ? `${name.slice(0, 26).trimEnd()}…` : name}”`,
			requests: [{ url: `/lists/${id}?/deleteList`, body: {} }],
			keys: [`list:${id}`],
			revert: () => {},
			done: (ok) => ok && invalidateAll()
		});
	}
	function listMenu(id: string, wrap: string | null, share: (() => void) | null = null, name = ''): () => MenuItem[] {
		const everything = !!share;
		return () => [
			{ papers: swatches, current: wraps[id] ?? wrap, pick: (w: string) => setWrap(id, w) },
			'divider',
			{ label: everything ? 'Share all' : 'Share', icon: 'share', run: share ?? (() => goto(`/lists/${id}?open=share`)) },
			{ label: everything ? 'Wish list settings' : 'Name, date & more', icon: 'tag', href: `/lists/${id}?open=settings` },
			...(shelves.some((ls) => ls.length > 1) ? [{ label: 'Arrange shelf', icon: 'grip', run: startArranging }] : []),
			...(everything ? [] : [{ label: 'Delete list', icon: 'close', danger: true, run: () => removeList(id, name) }])
		];
	}
	const wrapOf = (id: string, wrap: string | null) => wraps[id] ?? wrap;

	/* Arranging the shelf by hand: presents jiggle, drag one to a new place (within its own
	   shelf), and the order is saved each time you let go. */
	let arranging = $state(false);
	let order = $state<string[] | null>(null);
	const shelves = $derived([data.lists, ...data.kids.map((k) => k.lists)]);
	function startArranging() {
		order = shelves.flat().map((l) => l.id);
		arranging = true;
	}
	function placed<T extends { id: string }>(lists: T[]): T[] {
		const o = order;
		return o ? [...lists].sort((a, b) => o.indexOf(a.id) - o.indexOf(b.id)) : lists;
	}
	function moveList(drag: string, over: string) {
		const shelf = shelves.find((ls) => ls.some((l) => l.id === drag));
		if (!order || !shelf?.some((l) => l.id === over)) return;
		const next = [...order];
		next.splice(next.indexOf(over), 0, next.splice(next.indexOf(drag), 1)[0]);
		order = next;
	}
	async function saveArrangement() {
		if (!order) return;
		const fd = new FormData();
		for (const id of order) fd.append('ids', id);
		await fetch('/?/arrangeLists', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
		await invalidateAll();
	}
	async function doneArranging() {
		arranging = false;
		await saveArrangement();
		order = null;
	}
	$effect(() => {
		shell.pasteHidden = arranging;
	});
	const arrangeFor = (id: string) => ({ id, on: arranging, onover: moveList, ondrop: saveArrangement });

	const next = $derived(data.next && !isHidden(`list:${data.next.id}`) ? data.next : null);
	const nextKid = $derived(data.kids.find((k) => k.lists.some((l) => l.id === data.nextId))?.kid.name ?? null);
	const gifts = (n: number) => `${n} ${n === 1 ? 'gift' : 'gifts'}`;

	/** The line under a list on the shelf: a countdown when it's close, else its date or kind. */
	function listSub(list: { occasion: string; next_date: string | null }): { sub: string; subClass: string } {
		const days = daysUntil(list.next_date);
		if (list.next_date && days != null && days >= 0 && days <= 60) return { sub: countdownLabel(list.next_date) ?? '', subClass: 'font-bold text-rust-300' };
		return { sub: list.next_date ? formatDate(list.next_date) : occasionMeta(list.occasion).label, subClass: '' };
	}
</script>

<!-- Top: who you are, and the two things you do here most. -->
<div class="mb-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
<section class="min-w-0">
	<p class="text-[15px] font-bold text-[var(--accent-text)]">Hey{data.everything.item_count ? ' again' : ''}{me?.name && me.name !== 'You' ? `, ${me.name.split(' ')[0]}` : ''}!</p>
	<h1 class="display accent-bar text-[34px] leading-[1.05] text-fg sm:text-5xl">Your wish lists</h1>
	<div class="mt-5 flex gap-2">
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
<!-- Next up: one slim strip on phones; on a computer it fills the space beside the title. -->
<div class="lg:w-[28rem] lg:shrink-0">
{#if next}
	{@const days = daysUntil(next.next_date) ?? 0}
	{@const turning = milestone(next.occasion, next.occasion_date)}
	<a href="/lists/{next.id}" class="card group rise flex items-center gap-3 p-2 pr-3 lg:p-3 lg:pr-4 transition active:translate-y-0.5">
		<Present wrap={next.wrap} occasion={next.occasion} ribbonAt={55} bow={false} class="h-12 w-14 shrink-0 rounded-[12px]" />
		<div class="min-w-0 flex-1">
			<p class="truncate text-[15px] font-bold"><span class="text-xs font-bold tracking-wider text-rust-300 uppercase">Next up{nextKid ? ` · ${nextKid}` : ''}</span> {next.name}</p>
			<p class="truncate text-[13px] text-fg-muted">{formatDate(next.next_date)} · {gifts(next.item_count)}{#if turning}<span class="font-bold text-rust-300"> · {turning}</span>{/if}</p>
		</div>
		<Countdown {days} id={next.id} />
	</a>
	<a href="/upcoming" class="mt-1 inline-flex min-h-10 items-center gap-1 text-[13px] font-bold text-fg-faint hover:text-fg"><Icon name="calendar" size={15} />See everything coming up<Icon name="chevron-right" size={15} /></a>
{/if}

</div>
</div>

<!-- Bigger screens: the paste bar sits here. Phones get it docked above the tab bar (the shell). -->
<PasteBar class="mb-6 hidden sm:flex" />

{#each data.reminders as r (r.id)}
	<a href="/lists/{r.id}" class="rise mb-3 flex items-center gap-3 rounded-[var(--radius-card)] bg-rust-500/15 px-4 py-3 text-sm text-rust-300 transition hover:bg-rust-500/20">
		<Icon name="calendar" size={20} />
		<span class="flex-1">
			<span class="font-bold">{withKid(r.kid, r.name)}</span> is {r.days === 0 ? 'today' : r.days === 1 ? 'tomorrow' : `in ${r.days} days`} and
			{r.count === 0 ? 'has no gifts yet' : `only has ${gifts(r.count)}`}. Add a few so people have choices.
		</span>
		<Icon name="chevron-right" size={18} />
	</a>
{/each}

{#if arranging}
	<!-- Arranging: a bar to finish, where the paste bar usually is. -->
	<div class="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[26rem]" transition:fly={{ y: 80, duration: dur(220), opacity: 1 }}>
		<div class="flex items-center gap-3 rounded-[var(--radius-card)] bg-cocoa-900 p-2 pl-4 shadow-[0_4px_0_0_var(--color-edge),0_16px_40px_-10px_rgb(0_0_0/0.7)] ring-2 ring-cocoa-700">
			<span class="flex-1 text-sm text-fg-muted">Hold a present and drag it into place.</span>
			<button class="btn-primary min-h-10 px-4 text-sm" onclick={doneArranging}>Done</button>
		</div>
	</div>
{/if}

<!-- The shelf: Everything first and biggest, then every list, standing on planks. -->
<section class="mt-6" aria-label="Your lists">
	<div class="shelf grid grid-cols-2 items-end gap-x-3.5 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
		<ShelfItem
			href="/lists/{data.everything.id}"
			wrap={wrapOf(data.everything.id, data.everything.wrap) ?? 'sunburst'}
			menu={listMenu(data.everything.id, data.everything.wrap ?? 'sunburst', () => openShare(data.everything.id, data.everything.share_token, 'your'))}
			occasion="general"
			title="Everything"
			sub="Every gift you’d love, in one list"
			count={data.everything.item_count}
			transitionName="paper-{data.everything.id}"
			big
		/>
		{#each placed(data.lists.filter((l) => !isHidden(`list:${l.id}`))) as list, i (list.id)}
			<div class="grid" animate:flip={{ duration: dur(220) }}>
			<ShelfItem arrange={arrangeFor(list.id)} href="/lists/{list.id}" wrap={wrapOf(list.id, list.wrap)} menu={listMenu(list.id, list.wrap, null, list.name)} occasion={list.occasion} title={list.name} {...listSub(list)} count={list.item_count} days={daysUntil(list.next_date)} transitionName="paper-{list.id}" index={i + 1} />
			</div>
		{:else}
			<p class="col-span-2 -mt-3 text-center text-sm text-fg-faint md:col-span-1 md:mt-0 md:pb-10 md:text-left">No lists yet</p>
		{/each}
	</div>
</section>

{#each data.kids as section (section.kid.id)}
	<section class="mt-12">
		<div class="mb-4 flex items-center justify-between gap-3">
			<h2 class="display flex min-w-0 items-center gap-2.5 text-[26px]"><Avatar name={section.kid.name} size={34} /><span class="truncate">{section.kid.name}</span></h2>
			<div class="flex shrink-0 gap-1.5">
				<button class="btn-quiet px-2.5 text-sm" onclick={() => newList(section.kid.id)}><Icon name="plus" size={16} />List</button>
				<button class="btn-ghost px-3 text-sm" onclick={() => openShare(section.everything.id, section.everything.share_token, `${section.kid.name}’s`)}>
					<Icon name={section.everything.share_token ? 'check' : 'share'} size={16} />{section.everything.share_token ? 'Shared' : 'Share'}
				</button>
			</div>
		</div>
		<div class="shelf grid grid-cols-2 items-end gap-x-3.5 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
			<ShelfItem
				href="/lists/{section.everything.id}"
				wrap={wrapOf(section.everything.id, section.everything.wrap) ?? 'sunburst'}
				menu={listMenu(section.everything.id, section.everything.wrap ?? 'sunburst', () => openShare(section.everything.id, section.everything.share_token, `${section.kid.name}’s`))}
				occasion="general"
				title="{section.kid.name}’s wish list"
				sub="What {section.kid.name} would love, picked by you"
				count={section.everything.item_count}
				transitionName="paper-{section.everything.id}"
				big
			/>
			{#each placed(section.lists.filter((l) => !isHidden(`list:${l.id}`))) as list, i (list.id)}
				<div class="grid" animate:flip={{ duration: dur(220) }}>
				<ShelfItem arrange={arrangeFor(list.id)} href="/lists/{list.id}" wrap={wrapOf(list.id, list.wrap)} menu={listMenu(list.id, list.wrap, null, list.name)} occasion={list.occasion} title={list.name} {...listSub(list)} count={list.item_count} days={daysUntil(list.next_date)} transitionName="paper-{list.id}" index={i + 1} />
				</div>
			{:else}
				<p class="col-span-2 -mt-3 text-center text-sm text-fg-faint md:col-span-1 md:mt-0 md:pb-10 md:text-left">No lists for {section.kid.name} yet</p>
			{/each}
		</div>
	</section>
{/each}

{#if data.friends.length}
	<section class="mt-12">
		<h2 class="mb-3 flex items-center justify-between text-lg font-bold">Coming up for your people <a href="/people" class="text-sm text-teal-300 hover:underline">See all</a></h2>
		<div class="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 no-scrollbar" data-no-swipe>
			{#each data.friends.slice(0, 8) as f, i (f.personId + f.label + f.date)}
				<a href={f.listId ? `/people/${f.personId}?list=${f.listId}` : `/people/${f.personId}`} class="card rise flex w-56 shrink-0 items-center gap-3 p-3 transition active:translate-y-0.5" style="--i: {i}">
					<Avatar name={f.name} src={f.avatar_url} sticker={f.kid ? null : f.sticker} size={44} />
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
			{#key creatingFor}
				<ListForm
					knownBirthday={creatingFor === 'me' ? data.myBirthday : (data.kids.find((k) => k.kid.id === creatingFor)?.kid.birthday ?? null)}
					knownWho={creatingFor === 'me' ? 'your' : `${data.kids.find((k) => k.kid.id === creatingFor)?.kid.name ?? 'their'}’s`}
				/>
			{/key}
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
