# The Giver: retro design plan

Takes the "Retro Wrapping Paper" mockup and gives it more personality, motion and swipe navigation, while keeping every screen in one visual system.

## 1. The idea in one line

**Every list is a wrapped present.** The app is the table the presents sit on: dark cocoa, calm, mostly plain. The colour, pattern and fun live on the presents and on a few signature moments.

That is also how gift stripes fit in. Stripes stop being decoration scattered around the page and become *wrapping paper*: something a list wears.

## 2. Colours and their jobs

Same five colours as the mockup, but each gets one job so screens stay clean.

| Colour | Hex | Job |
|---|---|---|
| Cocoa | `#2B1D14` | Page background. Cards are one step lighter (`#3A2719`). |
| Cream | `#F3E7CF` | Text, and the light tile behind product photos. |
| Mustard | `#E8A83A` | The one action colour: buttons, links, stars, the #1 badge. |
| Rust | `#D2602D` | Dates and countdowns, "out of stock", delete. |
| Teal | `#3E8E87` | Sharing and givers: share button, "taken", the giver page. |

Rules:
- A screen has **one** mustard button. Everything else is quiet.
- Patterns only ever use these five colours.
- Type: Shrikhand for page titles and big numbers only (never body text or buttons), DM Sans for everything else.

## 3. Wrapping paper (the stripe system)

Each list gets a **wrap**: a pattern plus a ribbon colour. You pick it when you make the list, or it is suggested from the occasion.

Six papers to start, all drawn in code (no image files, so they stay sharp and load instantly):

1. **Candy stripe**: diagonal mustard and cream. Default for birthdays.
2. **Sunburst**: rays from a corner, rust and mustard. Default for "anytime".
3. **Wide stripe**: fat vertical teal and cream bands. Default for Christmas.
4. **Polka**: cream dots on rust.
5. **Rainbow arcs**: the three-colour 70s arches from the mockup's countdown card.
6. **Checker**: small mustard and cocoa squares.

Where a list's paper shows up, and nowhere else:
- **Home:** the list card *is* the present. Paper on the cover, a ribbon band across it, and a round gift tag carrying the gift count.
- **List page:** a short strip of the same paper across the top, torn along the bottom edge, with the list title sitting below it on plain cocoa.
- **Share page:** the same strip, so givers see the same present.
- **Share link preview:** the paper becomes the preview image when the link is sent in a message.

The three thin stripes under the header from the mockup stay as the app's signature, and get reused in exactly two more places: the loading bar and the active-tab marker.

## 4. Personality details

Small, consistent touches rather than more colour.

- **Gift tags.** Counts, countdowns and prices-on-the-share-page sit on a tag shape: rounded rectangle, one clipped corner, a punched hole. One shape, reused.
- **Stickers.** Status badges look like round stickers, slightly rotated (2–4°): `#1`, `New`, `Price drop`, `Taken`. Rotation is the only "messy" thing allowed.
- **Chunky press.** Buttons and cards have a solid 3px darker bottom edge instead of a soft shadow, and sink 2px when pressed. No blurry glows anywhere.
- **Round corners, one size per thing.** 18px cards, 14px buttons and inputs, full-round for tags and stickers.
- **Icons.** One line-icon set, 2px stroke, rounded ends. No emoji in the interface (they render differently on every phone and break the look). Category icons get redrawn in this set.
- **Friendly words.** Empty states and confirmations get a line of voice: "Nothing wrapped yet", "Added to the pile", "Shh, it's a surprise".
- **Empty-state drawing.** One simple illustration style (flat shapes, the five colours): an unwrapped box for an empty list, a stack of presents for no lists.

## 5. Animations

Each one has a purpose; all are short (150–350ms) and use the same springy ease so the app feels like one thing.

| Moment | Animation |
|---|---|
| Opening a list | The card's paper expands into the top strip of the list page (the present "opens"). |
| Pasting a link | The three signature stripes run across the paste box as a loading bar; the new gift card then drops in with a small bounce. |
| Rating | Stars fill left to right, the last one pops. |
| Ranking | The card lifts and tilts 2° while dragged; the others slide aside; rank stickers flip to their new numbers. |
| Countdown | The number counts up from 0 once when the page loads. |
| Giver taps "I'll get this" | A ribbon wraps across the card and a "Taken" sticker stamps on, with a short burst of paper confetti in the five colours. This is the one big celebratory moment in the app. |
| Buttons and cards | Sink on press (section 4). |
| Page changes | Slide in the direction of travel (see swipe, below). |

Guardrails: nothing loops forever, nothing moves while you are reading, and everything is skipped for people whose phone is set to "reduce motion".

## 6. Swipe navigation

Swipe goes in one direction only (sideways between siblings), so it never fights with scrolling or dragging.

- **Bottom tab bar** on phones with three pages: **Lists**, **Coming up**, **Categories**. Swipe left/right moves between them; the three-stripe marker slides under the active tab. On desktop the same three sit in the top bar.
  - *Coming up* is new: one timeline of every dated occasion, soonest first, each as a tag with its countdown.
- **Inside a list:** the category chips become swipeable pages. Swipe left from "All" to see Clothes, then Tech, and so on. The chip row follows along.
- **Between lists:** on a list page, swiping from the title strip goes to the next or previous list, so you can flip through your presents without going home.
- **Gift editor:** opens as a sheet from the bottom; swipe down to close.
- **Not swipeable on purpose:** individual gift cards (drag is used for ranking, and swipe-to-delete causes accidents).

Built with the browser's native scroll snapping, so it feels like a real app and still works with a mouse, keyboard and screen reader. Every swipe has a tap equivalent.

## 7. Screen by screen

- **Home (Lists):** greeting, paste box, the "next up" present as a large card with its paper and a countdown tag, then a two-column grid of presents.
- **List:** paper strip, title, totals on a tag, paste box, category pages, gift cards. Gift cards stay plain (cream photo tile, cocoa body) so the products are the colour.
- **Gift editor:** plain cocoa sheet. Only the save button is mustard. Size and colour rows look like small tags.
- **Share page (givers):** same paper strip, teal as the action colour instead of mustard so it is clearly "the giver side", ribbon-and-confetti moment on claim.
- **Categories:** each category is a sticker with its icon; your own sit above the built-in ones.

## 8. Build order

1. ✅ **Foundation:** swap the colour and type tokens site-wide, chunky buttons, new icon set, remove emoji. (The whole app changes look in one step.)
2. ✅ **Wrapping paper:** the six papers, paper picker on lists, present cards on home, paper strip on list and share pages.
3. **Tags and stickers:** tag and sticker shapes, applied to counts, countdowns, ranks and statuses; empty-state drawings.
4. ✅ **Swipe:** bottom tab bar, the "Coming up" page, swipeable category pages, swipe between lists, bottom-sheet editor.
5. ✅ **Motion:** the animations in section 5, ending with the claim celebration.
6. **Polish pass:** check every screen on a small phone and a desktop, contrast check, reduced-motion check.

Steps 1–5 are live, plus the tag and sticker shapes from step 3 (counts, totals, prices, ranks, "Taken"). Still to do from step 3: empty-state drawings. The share-link preview image from §3 is not built yet.

Each step leaves the live site in a finished-looking state, so it can go out as it is done.

## 9. Open choices

- **Paper picker:** let people choose any paper for any list (recommended), or always assign by occasion.
- **Heading font:** Shrikhand is the most characterful; if it feels too loud on real screens, the fallback is a softer rounded serif used the same way.
