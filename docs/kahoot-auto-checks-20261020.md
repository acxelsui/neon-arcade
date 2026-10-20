# Kahoot adaptation verification — 2026-10-20

The supplied Go auto-answer reader was adapted into a browser panel; its legacy connection and authentication code is not used. The later pasted AutoSolver 1.0.3 script was reviewed as source, not executed wholesale or installed.

The pasted script depends on quiz metadata or answers already available in the player. Its random fallback, original-index fallback after a failed text match, and inferred slider values cannot establish correctness. Its OK counter counts informed attempts rather than confirmed results. Broad selectors, multiple synthetic click paths, and parsing counters by concatenating every digit can also cause incorrect actions. These behaviors were not imported. Explicit question-title/test-id selectors and wrapped quiz JSON support were incorporated into the stricter reader.

The native panel requires a unique exact question and full answer-set match, follows reordered choice text, defaults auto-selection off, submits once for the matched screen, and leaves unsupported or shape-only screens manual. No private answer access, CAPTCHA handling, score alteration, or password collection was added.

Verified locally:
- Official Kahoot PIN entry screen loads through the existing proxy with the native panel.
- Public quiz metadata loads through the real transport (Fractions, Decimals & Percents, cfab5b29-3f41-49be-a58b-58bef206e226).
- Simulated reordered question selects 0.25 correctly, then leaves the submit control disabled.
- Closing the launcher removes the panel and returns to the launcher library.
- 527 automated tests pass, including all 24 permutations of the four-choice answer order, denied metadata access, conflicting questions, and unsupported types.
- Production build succeeds; its temporary index rewrite was restored.

Not verified: a live hosted round, actual score results, or unsupported question types. No active lobby/key pair was supplied during this check. A simulated question is not evidence of a live game result. The localhost development fixture is excluded from the commit and does not alter the production access gate.

## New custom session panel

The old third-party client is replaced by Neon's own browser script and UI. The session panel was rewritten with PIN/nickname entry, explicit public quiz discovery, highlighting, delay selection, collapsible source controls, and an attempted-selection counter. Public discovery reads official quiz references in links or bounded application/json metadata. It never treats a game PIN or unrelated session UUID as a quiz key.

Live verification: the panel submitted PIN 211004 and the nickname NeonPlayer through the proxied official Kahoot player. The player displayed “You're in!” and NeonPlayer in its waiting lobby. The waiting player exposed no public quiz reference, so no key was obtained from the PIN and no live answer correctness was verified. The preview tab subsequently closed; it was not rejoined.

Simulation verification: an explicitly labeled local fixture supplied a public quiz reference as page metadata. The new script discovered the reference, loaded the public key, highlighted the correct reordered choice, selected it once when enabled, and kept its counter at one. The same fixture stayed idle with no answer key. This is a simulated question, not a live scored round.

530 automated tests pass; the final compact UI also passed its focused tests and browser check. The production build succeeds. These changes are saved locally and have not been published.

## Movable panel and faster matching

Added header dragging using the existing bounded pointer and keyboard controller, with cleanup on closing the launcher. The preview moved from left 214/top 65 to left 198/top 81 using its arrow-key handle. The same controller's pointer movement, bounds, and cleanup tests pass. Expanded/collapsed panel bounds are rechecked.

Selection delay defaults to 100 ms, with 100 ms screen checks. This is a scheduling target, not a measured end-to-end network latency. Encoded quiz text and case differences are normalized, while conflicting prompts and missing choice mappings remain manual. A question selector can review the loaded answer key without mapping or clicking a shape-only screen.

The simulated reordered question still selects the correct answer once. No new live correctness or PIN-only answer discovery was verified. The user declined to provide the failing quiz link, so its specific failure remains unreproduced. No 95–100 percent live accuracy claim is supported.
