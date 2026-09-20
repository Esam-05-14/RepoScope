# ADR-R04: Snapshots before Git

**Status:** Accepted (R0)

Portable source-free snapshot comparison is independently useful and isolates diff semantics from historical filesystem complexity. Git object reading is R6/P1 and must not mutate the worktree.
