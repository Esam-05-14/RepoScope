# Prompt — Commit and push (only when the user asks)

Do not run this during a wave. The user must request a commit.

1. Review `git status` and `git diff`. Stage an explicit path list. Refuse `.env`, credentials, private snapshots, and unexpected binaries.
2. Follow the repository commit-message style. No `--no-verify`, no amend unless the user's rules allow it, no force push.
3. Confirm the remote and branch. Push the current implementation branch only after the user asked to push.
4. Recheck `git status`.
