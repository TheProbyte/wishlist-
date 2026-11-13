// See https://svelte.dev/docs/kit/types#app.d.ts
import type { User } from '#lib/types.ts';

declare global {
	namespace App {
		interface Locals {
			db: D1Database;
			user: User;
		}
	}
}

export {};
