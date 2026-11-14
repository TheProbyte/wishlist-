<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';

	/**
	 * Notifications, on or off for this phone or computer: reminders before your people's
	 * occasions, price drops on your gifts, and "names are drawn". iPhones only allow them once
	 * The Giver is on the Home Screen, so there it says how.
	 */
	type Status = 'checking' | 'on' | 'off' | 'blocked' | 'install' | 'unsupported';
	let status = $state<Status>('checking');
	let busy = $state(false);
	let problem = $state<string | null>(null);

	const toKey = (b64: string) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));

	onMount(async () => {
		const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
		const installed = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
		if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
			status = ios && !installed ? 'install' : 'unsupported';
			return;
		}
		if (Notification.permission === 'denied') return void (status = 'blocked');
		const reg = await navigator.serviceWorker.ready;
		status = (await reg.pushManager.getSubscription()) ? 'on' : 'off';
	});

	async function turnOn() {
		busy = true;
		problem = null;
		try {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				status = permission === 'denied' ? 'blocked' : 'off';
				return;
			}
			const { key } = (await (await fetch('/api/push')).json()) as { key: string };
			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) });
			const res = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
			if (!res.ok) throw new Error();
			status = 'on';
		} catch {
			problem = 'Couldn’t turn them on just now. Try again in a moment.';
		} finally {
			busy = false;
		}
	}
	async function turnOff() {
		busy = true;
		try {
			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.getSubscription();
			if (sub) {
				await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
				await sub.unsubscribe();
			}
			status = 'off';
		} finally {
			busy = false;
		}
	}
</script>

<div class="card p-4">
	<div class="flex items-center gap-3">
		<span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cocoa-950 {status === 'on' ? 'text-mustard-400' : 'text-fg-faint'}"><Icon name="bell" size={21} /></span>
		<span class="min-w-0 flex-1">
			<span class="block font-bold">Reminders</span>
			<span class="block text-sm text-fg-muted">Two weeks before your people’s days, price drops, Secret Santa draws</span>
		</span>
		{#if status === 'on' || status === 'off'}
			<!-- A proper switch: on is mustard, the knob slides across. -->
			<button
				class="relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 {status === 'on' ? 'bg-mustard-400' : 'bg-cocoa-700'}"
				role="switch"
				aria-checked={status === 'on'}
				aria-label="Reminders"
				disabled={busy}
				onclick={() => (status === "on" ? turnOff() : turnOn())}
			>
				<span class="absolute top-1 left-1 h-6 w-6 rounded-full bg-cream shadow-[0_2px_0_0_rgb(0_0_0/0.25)] transition-transform duration-200 ease-[var(--ease-spring)] {status === 'on' ? 'translate-x-6' : ''}"></span>
			</button>
		{/if}
	</div>
	{#if status === 'install'}
		<p class="mt-3 rounded-[12px] bg-cocoa-850 px-3.5 py-2.5 text-sm text-fg-muted">On iPhone, reminders need The Giver on your Home Screen: in Safari tap <span class="font-bold text-fg">Share → Add to Home Screen</span>, open it from there, and turn this on.</p>
	{:else if status === 'blocked'}
		<p class="mt-3 rounded-[12px] bg-cocoa-850 px-3.5 py-2.5 text-sm text-fg-muted">Notifications are blocked for The Giver. Allow them in your phone’s (or browser’s) settings, then come back here.</p>
	{:else if status === 'unsupported'}
		<p class="mt-3 text-sm text-fg-faint">This browser can’t show notifications.</p>
	{/if}
	{#if problem}<p class="mt-3 text-sm font-bold text-rust-300">{problem}</p>{/if}
</div>
