<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import Present from '#lib/components/Present.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Join {data.circle.name} · The Giver</title></svelte:head>

<div class="mx-auto max-w-md">
	<div class="card overflow-hidden">
		<Present occasion="wedding" class="h-36 rounded-t-[var(--radius-card)]" />
		<div class="p-6 text-center">
			<p class="text-sm font-bold text-teal-300">{data.circle.owner.split(' ')[0]} invited you to</p>
			<h1 class="display mt-1 text-[34px] leading-tight">{data.circle.name}</h1>
			<div class="mt-4 flex justify-center -space-x-2">
				{#each data.members.slice(0, 8) as m, i (i)}<Avatar name={m.name} src={m.avatar_url} size={40} />{/each}
			</div>
			<p class="mx-auto mt-4 max-w-xs text-sm text-fg-muted">Everyone in a circle can see each other’s wish lists and birthdays, and mark gifts they’re getting.</p>
			<form method="POST" class="mt-6">
				<button class="btn-teal w-full">Join the circle</button>
			</form>
		</div>
	</div>
</div>
