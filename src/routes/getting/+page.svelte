<script lang="ts">
	import EmptyArt from '#lib/components/EmptyArt.svelte';
	import { enhance } from '$app/forms';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ProductImage from '#lib/components/ProductImage.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import Present from '#lib/components/Present.svelte';
	import { formatPrice } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Group by who it's for (a kid counts as their own person).
	const groups = $derived.by(() => {
		const map = new Map<string, { key: string; name: string; avatar: string | null; paper: string | null; claims: typeof data.claims }>();
		for (const c of data.claims) {
			const key = c.owner_id + (c.kid_name ?? '');
			const name = c.kid_name ? `${c.kid_name} (${c.owner_name.split(' ')[0]}’s)` : c.owner_name;
			if (!map.has(key)) map.set(key, { key, name, avatar: c.kid_name ? null : c.owner_avatar, paper: c.paper, claims: [] });
			map.get(key)!.claims.push(c);
		}
		return [...map.values()];
	});
	const toBuy = $derived(data.claims.filter((c) => !c.purchased));
	const wrapped = $derived(data.claims.length - toBuy.length);
	// Bought just now: these get wrapped in front of you (the others are simply wrapped already).
	let justWrapped = $state<string[]>([]);
	const spend = $derived(toBuy.reduce((n, c) => n + (c.price_cents ?? 0) * c.quantity, 0));
</script>

<svelte:head><title>Gifts I’m getting · The Giver</title></svelte:head>

<a href="/people" class="-mt-2 mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-fg-faint hover:text-fg"><Icon name="chevron-left" size={18} />People</a>

<section class="mb-8">
	<h1 class="display text-[38px] leading-[1.05]">Gifts I’m getting</h1>
	{#if data.claims.length}
		<!-- The wrapping table: how many are bought and wrapped. -->
		<div class="mt-4 flex items-center gap-3">
			<div class="relative h-3 flex-1 overflow-hidden rounded-full bg-cocoa-850">
				<div class="stripes-run absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-[var(--ease-out-soft)]" style="width: {(wrapped / data.claims.length) * 100}%; animation-play-state: paused"></div>
			</div>
			<span class="shrink-0 text-sm font-bold">{wrapped} of {data.claims.length} wrapped</span>
		</div>
		<div class="mt-3 flex flex-wrap gap-2">
			<GiftTag tone={toBuy.length ? 'rust' : 'teal'}>{toBuy.length ? `${toBuy.length} still to buy` : 'All wrapped!'}</GiftTag>
			{#if spend}<GiftTag tone="cream">about {formatPrice(spend, toBuy[0]?.currency)} left</GiftTag>{/if}
		</div>
	{/if}
</section>

{#if data.claims.length === 0}
	<div class="rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 px-6 py-14 text-center">
		<EmptyArt class="mx-auto mb-3" />
		<h2 class="display text-2xl">Nothing claimed yet</h2>
		<p class="mx-auto mt-2 max-w-sm text-sm text-fg-muted">When you tap “I’ll get this” on someone’s list, it lands here so you can keep track.</p>
	</div>
{/if}

{#each groups as g (g.key)}
	{@const done = g.claims.filter((c) => c.purchased).length}
	<section class="mb-10">
		<h2 class="mb-3 flex items-center gap-2.5 text-lg font-bold">
			<Avatar name={g.name} src={g.avatar} size={32} />
			<span class="min-w-0 flex-1 truncate">{g.name}</span>
			<span class="shrink-0 text-xs font-bold {done === g.claims.length ? 'text-teal-300' : 'text-fg-faint'}">{done} of {g.claims.length} wrapped</span>
		</h2>
		<!-- The table: unwrapped gifts as they are, bought ones wrapped in their paper. -->
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
			{#each g.claims as c (c.claim_id)}
				<div class="card flex flex-col overflow-hidden p-1.5">
					<div class="relative aspect-square overflow-hidden rounded-[12px]">
						<ProductImage src={c.image_url} size={240} seed={c.id} class="absolute inset-0 h-full w-full" />
						{#if c.purchased}
							<div class="absolute inset-0 {justWrapped.includes(c.claim_id) ? 'wrap-close' : ''}">
								<Present wrap={g.paper ?? 'sunburst'} occasion="general" ribbonAt={50} class="paper-grain h-full w-full" />
							</div>
							<span class="absolute bottom-2 left-2 rounded-full bg-cocoa-950/85 px-2.5 py-1 text-[11px] font-bold text-teal-300 {justWrapped.includes(c.claim_id) ? 'stamp' : ''}">Wrapped</span>
						{/if}
					</div>
					<div class="flex flex-1 flex-col gap-1 px-1.5 pt-2 pb-1">
						<p class="line-clamp-2 text-sm leading-snug font-bold">{c.title}</p>
						<div class="flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
							{#if c.price_cents != null}<span>{formatPrice(c.price_cents, c.currency)}</span>{/if}
							{#if c.url}<a href={c.url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-bold hover:text-teal-300">{c.store ?? 'Shop'}<Icon name="external" size={11} /></a>{/if}
						</div>
						<div class="mt-auto flex items-center gap-1.5 pt-2">
							<form
								method="POST"
								action="?/bought"
								class="flex-1"
								use:enhance={() => {
									if (!c.purchased) justWrapped = [...justWrapped, c.claim_id];
									return async ({ update }) => update();
								}}
							>
								<input type="hidden" name="claim" value={c.claim_id} />
								<input type="hidden" name="purchased" value={c.purchased ? '0' : '1'} />
								<button class="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-2 text-[13px] font-bold transition {c.purchased ? 'bg-cocoa-800 text-fg-muted hover:text-fg' : 'bg-teal-600 text-cream'}" aria-pressed={!!c.purchased}>
									{#if c.purchased}Unwrap{:else}<Icon name="gift" size={15} />Bought it{/if}
								</button>
							</form>
							<form method="POST" action="?/release" use:enhance>
								<input type="hidden" name="claim" value={c.claim_id} />
								<button class="grid h-10 w-10 place-items-center rounded-[var(--radius-control)] text-fg-faint hover:text-rust-300" aria-label="Not getting {c.title} after all" title="Not getting it after all"><Icon name="close" size={16} /></button>
							</form>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/each}
