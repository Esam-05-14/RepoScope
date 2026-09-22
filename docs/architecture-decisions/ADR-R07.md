# ADR-R07: GitHub locators clone into application-owned cache

**Status:** Accepted

## Problem

Users want to paste a GitHub repository link and get the same observed-dependency graph as a local folder. The confinement contract still forbids browser-supplied filesystem paths, remote analysis services, GitHub OAuth, and installing or executing the inspected project.

## Decision

Accept only `https://github.com/{owner}/{repo}` locators (plus `github:owner/repo` and `owner/repo` when that path does not exist locally). Reconstruct the clone URL. `git clone` / `git fetch` run through `execFile` argument arrays into `~/.reposcope/clones` (or `REPOSCOPE_CACHE`). Hooks and LFS smudge filters are disabled. The existing confined scanner then reads that cache. No `npm install`, no project scripts, no GitHub API token flow.

## Alternatives

- GitHub API file fetch without clone: more moving parts, rate limits, weaker evidence hashes.
- Browser-supplied local paths: rejected by the confinement contract.
- Hosted remote analysis: out of product scope.

## Impact

A GitHub locator is not a filesystem path. Clones are application-owned writes, not writes into a user-selected repository. Private repositories still require the machine's existing Git credentials; RepoScope does not collect a password in the UI.
