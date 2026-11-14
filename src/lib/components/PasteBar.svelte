<script lang="ts">
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';

	/**
	 * Paste a link to add a gift. Without `onsubmit` it goes to the add page; with it, the page
	 * handles the link itself. `onplus` shows a + button for the other ways to add.
	 */
	let {
		value = $bindable(''),
		onsubmit,
		onplus,
		onpastelink,
		class: cls = '',
		style = ''
	}: {
		value?: string;
		onsubmit?: (link: string) => void;
		onplus?: () => void;
		onpastelink?: (link: string) => void;
		class?: string;
		style?: string;
	} = $props();

	let form = $state<HTMLFormElement>();
	let input = $state<HTMLInputElement>();
	let canPaste = $state(false);
	let note = $state<string | null>(null);
	$effect(() => {
		canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;
	});

	async function pasteFromClipboard() {
		note = null;
		let text = '';
		try {
			text = (await navigator.clipboard.readText()).trim();
		} catch {
			// Not allowed here: let them paste by hand.
			input?.focus();
			return;
		}
		if (!text) {
			note = 'Nothing copied yet: Share → Copy link first';
			input?.focus();
			return;
		}
		value = text;
		if (onpastelink && /https?:\/\//.test(text)) return onpastelink(text);
		if (onsubmit) return onsubmit(text);
		// The plain bar goes to the add page with the link.
		await tick();
		form?.requestSubmit();
	}
</script>

<form
	bind:this={form}
	method="GET"
	action="/add"
	class="flex items-center gap-1.5 rounded-[var(--radius-card)] bg-cocoa-850 p-1.5 ring-2 ring-cocoa-700 focus-within:ring-mustard-400 {cls}"
	{style}
	onsubmit={(e) => {
		if (!onsubmit) return;
		e.preventDefault();
		if (value.trim()) onsubmit(value.trim());
	}}
>
	{#if onplus}
		<button type="button" class="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-cocoa-800 text-fg transition active:scale-95" aria-label="More ways to add" onclick={onplus}>
			<Icon name="plus" size={20} />
		</button>
	{/if}
	<label class="flex min-w-0 flex-1 items-center gap-2.5 px-2">
		<Icon name="link" size={18} class="text-mustard-400" />
		<span class="sr-only">Product link</span>
		<input
			bind:this={input}
			name="url"
			class="w-full min-w-0 border-0 bg-transparent py-2.5 text-[15px] text-fg placeholder:text-fg-faint focus:ring-0 focus:outline-none"
			placeholder={note ?? 'Paste a link to add a gift…'}
			autocomplete="off"
			enterkeyhint="go"
			bind:value
			onpaste={(e) => {
				const text = e.clipboardData?.getData('text') ?? '';
				if (onpastelink && /https?:\/\//.test(text)) {
					e.preventDefault();
					onpastelink(text);
				}
			}}
		/>
	</label>
	{#if !value.trim() && canPaste}
		<!-- Empty box: one tap pastes what you copied (e.g. Share → Copy link in the Amazon app). -->
		<button type="button" class="btn-primary min-h-11 shrink-0 px-4" onclick={pasteFromClipboard}>Paste</button>
	{:else}
		<button class="btn-primary min-h-11 shrink-0 px-4" disabled={!value.trim()}>Add</button>
	{/if}
</form>
