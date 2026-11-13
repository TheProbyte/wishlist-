<script lang="ts">
	import { SIZE_FIELDS } from '#lib/sizes.ts';
	import type { Sizes } from '#lib/types.ts';

	let { sizes }: { sizes: Sizes } = $props();
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
	{#each SIZE_FIELDS as f (f.key)}
		<label class="block">
			<span class="label">{f.label}</span>
			<input class="field" name="size_{f.key}" maxlength="30" placeholder={f.example} value={sizes[f.key] ?? ''} />
		</label>
	{/each}
</div>
