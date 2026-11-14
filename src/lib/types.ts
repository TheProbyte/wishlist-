export interface User {
	id: string;
	name: string;
	email: string | null;
	avatar_url: string | null;
}

/** Saved sizes, used to fill in a clothing gift's size. Every field is optional. */
export interface Sizes {
	top?: string;
	bottom?: string;
	dress?: string;
	shoe?: string;
	ring?: string;
	hat?: string;
}

/** A child whose lists a parent keeps. */
export interface Kid {
	id: string;
	parent_id: string;
	name: string;
	birthday: string | null;
	sizes: Sizes;
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
	wrap: string | null;
	/** 'master' is the Everything list: every gift its owner has. */
	kind: 'master' | 'list';
	/** Set when the list belongs to one of the owner's kids. */
	kid_id: string | null;
	created_at: number;
	updated_at: number;
	/** Its place on the shelf when arranged by hand (null: not placed). */
	position?: number | null;
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
	prev_price_cents: number | null;
	price_dropped_at: number | null;
	created_at: number;
	updated_at: number;
	specifics: Specific[];
	/** The occasion lists this gift is on (its Everything list not included). */
	lists: string[];
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
	/** You already have this gift (same product): which one, and whose Everything it's in. */
	duplicate?: { id: string; title: string; master: string } | null;
}
