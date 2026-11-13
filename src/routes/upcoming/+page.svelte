<script lang="ts">
	import Present from '#lib/components/Present.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import Icon from '#lib/components/Icon.svelte';
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
	// Group by month, keeping the soonest-first order.
	const months = $derived.by(() => {
		const groups: { label: string; lists: typeof data.upcoming }[] = [];
		for (const l of data.upcoming) {
			const label = monthOf(l.next_date!);
			if (groups.at(-1)?.label !== label) groups.push({ label, lists: [] });
			groups.at(-1)!.lists.push(l);
		}
		return groups;
	});
	const gifts = (n: number) => `${n} ${n === 1 ? 'gift' : 'gifts'}`;
</script>

<svelte:head><title>Coming up · The Giver</title></svelte:head>

<section class="mb-8">
	<h1 class="display text-[40px] leading-[1.05]">Coming up</h1>
	<p class="mt-3 max-w-lg text-fg-muted">Every occasion with a date, soonest first. Birthdays and Christmas roll on to next year by themselves.</p>
</section>

{#if data.upcoming.length === 0}
	<div class="rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 px-6 py-14 text-center">
		<div class="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-cocoa-850 text-rust-300"><Icon name="calendar" size={30} /></div>
		<h2 class="display text-2xl">Nothing on the calendar</h2>
		<p class="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Make a Christmas list, or add your birthday to a birthday list, and it shows up here.</p>
	</div>
{:else}
	{#each months as month, mi (month.label)}
		<h2 class="mt-2 mb-3 text-xs font-bold tracking-wider text-fg-faint uppercase {mi ? 'pt-6' : ''}">{month.label}</h2>
		<ol class="space-y-3">
			{#each month.lists as list, i (list.id)}
				{@const p = parts(list.next_date!)}
				{@const days = daysUntil(list.next_date) ?? 0}
				{@const turning = milestone(list.occasion, list.occasion_date)}
				<li class="rise" style="--i: {i + mi * 2}">
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
