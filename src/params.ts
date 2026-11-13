import { defineParams } from '@sveltejs/kit/params';

/** Route param matchers. `[[tab=tab]]` is the Lists / People / You pager. */
export const params = defineParams({
	tab: (param) => (param === 'people' || param === 'me' ? param : undefined)
});
