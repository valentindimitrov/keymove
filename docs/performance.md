# Search performance investigation

Measured on Windows in Vivaldi 8.2.4133.52 on 2026-09-15. The cleanup baseline is
`dfac199`; the version before Unicode support is `09b705e`.

## Reassessing the warning

The cleanup review reported a possible 30% increase in large-page warm latency.
Separate installed-browser runs were not stable enough to attribute that increase
to the code: three new runs of the unchanged cleanup build had warm medians of
42.4, 129.3, and 213.5 ms on the 5,000-block fixture. One baseline run also hit the
existing context-navigation timeout before measurement; its retry passed.

An alternating comparison loaded both versions of the real search modules into
the same browser page, rebuilding the same DOM fixture for each sample. Before
optimization, warm medians for the original and cleanup versions were:

| Filler text | Before Unicode | Cleanup with Unicode |
| --- | ---: | ---: |
| ASCII | 40.45 ms | 40.05 ms |
| Cyrillic | 41.90 ms | 43.00 ms |
| Decomposed accents | 40.65 ms | 41.90 ms |

This comparison did not reproduce a 30% Unicode penalty. It does not prove zero
overhead on every page. The original warning should be treated as inconclusive,
not as an established regression caused by Unicode support.

A candidate smoke run also stopped at `Installed extension service worker not
found`, after the small-fixture checks. The harness looks for a live worker before
opening settings; an installed MV3 extension need not have one running at that
moment. Chrome normally stops idle workers after 30 seconds and restarts them for
incoming events ([Chrome lifecycle documentation](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)).
Worker suspension is a plausible cause of this lookup failure, not a confirmed
extension startup failure. That run is retained separately from successful timing
samples. The harness should identify the extension from the settings target after
opening it instead of requiring a live worker beforehand.

## Changes supported by profiling

Exact scoring split every text block and searchable attribute into words before
checking whether it contained the query. Word boundaries only affect the rank of
matching fields. Moving tokenization after that check avoids allocations and word
comparisons for nonmatches while preserving the existing score and boosts.

ASCII-only strings are already NFC and contain neither non-breaking spaces nor
Greek final sigma. An ASCII check lets those strings use lowercase conversion
directly. Non-ASCII strings retain NFC normalization, Unicode case conversion,
space normalization, and sigma folding. Highlight offset mapping is unchanged.

No search scheduling, cancellation, extension injection, or cross-query DOM cache
was changed. These optimizations do not delay input or weaken visibility checks.

## Controlled optimization comparison

Three fresh browser sessions compared the cleanup modules with the optimized
modules. Each session used two warm-up rounds followed by six measured rounds,
alternating version order. Each version searched a freshly constructed page with
5,000 filler blocks and four matching blocks, using a first query and three warm
prefix extensions with distinct expected result counts. Every count was checked.

The table reports the median of the 18 paired ratios per language, using each
round's median warm query time. Pairing avoids comparing samples from widely
different execution conditions. Negative values mean less time.

| Filler text | Warm change | First-query change |
| --- | ---: | ---: |
| ASCII | -8.2% | -17.6% |
| Cyrillic | -4.2% | +0.6% |
| Decomposed accents | +0.2% | -9.7% |

The small non-ASCII differences are close to measurement noise. The useful result
is a modest ASCII improvement with no observed material Unicode regression.
The comparisons used the real source modules served by Vite and CPU profiling;
they measure index/search completion, not production UI paint or extension RAM.
Installed production smoke is a separate correctness and end-to-end timing check.

DOM visibility/style checks and rendered-text traversal remain substantial work.
Caching those results across queries would need to handle changing ancestor
styles and layout, not only text mutations. That requires its own correctness
and performance investigation rather than assuming cached text stays visible.

## Verification and repetition

Ranking cases cover word starts, substring matches, attributes, non-breaking
spaces and Cyrillic. Existing tests cover Unicode normalization, DOM-boundary
highlight mapping, fuzzy matching, dynamic indexing and cancellation.

Use `yarn quality` and then `yarn test:browser:built` to verify production builds.
Save `.artifacts/browser-smoke.json` for each run; do not compare a single result
with a run taken under different machine conditions. See
[development.md](development.md#responsiveness-contract) for the timing contract.

The local investigation retains the comparison runner, raw samples and Chromium
CPU profiles under `.artifacts/` in the `keymove-search-performance` worktree:
`profile-search.mjs`, `baseline-profile.*`, `comparison-{1,2,3}.*`, and
`comparison-summary.json`. The runner loads source snapshots named by
`PERF_BASELINE_ROOT`; it deliberately measures both versions in one page.
