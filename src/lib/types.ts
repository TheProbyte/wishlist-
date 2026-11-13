export interface User {
	id: string;
	name: string;
	email: string | null;
	avatar_url: string | null;
}

export type Occasion = 'birthday' | 'christmas' | 'wedding' | 'baby' | 'anniversary' | 'general' | 'other';

export interface List {
	id: string;
	owner_id: string;
	name: string;
	occasion: Occasion;
	occasion_date: string | null;
	description: string | null;
	share_token: string | null;
	created_at: number;
	updated_at: number;
}

export interface Category {
	id: string;
	owner_id: string | null;
	name: string;
	color: string;
	icon: string;
	suggested_specs: string[];
	position: number;
}

export interface Specific {
	label: string;
	value: string;
}

export type Availability = 'in_stock' | 'out_of_stock' | 'unknown';

export interface Item {
	id: string;
	list_id: string;
	category_id: string | null;
	url: string | null;
	store: string | null;
	title: string;
	description: string | null;
	image_url: string | null;
	price_cents: number | null;
	currency: string | null;
	availability: Availability | null;
	rank: number;
	rating: number;
	quantity: number;
	note: string | null;
	last_checked: number | null;
	created_at: number;
	updated_at: number;
	specifics: Specific[];
}

/** What the importer hands back for a pasted link. Every field may be missing. */
export interface ImportResult {
	ok: boolean;
	blocked: boolean;
	url: string;
	store: string | null;
	title: string | null;
	description: string | null;
	image_url: string | null;
	images: string[];
	price_cents: number | null;
	currency: string | null;
	availability: Availability;
	specifics: Specific[];
	category_id: string | null;
	error?: string;
}
