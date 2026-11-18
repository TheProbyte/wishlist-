// See https://svelte.dev/docs/kit/types#app.d.ts
import type { User } from '#lib/types.ts';

declare global {
	namespace App {
		interface Locals {
			db: D1Database;
			/** The signed-in person. Set on every page that needs an account. */
			user: User;
			/** The signed-in person on public pages (share links), if any. */
			viewer: User | null;
			/** The signed-in person's colours, read along with their session (undefined until looked up). */
			look?: { theme: string | null; highlight: string | null };
			/** Whether Google sign-in is switched on (keys are set). */
			authEnabled: boolean;
		}
	}
	namespace Cloudflare {
		interface Env {
			/** A Worker secret, set in the Cloudflare dashboard (the client ID is in wrangler.jsonc). */
			GOOGLE_CLIENT_SECRET?: string;
		}
	}
}

export {};
