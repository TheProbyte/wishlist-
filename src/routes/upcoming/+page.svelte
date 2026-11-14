<script lang="ts">
	import Present from '#lib/components/Present.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import { countdownLabel, daysUntil, milestone, occasionMeta } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const monthOf = (date: string) => {
		const [y, m] = date.split('-').map(Number);
		return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
	};
	const parts = (date: string) => {
		const [y, m, d] = date.split('-').map(Number);
		const dt = new Date(y, m - 1, d);
		return { day: d, weekday: dt.toLocaleDateString(undefined, { weekday: 'short' }), month: dt.toLocaleDateString(undefined, { month: 'short' }) };
	};
	// One timeline: your lists and your people's days, soonest first, grouped by month.
	type Entry = { key: string; date: string; mine?: (typeof data.upcoming)[number]; theirs?: (typeof data.people)[number] };
	const entries = $derived<Entry[]>(
		[
			...data.upcoming.map((l) => ({ key: l.id, date: l.next_date!, mine: l })),
			...data.people.map((u) => ({ key: `${u.personId}|${u.kid ?? ''}|${u.label}`, date: u.date, theirs: u }))
		].sort((a, b) => a.date.localeCompare(b.date))
	);
	const months = $derived.by(() => {
		const groups: { label: string; entries: Entry[] }[] = [];
		for (const e of entries) {
			const label = monthOf(e.date);
			if (groups.at(-1)?.label !== label) groups.push({ label, entries: [] });
			groups.at(-1)!.entries.push(e);
		}
		return groups;
	});

	/* The calendar ribbon: a little month calendar for each month from now to the last date,
	   with a dot on each day something's happening. Tap one to jump to it below. */
	const today = new Date();
	const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	const ribbon = $derived.by(() => {
		if (!entries.length) return [];
		const last = entries.at(-1)!.date;
		const [ly, lm] = last.split('-').map(Number);
		const out: { key: string; label: string; offset: number; days: { day: number; date: string; mine: boolean; theirs: boolean }[] }[] = [];
		let y = today.getFullYear();
		let m = today.getMonth() + 1;
		while ((y < ly || (y === ly && m <= lm)) && out.length < 13) {
			const n = new Date(y, m, 0).getDate();
			const key = `${y}-${String(m).padStart(2, '0')}`;
			out.push({
				key,
				label: new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: y === today.getFullYear() ? undefined : '2-digit' }),
				offset: new Date(y, m - 1, 1).getDay(),
				days: Array.from({ length: n }, (_, k) => {
					const date = `${key}-${String(k + 1).padStart(2, '0')}`;
					return { day: k + 1, date, mine: entries.some((e) => e.date === date && e.mine), theirs: entries.some((e) => e.date === date && e.theirs) };
				})
			});
			if (++m > 12) {
				m = 1;
				y++;
			}
		}
		return out;
	});
	function jump(date: string) {
		const el = document.getElementById(`d-${date}`);
		if (!el) return;
		el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
		el.classList.remove('nudge');
		void el.offsetWidth;
		el.classList.add('nudge');
	}
	const gifts = (n: number) => `${n} ${n === 1 ? 'gift' : 'gifts'}`;
</script>

<svelte:head><title>Coming up · The Giver</title></svelte:head>

<section class="mb-8">
	<h1 class="display text-[40px] leading-[1.05]">Coming up</h1>
	<p class="mt-3 max-w-lg text-fg-muted">Every occasion with a date, yours and your people’s, soonest first. Birthdays and Christmas roll on to next year by themselves.</p>
</section>

{#if ribbon.length}
	<!-- The calendar ribbon: tap a marked day to jump to it. -->
	<div class="no-scrollbar -mx-4 mb-8 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 sm:mx-0 sm:px-0" data-no-swipe aria-label="Calendar">
		{#each ribbon as mo (mo.key)}
			<div class="card w-[13.5rem] shrink-0 snap-start p-3">
				<p class="mb-2 text-xs font-bold tracking-wider text-fg-faint uppercase">{mo.label}</p>
				<div class="grid grid-cols-7 gap-0.5 text-center text-[11px]">
					{#each Array(mo.offset) as _, k (k)}<span></span>{/each}
					{#each mo.days as d (d.date)}
						{@const any = d.mine || d.theirs}
						<button
							class="relative grid aspect-square place-items-center rounded-[8px] font-bold tabular-nums {d.date === todayKey ? 'ring-2 ring-[var(--accent)]' : ''} {any ? 'bg-cocoa-800 text-fg' : 'text-fg-faint'} {d.date < todayKey ? 'opacity-40' : ''}"
							disabled={!any}
							onclick={() => jump(d.date)}
							aria-label={any ? `Jump to ${d.date}` : undefined}
							tabindex={any ? 0 : -1}
						>
							{d.day}
							{#if any}
								<span class="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5" aria-hidden="true">
									{#if d.mine}<span class="h-1 w-1 rounded-full bg-mustard-400"></span>{/if}
									{#if d.theirs}<span class="h-1 w-1 rounded-full bg-teal-300"></span>{/if}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
	<p class="-mt-5 mb-6 flex gap-4 text-xs font-bold text-fg-faint"><span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-mustard-400"></span>Your lists</span>{#if data.people.length}<span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-teal-300"></span>Your people</span>{/if}</p>
{/if}

{#if entries.length === 0}
	<div class="rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 px-6 py-14 text-center">
		<div class="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-cocoa-850 text-rust-300"><Icon name="calendar" size={30} /></div>
		<h2 class="display text-2xl">Nothing on the calendar</h2>
		<p class="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Make a Christmas list, or add your birthday to a birthday list, and it shows up here.</p>
	</div>
{:else}
	{#each months as month, mi (month.label)}
		<h2 class="mt-2 mb-3 text-xs font-bold tracking-wider text-fg-faint uppercase {mi ? 'pt-6' : ''}">{month.label}</h2>
		<ol class="space-y-3">
			{#each month.entries as e, i (e.key)}
				{@const p = parts(e.date)}
				{@const firstOfDay = month.entries.findIndex((x) => x.date === e.date) === i}
				<li class="rise" style="--i: {i + mi * 2}" id={firstOfDay ? `d-${e.date}` : undefined}>
					{#if e.mine}
						{@const list = e.mine}
						{@const days = daysUntil(list.next_date) ?? 0}
						{@const turning = milestone(list.occasion, list.occasion_date)}
						<a href="/lists/{list.id}" class="card group flex items-center gap-3.5 p-3 pr-4 transition active:translate-y-0.5 sm:gap-5">
							<div class="w-14 shrink-0 text-center">
								<div class="text-[11px] font-bold tracking-wider text-rust-300 uppercase">{p.weekday}</div>
								<div class="display text-[32px] leading-none">{p.day}</div>
								<div class="text-[11px] font-bold text-fg-faint uppercase">{p.month}</div>
							</div>
							<Present wrap={list.wrap} occasion={list.occasion} bow={false} class="h-16 w-16 shrink-0 rounded-[12px]" />
							<div class="min-w-0 flex-1">
								<h3 class="line-clamp-2 text-[15px] leading-snug font-bold">{list.name}</h3>
								<p class="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-fg-muted">
									<Icon name={occasionMeta(list.occasion).icon} size={14} />{gifts(list.item_count)}<span class="font-bold text-rust-300 sm:hidden">· {countdownLabel(list.next_date)}</span>{#if turning}<span class="text-rust-300">· {turning}</span>{/if}
								</p>
							</div>
							<span class="hidden shrink-0 sm:block"><GiftTag tone={days <= 14 ? 'rust' : 'cream'} tilt={3}>{countdownLabel(list.next_date)}</GiftTag></span>
						</a>
					{:else if e.theirs}
						{@const u = e.theirs}
						<a href={u.listId ? `/people/${u.personId}?list=${u.listId}` : `/people/${u.personId}`} class="card group flex items-center gap-3.5 p-3 pr-4 transition active:translate-y-0.5 sm:gap-5">
							<div class="w-14 shrink-0 text-center">
								<div class="text-[11px] font-bold tracking-wider text-teal-300 uppercase">{p.weekday}</div>
								<div class="display text-[32px] leading-none">{p.day}</div>
								<div class="text-[11px] font-bold text-fg-faint uppercase">{p.month}</div>
							</div>
							<span class="grid h-16 w-16 shrink-0 place-items-center"><Avatar name={u.kid ?? u.name} src={u.kid ? null : u.avatar_url} sticker={u.kid ? null : u.sticker} size={52} /></span>
							<div class="min-w-0 flex-1">
								<h3 class="line-clamp-2 text-[15px] leading-snug font-bold">{u.kid ? `${u.kid} (${u.name.split(' ')[0]}’s)` : u.name}</h3>
								<p class="mt-0.5 text-[13px] text-fg-muted">{u.label}<span class="font-bold text-teal-300 sm:hidden"> · {countdownLabel(u.date)}</span></p>
							</div>
							<span class="hidden shrink-0 sm:block"><GiftTag tone={u.days <= 14 ? 'teal' : 'cream'} tilt={3}>{countdownLabel(u.date)}</GiftTag></span>
						</a>
					{/if}
				</li>
			{/each}
		</ol>
	{/each}
{/if}

{#if data.undated.length}
	<h2 class="mt-10 mb-3 text-xs font-bold tracking-wider text-fg-faint uppercase">Anytime</h2>
	<div class="flex flex-wrap gap-2">
		{#each data.undated as list (list.id)}
			<a href="/lists/{list.id}" class="chip min-h-11 hover:text-fg"><Icon name={occasionMeta(list.occasion).icon} size={15} />{list.name}</a>
		{/each}
	</div>
{/if}
