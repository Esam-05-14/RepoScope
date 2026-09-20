# 09 API and investigation experience

## Screens

| Route | Job |
| --- | --- |
| `/` | Demo or CLI-selected repository: no root, ready, scanning, canceled, failed, partial |
| `/explore` | Search and bounded graph: empty, filtered, selected, oversized, evidence unavailable |
| `/coverage` | File and construct coverage |
| `/compare` | Two compatible snapshots |
| `/settings` | Limits and clear local analysis data |

Three-pane desktop: file tree, graph or list, evidence. At 1024px collapse the tree. At 768px the list is primary and evidence is a sheet.

## API

| Endpoint | Constraint |
| --- | --- |
| `POST /api/scans` | CLI-approved root only |
| `GET /api/scans/:id` | Real progress; no fake percent |
| `DELETE /api/scans/:id` | Canceled ≠ completed |
| `GET /api/snapshots/:id` | Bounded payloads |
| `GET /api/evidence/:observationId` | ID lookup, hash check, size cap |
| `POST /api/compare` | Snapshot ids, no paths |

Errors: stable `code`, user message, non-sensitive diagnostic id. No absolute paths or raw source in generic logs.

## UI limits to test

First rendered graph: 250 nodes, 500 relations, with explicit expansion and truncation. Arrow convention is visible. Keyboard search, Escape closes inspector, focus restoration, accessible relation list.
