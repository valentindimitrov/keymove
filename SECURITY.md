# Security policy

## Report a vulnerability privately

Use [GitHub's private vulnerability reporting](https://github.com/valentindimitrov/keymove/security/advisories/new)
or email [keymove.impulse550@passmail.com](mailto:keymove.impulse550@passmail.com).
Do not report vulnerabilities in public issues or Discussions.

Include the affected version or commit, browser and operating system, steps to reproduce,
and the expected security impact. A small example page is useful. Remove credentials and
personal page content; use test data when demonstrating a problem.

The maintainer will investigate and coordinate a fix and disclosure with the reporter.
This is an independently maintained project; there is no guaranteed response time or bounty.

## Supported versions

KeyMove is currently preparing its first browser-store release. Security fixes target the
current `main` branch. Older development snapshots do not receive separate security updates.
Use the latest available version when verifying a report.

## Isolation from the page

KeyMove runs inside every page it searches, so it treats page script as untrusted. Its
interface is attached to the page in a shadow root, and in shipped builds that root is
**closed**. Page script then gets `null` for the host's `shadowRoot` and cannot read what
KeyMove shows or drive its controls.

This matters most for frames. KeyMove searches inside embedded frames, including frames
from other origins whose content the browser keeps from the embedding page. Results from
those frames appear in KeyMove's interface, so with an open root the embedding page could
read their text, image addresses and result counts, or set the query itself. The outline
layer KeyMove draws inside child frames is closed for the same reason.

The decision, made in November 2026 after a code review found the leak, was to close the
roots rather than search same-origin frames only, which would have dropped searching
inside embedded forms, documents and widgets.

What a closed root does not hide:

- Key events travel outside shadow roots, so a page can still see what is typed into
  KeyMove, as it can for any typing on the page.
- A page can tell where KeyMove's interface covers the page, for example with
  `elementFromPoint`, and so whether a search has visible results.
- Highlight ranges registered with the CSS Custom Highlight API, inside the page or a
  frame, are readable by that document's own script.

Two paths that could carry frame content into the page are closed separately: copying a
result in KeyMove stops the copy event before page listeners can read its clipboard data,
and the larger image viewer is unavailable for images from frames, since loading one in the
page would record its address in the page's Resource Timing entries.

Test builds keep the roots open so the browser suite can inspect them: `pnpm
build:chromium:test` writes `.output/chrome-mv3-test`, which the Playwright suite and the
capture tools load. An explicit build constant, defined only in test mode and in the unit
test, preview and website configurations, opens them; no environment variable does, and a
test build names itself "(test build)", which release validation rejects.
`tests/browser/closed-root.spec.ts` runs against the production build and checks that its
roots are closed while keyboard navigation, selection, copying and activation still work.
Never load a test build in a regular browser profile, and never publish one.

KeyMove reaches its own closed roots by reference, never through page-readable values.
Hosts left by an earlier copy, which a newer copy removes after an update, are read through
the extension-only closed-root accessor where the browser provides one (Chromium and
Firefox); Safari's support for it is unverified.
