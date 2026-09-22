# Security policy

RepoScope is local, read-only analysis software. The inspected repository, its filenames, configuration, imported snapshots, and source text are untrusted.

## Reporting a vulnerability

Do not invent or use a fabricated inbox. Prefer [GitHub security advisories](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/privately-reporting-a-security-vulnerability) on this repository. If advisories are not enabled yet, open a private maintainer contact once one is published here.

Please include the RepoScope version (`reposcope --version` or `engineVersion` in a snapshot), the reproduction steps, and whether source or credentials were exposed.

## Local server boundary

- Bind to `127.0.0.1` only.
- Validate `Host` and `Origin` exactly. No wildcard CORS.
- Per-run high-entropy session token, passed through a URL fragment, then kept in memory. API requests use an authorization header.
- The CLI selects the root. Routes accept opaque scan, node, and observation IDs — never arbitrary filesystem paths.

## Filesystem boundary

Canonical path confinement before every relevant read. Default: no symlink or junction traversal. Deny credential files, special files, and oversize inputs. Recheck real paths and content hashes when serving evidence.

Path checks are not an operating-system sandbox. Concurrent mutation can race. Treat changed-file evidence as invalid.

## Data handling

- Default snapshots omit source text and absolute paths.
- Source slices stay in memory during a scan.
- No application-initiated network requests are required after install for a local scan.
- Never render imported HTML or execute code from a snapshot.

## Incident response

Stop the local server, invalidate the session, remove shared exports, review logs for sensitive data, and rotate any real credentials that were exposed.

Private projects may be inspected only locally after read-only and export controls pass. Never publish their snapshots, path lists, source, credentials, or architecture screenshots without a separate review.
