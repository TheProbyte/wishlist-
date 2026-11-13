<script lang="ts">
	import { enhance } from '$app/forms';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ProductImage from '#lib/components/ProductImage.svelte';
	import GiftTag from '#lib/components/GiftTag.svelte';
	import { formatPrice } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Group by who it's for (a kid counts as their own person).
	const groups = $derived.by(() => {
		const map = new Map<string, { key: string; name: string; avatar: string | null; claims: typeof data.claims }>();
		for (const c of data.claims) {
			const key = c.owner_id + (c.kid_name ?? '');
			const name = c.kid_name ? `${c.kid_name} (${c.owner_name.split(' ')[0]}’s)` : c.owner_name;
			if (!map.has(key)) map.set(key, { key, name, avatar: c.kid_name ? null : c.owner_avatar, claims: [] });
			map.get(key)!.claims.push(c);
		}
		return [...map.values()];
	});
	const toBuy = $derived(data.claims.filter((c) => !c.purchased));
	const spend = $derived(toBuy.reduce((n, c) => n + (c.price_cents ?? 0) * c.quantity, 0));
</script>

<svelte:head><title>Gifts I’m getting · The Giver</title></svelte:head>

<a href="/people" class="-mt-2 mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-fg-faint hover:text-fg"><Icon name="chevron-left" size={18} />People</a>

<section class="mb-8">
	<h1 class="display text-[38px] leading-[1.05]">Gifts I’m getting</h1>
	{#if data.claims.length}
		<div class="mt-4 flex flex-wrap gap-2">
			<GiftTag tone={toBuy.length ? 'rust' : 'teal'}>{toBuy.length ? `${toBuy.length} still to buy` : 'All bought'}</GiftTag>
			{#if spend}<GiftTag tone="cream">about {formatPrice(spend, toBuy[0]?.currency)} left</GiftTag>{/if}
		</div>
	{/if}
</section>

{#if data.claims.length === 0}
	<div class="rounded-[var(--radius-card)] border-2 border-dashed border-cocoa-700 px-6 py-14 text-center">
		<div class="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-cocoa-850 text-teal-300"><Icon name="gift" size={30} /></div>
		<h2 class="display text-2xl">Nothing claimed yet</h2>
		<p class="mx-auto mt-2 max-w-sm text-sm text-fg-muted">When you tap “I’ll get this” on someone’s list, it lands here so you can keep track.</p>
	</div>
{/if}

{#each groups as g (g.key)}
	<section class="mb-8">
		<h2 class="mb-3 flex items-center gap-2.5 text-lg font-bold"><Avatar name={g.name} src={g.avatar} size={32} />{g.name}</h2>
		<div class="space-y-2.5">
			{#each g.claims as c (c.claim_id)}
				<div class="card flex items-center gap-3 p-2.5 pr-3 transition {c.purchased ? 'opacity-60' : ''}">
					<ProductImage src={c.image_url} size={64} class="h-16 w-16 shrink-0 rounded-[12px]" />
					<div class="min-w-0 flex-1">
						<p class="line-clamp-2 text-sm font-bold {c.purchased ? 'line-through decoration-2' : ''}">{c.title}</p>
						<div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
							{#if c.price_cents != null}<span>{formatPrice(c.price_cents, c.currency)}</span>{/if}
							{#if c.url}<a href={c.url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-bold hover:text-teal-300">{c.store ?? 'Shop'}<Icon name="external" size={11} /></a>{/if}
							<form method="POST" action="?/release" use:enhance class="inline">
								<input type="hidden" name="claim" value={c.claim_id} />
								<button class="font-bold hover:text-rust-300">Undo</button>
							</form>
						</div>
					</div>
					<form method="POST" action="?/bought" use:enhance>
						<input type="hidden" name="claim" value={c.claim_id} />
						<input type="hidden" name="purchased" value={c.purchased ? '0' : '1'} />
						<button class="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-bold transition {c.purchased ? 'bg-teal-600 text-cream' : 'bg-cocoa-800 text-fg-muted hover:text-fg'}" aria-pressed={!!c.purchased}>
							<span class="grid h-5 w-5 place-items-center rounded-md border-2 {c.purchased ? 'border-cream' : 'border-cocoa-500'}">{#if c.purchased}<Icon name="check" size={14} />{/if}</span>
							Bought
						</button>
					</form>
				</div>
			{/each}
		</div>
	</section>
{/each}
