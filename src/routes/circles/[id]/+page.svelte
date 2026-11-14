<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import { paperFor } from '#lib/papers.ts';
	import { countdownLabel, formatDate, withKid } from '#lib/format.ts';
	import { askForIdeas, looksThin } from '#lib/nudge.ts';
	import { toast } from '#lib/undo.svelte.ts';
	import type { PageProps } from './$types';

	/**
	 * One circle: its people (tap one for their wish lists), what's coming up for them, and the
	 * invite link to bring more people in. Whoever made it can rename it.
	 */
	let { data, form }: PageProps = $props();

	const invite = $derived(`${page.url.origin}/circles/join/${data.circle.invite_token}`);
	let renaming = $state(false);
	let leaving = $state(false);

	async function shareInvite() {
		const text = `Join “${data.circle.name}” on The Giver, so we can see each other’s wish lists and nobody buys the same gift twice.`;
		if (navigator.share) {
			try {
				await navigator.share({ title: data.circle.name, text, url: invite });
			} catch {
				/* closed the share sheet */
			}
			return;
		}
		await navigator.clipboard.writeText(invite);
		toast('Invite link copied');
	}
	async function copyInvite() {
		await navigator.clipboard.writeText(invite);
		toast('Invite link copied');
	}
	async function nudge(m: (typeof data.members)[number]) {
		const r = await askForIdeas(m.name, m.next);
		if (r === 'copied') toast('Message copied: paste it to them');
	}
</script>

<svelte:head><title>{data.circle.name} · The Giver</title></svelte:head>

<section class="mb-6">
	<a href="/people" class="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-bold text-fg-faint hover:text-fg"><Icon name="chevron-left" size={18} />People</a>
	{#if renaming}
		<form
			method="POST"
			action="?/rename"
			class="flex items-center gap-2"
			use:enhance={() => async ({ result, update }) => {
				await update({ reset: false });
				if (result.type === 'success') renaming = false;
			}}
		>
			<!-- svelte-ignore a11y_autofocus -->
			<input class="field display text-2xl" name="name" maxlength="50" value={data.circle.name} autofocus aria-label="Circle name" />
			<button class="btn-primary shrink-0">Save</button>
			<button type="button" class="btn-quiet shrink-0 px-3" onclick={() => (renaming = false)} aria-label="Cancel"><Icon name="close" size={18} /></button>
		</form>
		{#if form?.renameError}<p class="mt-2 text-sm font-bold text-rust-300">{form.renameError}</p>{/if}
	{:else}
		<div class="flex items-start gap-2">
			<h1 class="display accent-bar min-w-0 text-[36px] leading-[1.05] break-words sm:text-5xl">{data.circle.name}</h1>
			{#if data.circle.mine}
				<button class="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cocoa-850 text-fg-muted hover:text-fg" aria-label="Rename circle" onclick={() => (renaming = true)}><Icon name="tag" size={17} /></button>
			{/if}
		</div>
	{/if}
	<p class="mt-2 text-fg-muted">{data.members.length} {data.members.length === 1 ? 'person' : 'people'}. Everyone here can see each other’s wish lists and birthdays.</p>
</section>

<!-- Bring people in. -->
<div class="card mb-8 flex flex-wrap items-center gap-3 p-4">
	<span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal-600 text-cream"><Icon name="people" size={22} /></span>
	<span class="min-w-0 flex-1">
		<span class="block font-bold">Invite someone</span>
		<span class="text-sm text-fg-muted">They sign in with Google and they’re in.</span>
	</span>
	<div class="flex w-full gap-2 sm:w-auto">
		<button class="btn-teal flex-1 sm:flex-none" onclick={shareInvite}><Icon name="share" size={17} />Send invite</button>
		<button class="btn-ghost px-3" onclick={copyInvite} aria-label="Copy invite link"><Icon name="link" size={17} /></button>
	</div>
</div>

<section class="mb-10">
	<h2 class="mb-3 text-lg font-bold">Who’s in</h2>
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
		{#each data.members as m, i (m.id)}
			{@const me = m.id === data.me}
			<div class="card rise relative flex flex-col items-center gap-1.5 overflow-hidden px-3 pt-6 pb-4 text-center" style="--i: {i}">
				{#if m.paper}<span class="absolute inset-x-0 top-0 h-10 opacity-90" style="background: {paperFor(m.paper).background}" aria-hidden="true"></span>{/if}
				<Avatar name={m.name} src={m.avatar_url} sticker={m.sticker} size={52} />
				<span class="display w-full truncate text-[19px]">{me ? 'You' : m.name.split(' ')[0]}</span>
				{#if m.next}<span class="pill max-w-full bg-rust-500/20 text-rust-300"><span class="truncate">{withKid(m.next.kid, m.next.label)} {countdownLabel(m.next.date)}</span></span>{/if}
				{#if !me}
					<a href="/people/{m.id}" class="mt-auto inline-flex min-h-9 items-center gap-1 pt-1 text-sm font-bold text-[var(--accent-text)]">{m.gift_count ? `${m.gift_count} ${m.gift_count === 1 ? 'gift' : 'gifts'}` : 'Wish lists'}<Icon name="chevron-right" size={16} /></a>
					{#if looksThin(m.gift_count, m.next?.days)}
						<button class="text-xs font-bold text-fg-faint underline decoration-dotted underline-offset-4 hover:text-fg" onclick={() => nudge(m)}>Ask for ideas</button>
					{/if}
				{/if}
			</div>
		{/each}
	</div>
</section>

{#if data.upcoming.length}
	<section class="mb-10">
		<h2 class="mb-3 text-lg font-bold">Coming up in {data.circle.name}</h2>
		<div class="grid gap-2.5 md:grid-cols-2">
			{#each data.upcoming as u, i (u.personId + u.label + u.date)}
				<a href={u.listId ? `/people/${u.personId}?list=${u.listId}` : `/people/${u.personId}`} class="card rise flex items-center gap-3 p-3 pr-4 transition active:translate-y-0.5" style="--i: {i}">
					<Avatar name={u.kid ?? u.name} src={u.kid ? null : u.avatar_url} sticker={u.kid ? null : u.sticker} size={42} />
					<span class="min-w-0 flex-1">
						<span class="block truncate font-bold">{u.kid ? `${u.kid} (${u.name.split(' ')[0]}’s)` : u.name}</span>
						<span class="block truncate text-sm text-fg-muted">{u.label} · {formatDate(u.date)}</span>
					</span>
					<GiftTag tone={u.days <= 14 ? 'rust' : 'cream'} tilt={3}>{countdownLabel(u.date)}</GiftTag>
				</a>
			{/each}
		</div>
	</section>
{/if}

<form method="POST" action="?/leave" class="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-rust-500/10 p-3.5 pl-4">
	<p class="text-sm text-fg-muted">{leaving ? 'Leave? You’ll stop seeing their lists, and they yours.' : 'Not your crowd any more?'}</p>
	{#if leaving}
		<div class="flex shrink-0 gap-1.5">
			<button type="button" class="btn-quiet px-3 text-sm" onclick={() => (leaving = false)}>Stay</button>
			<button class="btn-danger px-3 text-sm">Leave</button>
		</div>
	{:else}
		<button type="button" class="btn-quiet shrink-0 px-3 text-sm text-rust-300 hover:text-rust-300" onclick={() => (leaving = true)}>Leave circle</button>
	{/if}
</form>
