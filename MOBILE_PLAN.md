# Mobile, motion and speed plan

What's wrong today, what changes, and the order to do it in. Based on using the app as an installed home-screen app on a phone.

## 1. Quick fix

- Remove the "Occasion lists" wording on the Lists page. The section is just **Lists**, and the "Optional. Everything works from one list…" paragraph goes. An empty state shows only a small "+ New list" tile.

## 2. Smooth swiping between Lists, People and You

**What's wrong.** A swipe moves the whole page area, and the paste bar lives inside that area. While the page is moving, the paste bar loses its "stuck to the bottom" position and jumps, the page briefly becomes a different height, and the new page pops in afterwards. That is the flicker and the length change.

**The fix: a fixed shell with a real pager inside it.**

- **The shell never moves.** Header, stripes, tab bar and paste bar sit outside the swiping area. Only the page content slides between them.
- **The three tabs sit side by side**, like the category strip inside a list. Swiping scrolls between them natively, so the next page is already there under your finger: no pop-in, no blank gap, and the phone's own momentum.
- **Each tab keeps its own scroll position.** Swipe to People and back, and Lists is where you left it.
- **The stripe marker under the tabs tracks your finger** as you swipe, instead of jumping after.
- **The paste bar only shows on Lists** and fades (not jumps) when you swipe away from it.
- Opening a list from the Lists tab slides in over the shell from the right; swiping from the left edge, or tapping back, slides it away.

## 3. The list page, redesigned for a phone

**What's wrong (from the screenshot).** Gifts don't start until three-quarters of the way down the first screen. Above them are eleven separate rows: back link, arrows, a tall paper strip, a subtitle, the title, tags, Share, Add by hand, category chips, Select and sort, and a hint. Two of those rows show grey scrollbars. The paste bar covers the cards. The rank arrows sit on top of the photos.

**The new layout, top to bottom:**

1. **One compact header (about a quarter of today's height).**
   - A short paper strip with the list name on it.
   - Back arrow on the left; Share and "⋯" as icon buttons on the right.
   - One small line under it: "29 gifts · $2,458".
2. **One toolbar row.**
   - Category chips, scrolling sideways, with no visible scrollbar.
   - A single sort button at the end ("Most wanted ▾") that opens a small menu, replacing the row of five sort options.
   - This row sticks to the top when you scroll, so filters are always in reach.
3. **Gifts, visible on the first screen.**

**What moves out of the way:**

- **Select** goes into the "⋯" menu, and also starts when you press and hold a gift.
- **Add by hand** becomes a "+" button inside the paste bar.
- **From Everything** goes into that same "+" menu.
- **Previous / next list arrows** go away; swiping the header does that already.
- **The hints** ("Swipe across your gifts…", "Drag cards to rank…") show once, the first time, then never again.

**Cards:**

- **Rank arrows come off the photos.** To re-rank on a phone, press and hold a card and drag it. The "⋯" menu also gets a "Reorder" mode with clear handles for anyone who prefers that.
- **Tighter cards:** photo, name (two lines), price and stars. Details like size and colour stay as small pills; the shop name moves into the gift's detail sheet.
- **A list view toggle:** a compact one-gift-per-row layout (small photo left, name and price right) for long lists like your 29, next to the photo grid.
- **The page ends with enough space** that the paste bar never covers the last row.

**The same treatment** goes to the giver's page and a person's page, so they match.

## 4. Animations throughout

**Rules everything follows:**

- **Nothing moves the layout.** Animations only slide, fade and scale; no element changes size mid-animation. Photos reserve their space before they load.
- **Finger first.** Anything you drag (tabs, categories, sheets, cards) follows the finger with no delay, then settles with one shared spring.
- **Short.** Taps respond within a tenth of a second; transitions finish in about a fifth of a second.
- **Once.** Cards animate in the first time a list loads, not every time you come back to it.
- **Honours "reduce motion"**, as now.

**Specific moments to redo:**

| Moment | Today | After |
|---|---|---|
| Swipe between tabs | Slide out, pause, pop in; bars jump | Native side-by-side scroll; bars fixed |
| Open a list | Fade, then content appears | Card's paper grows into the header; gifts fade in under it |
| Back to Lists | Fade | Reverse of the above, and you land where you were |
| Open add/edit sheet | Slides up, sometimes stutters with keyboard | Slides up once; keyboard-aware so the Save button stays visible |
| Add a gift | List reloads | New card drops into place; others shift aside |
| Delete / remove | List reloads | Card shrinks away; others close the gap |
| Rate | Stars pop (keep) | Same |
| Select mode | Bar appears | Bar slides up as the paste bar slides down |
| Loading a page | Blank, then content | Card-shaped placeholders in the right places, so nothing jumps |

## 5. Speed

**Feels instant:**

- **Act first, save after.** Rating, re-ranking, ticking, deleting and adding to a list update on screen immediately and save in the background. If a save fails, it rolls back with a short message.
- **Tabs remember their data.** Switching tabs shows what was there straight away and refreshes quietly, instead of asking the server every time.
- **Lists open from memory.** A list you've opened before shows instantly and updates in place.

**Loads less:**

- **Right-sized photos.** Ask shops (Amazon especially) for small thumbnails in the grid and the full photo only in the detail sheet. Photos below the screen load as you scroll.
- **Fewer trips to the database** per page: combine the several small lookups each page makes into one or two.
- **Background price checks never delay a page.** They already run after the page is sent; cap them tighter on long lists.

**Starts faster:**

- **Keep the app's frame on the phone** (header, tabs, styles, fonts), so opening the home-screen app shows the shell at once and fills in your lists a moment later.
- **Fonts load without blocking** the first paint.

**Targets, measured on a mid-range phone:**

| Action | Target |
|---|---|
| Tap feedback | under 0.1 s |
| Switch tab | instant (already on screen) |
| Open a list you've seen | under 0.1 s |
| Open a list for the first time | under 0.5 s |
| Open the app from the home screen | shell under 0.5 s, lists under 1.5 s |
| Scrolling and swiping | smooth (60 frames a second), no dropped-frame stutter |

## 6. Build order

1. **Quick fix** (wording), **hidden scrollbars**, and **paste bar no longer covering cards**. Small, immediate wins.
2. **Fixed shell and tab pager** (section 2). Fixes the swipe flicker for good.
3. **List page redesign** (section 3): compact header, single toolbar, cards, press-and-hold.
4. **Act-first updates and remembered data** (section 5, "feels instant").
5. **Animation pass** (section 4), now that the layout is stable.
6. **Photos, database trips, app frame on the phone** (rest of section 5).
7. **Measure against the targets** on a phone and tune.

Each step ships on its own and leaves the app in a better state than before.

## 7. Choices for you

- **Default gift layout on phones:** photo grid (as now, tighter) or the compact list view. Recommended: grid by default, with the toggle remembered per list.
- **Re-ranking:** press-and-hold to drag (recommended), or only through a "Reorder" mode.
