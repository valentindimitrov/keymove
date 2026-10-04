# Publication review — October 4, 2026

The pre-publication review covered the history published on `origin/main` through
`781dbfe96b6dbad85ad4fc57d493228d065cab7e`, plus the available GitHub Actions logs and
repository discussion surfaces. It did not include unpushed local work.

- Gitleaks 8.30.1, downloaded from its official release and checked against its published
  SHA-256 checksum, scanned 175 commits with its default rules and inline allow comments
  disabled. It reported no secrets.
- The same scanner checked 44 available log archives across 43 Actions runs, including a
  retried run. Archives were processed in memory; raw logs were not saved. It reported no
  secrets. One additional queued run had no logs available at review time.
- Issue bodies, issue comments, pull-request review comments, commit comments, and release
  text were scanned with no findings. There were no Discussions or uploaded Actions artifacts.
- The historical `.env` file contained a build setting, `INLINE_RUNTIME_CHUNK`, rather than
  credentials. The committed CRX signing key is a public key. Signing documentation identifies
  the external vault and item, but contains no private-key material.
- GitHub Actions uses a read-only default token and cannot approve pull requests. Deployment
  skips fork pull requests; signing credentials are scoped to the manual release signing step.

This is a dated automated secret-scan result and configuration review, not a guarantee that
every sensitive value or security defect can be detected. Recheck new commits, release assets,
and workflow changes as the project evolves. Report vulnerabilities using [SECURITY.md](../SECURITY.md).
