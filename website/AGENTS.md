# KeyMove website

## Scope

This directory contains the public demonstration website, navigation-pattern clips, and privacy
policy. Follow the root instructions for worktrees, secrets, signed commits, licensing, and
preserving other work. The verification rules here replace the extension verification workflow
for changes that affect only the website.

The demo imports real extension components and uses `browser-adapter.ts` for browser APIs.
Website changes do not automatically require extension tests; editing those shared components does.
Classify the actual diff and its dependencies before choosing checks.

## Website verification

For website content, styles, media, routes, or website-only configuration:

1. Run Oxfmt on the changed supported files, for example
   `yarn oxfmt --check website/privacy-policy.html website/privacy.css`. Markdown is excluded by
   the repository formatter; review it directly and use `git diff --check`.
2. For TypeScript or JavaScript changes, run `yarn oxlint website` and `yarn typecheck`. The
   repository-wide typecheck is sufficient; it does not execute extension tests or build MV3
   artifacts. Copy, CSS, and media changes do not need it.
3. Run `yarn website:build`; the deployable output is `.output/public`. Check any changed routes,
   static assets, metadata, and links in that output. Legal-page text must remain readable without
   JavaScript.
4. For visible or interactive changes, use `yarn website:dev` or `yarn website:preview` and inspect
   the affected page in a browser. Check desktop and narrow widths, light/dark themes when styling
   changes, and the relevant click and keyboard interactions. For shared header/footer changes,
   check the home, patterns, and privacy-policy pages. Use targeted checks; do not add tests that
   merely repeat static copy.

Do not run `yarn quality`, `yarn test`, `yarn build`, `yarn verify`, `yarn preview`, or extension
browser smoke solely for website-only changes. `yarn preview` launches the installed extension;
`yarn website:preview` serves the website build. Changes only to this instruction file require
the root documentation checks, not a website build or browser check.

If shared extension source, dependencies, or common tooling changes, apply the root extension
verification rules as well. Changes to website adapters or demo interactions need focused website
behavior checks, including message validation when applicable. Recording clips with the actual
extension may require launching it for the recording, without requiring its entire test suite
when extension code is unchanged.

## Production website

- The public site is `https://keymove.minddevops.eu`; its policy is `/privacy-policy`.
- `website/wrangler.jsonc` configures Cloudflare Workers Static Assets. The GitHub Quality workflow
  builds with `yarn website:build` and deploys pushes to `origin/main` after its checks pass.
- Base production edits on the current `origin/main` in the task's isolated worktree. Another
  checkout's local `main` or an older Sites branch can differ from the deployed source.
- The `.openai/hosting.json` manifest identifies a separate Sites-hosted copy. Do not publish there
  as a substitute for a requested change to `keymove.minddevops.eu`, or change its sharing settings
  to make the public domain work.
- Preserve the existing deployment configuration, domain, and social-preview assets. After an
  authorized deployment, verify the exact requested public URL and content without authentication.
  A successful local build or source push alone does not prove the page is live.
- CI currently runs the full repository quality job before website deployment. That is separate
  from the scoped local checks above; do not duplicate those extension checks locally merely to
  mirror CI. Changing CI conditions is a workflow change, not a prerequisite for a website edit.
