# Contributing to KeyMove

Report reproducible bugs through the [bug-report form](https://github.com/valentindimitrov/keymove/issues/new?template=bug_report.yml).
Use [Q&A](https://github.com/valentindimitrov/keymove/discussions/categories/q-a) for help and
[Ideas](https://github.com/valentindimitrov/keymove/discussions/categories/ideas) for feature proposals.
Discuss substantial changes before implementing them. Maintainers can create linked implementation
issues once a proposal is ready. Follow [SECURITY.md](SECURITY.md) for private vulnerability reports.

## Make a change

1. Fork the repository and create a focused branch. Keep concurrent implementation tasks in
   separate worktrees as described in the [development workflow](docs/development.md).
2. Check the Node requirement in `package.json` and run `yarn install --frozen-lockfile`.
3. Read [AGENTS.md](AGENTS.md) for runtime, accessibility, privacy, and licensing invariants.
   Keep each change focused; reproduce bugs before fixing them and preserve unrelated work.
4. Verify the affected behavior. Documentation needs a diff and link review plus `git diff --check`.
   Website changes follow [website/AGENTS.md](website/AGENTS.md). Extension or shared-code changes
   require `yarn quality` and the relevant rendered or installed-browser checks described in
   [the development workflow](docs/development.md).
5. Open a pull request against `main` using the supplied template. Explain the problem, resulting
   behavior, and verification. Explain checks that do not apply. The `quality` check must pass;
   it does not replace the required local browser checks.

See the [command and architecture reference](docs/development-reference.md) for build and preview
commands. Generated builds, dependencies, credentials, and personal data do not belong in commits.
Keep discussion respectful and focused on the work.

## Contribution licensing

Only submit work you have the right to contribute. By submitting original code or documentation
for inclusion, you agree to license it under Apache License 2.0. Changes to inherited or adapted
YipYip code must also preserve its BSD 4-Clause terms and notices. See [LICENSE](LICENSE) for the
scope and complete texts; the combined project is not Apache-only.

Identify third-party material and its source and license in the pull request. Do not remove
upstream attribution or assume that an unanswered relicensing request grants permission.
