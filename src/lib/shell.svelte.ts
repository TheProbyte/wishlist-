/**
 * Shared state between the tab pager (routes/[[tab=tab]]) and the tab bar in the layout:
 * how far the pager is scrolled (0 = Lists, 1 = People, 2 = You, fractions while swiping),
 * and a way for the tab bar to ask the pager to go to a tab.
 */
export const shell = $state({
	/** Set while the tab pager is on screen. */
	active: false,
	progress: 0,
	go: (_i: number) => {},
	/** The tab bar's tab for the tab already showing was tapped again. */
	reselect: (_i: number) => {}
});
