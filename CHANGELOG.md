# Changelog

All notable changes to `nocodb-mcp` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.4] — 2026-04-26

### Fixed — silent data loss in field creation with options/meta (CRITICAL)

**Bug:** field-creation tools were spreading the `options` object into the
request body instead of nesting it. NocoDB v3 META API ignores top-level
unknown keys silently, so calls like:

```ts
create_field({ uidt: 'SingleSelect', options: { choices: [...] } })
```

would create a SingleSelect field with `choices: []` — **no error, no warning,
just empty data**. Same for `MultiSelect`, `Formula` (formula text lost),
`LinkToAnotherRecord` (relation config lost), Number `precision`, etc.

**Fix:** pass `options` as a wrapped object verbatim, plus added a separate
top-level `meta` parameter for field-metadata flags like `richMode`. Both
are now sent through to NocoDB exactly as received.

Affected tools (all fixed):
- `create_field` — options + meta now correctly wrapped
- `update_field` — same
- `bulk_create_fields` (in schema-ops) — same
- `create_table` (when `fields[]` is provided) — same
- `clone_table` — now also preserves `options` from source (was losing it)
- `clone_base` — same
- `import_base_schema` — same

### Added

- New `meta` parameter on `create_field` / `update_field` / `bulk_create_fields`
  / table fields for field metadata flags (e.g. `{ richMode: true }` for
  rich-text LongText). Previously `meta` had to be smuggled into `options`
  and was silently dropped.

### Changed

- `create_field` description rewritten with clearer per-type examples that
  explicitly nest config under `options` (e.g. `options: { choices: [...] }`
  not `options.choices`).

### Verified live

End-to-end test against NocoDB 2026.04.3:

```
POST .../fields  with options: { choices: [Draft, In Progress, Done] }
  →  before v1.0.4: HTTP 200 + options.choices == []  (silent loss!)
  →  after v1.0.4:  HTTP 200 + options.choices == [Draft, In Progress, Done]  (fixed)
```

## [1.0.3] — 2026-04-26

### Fixed — accurate v3 UIDT list + create_link_field

Verified the live v3 META API rejects 6 of the 40 UIDT values that
were in the MCP's `FIELD_TYPES` enum. Fixing this avoids confusing
404/400 errors when an AI agent picks one of these from the schema:

- `RichText` — not a separate type. For rich text use `LongText`
  with `options.meta.richMode = true`.
- `GeoData` — replaced by `Geometry`.
- `SpecificDBType` — legacy escape hatch, removed.
- `AutoNumber` — system-managed only, cannot create via API.
- `ID` — system-managed.
- `ForeignKey` — system-managed.

`FIELD_TYPES` now matches the v3 API allow-list exactly (34 entries).

Also fixed `create_link_field` (in tools/links.ts), which had two
bugs that made it broken on v3:

- Sent `uidt: 'LinkToAnotherRecord'` instead of `type: 'LinkToAnotherRecord'`
- Sent the relationship type (hm/mm/bt/oo) at top level, which conflicted
  with the UIDT key. Now correctly nested under `options: { relatedTableId,
  type }`.

### Changed

- `create_field` description now lists common option patterns including
  `meta.richMode: true` for rich text — guides AI agents to the correct
  call shape.
- README:
  - field-types list updated from 40 → 34 with note about rich text and
    system fields
  - "All 40 v3 field types" → "All 34 v3 field types" in feature highlights

## [1.0.2] — 2026-04-26

### Fixed — `create_field` and field creation across all tools

Discovered through live testing against NocoDB 2026.04.3 Community
Self-hosted: the v3 META API renamed the field-type body parameter
from `uidt` (legacy v2 name) to `type`. The MCP server was still
sending `uidt`, causing every field-creation request to fail with
HTTP 400 `ERR_INVALID_REQUEST_BODY: 'type' is required`.

Affected tools (all fixed):
- `create_field` — body now sends `type` instead of `uidt`
- `create_table` (when fields[] is provided) — same
- `clone_table` — also reads `type ?? uidt` from the source for
  forward+backward compatibility
- `bulk_create_fields` (in schema-ops) — same
- `clone_base` (in schema-ops) — same
- `import_base_schema` (in schema-ops) — same

The MCP-side input parameter remains `uidt` for clarity and stability
of the public tool interface. The translation `uidt` → `type` happens
inside the request body construction.

Verified live: POST .../fields with `{ "type": "SingleLineText" }`
returns 200 + new field ID.

### Notes

This fix only matters for **field/table creation** flows. Read,
update, and delete operations were already using the correct names
and were not affected.

Listing tools (`list_fields`, `get_field`, `get_table`) returned the
field type under both `type` and `uidt` keys depending on endpoint —
the cleanup loops in clone_*/import_* now handle either.

## [1.0.1] — 2026-04-26

### Fixed — Docker / Dokploy / Coolify / Railway compatibility

The Docker image shipped in v1.0.0 had two bugs that made it unusable in
container PaaS environments:

- **`HOST` defaulted to `127.0.0.1`** — server bound to loopback only inside
  the container, so reverse proxies (Dokploy, Coolify, Traefik, etc.) could
  not reach it. Now defaults to `0.0.0.0`. Override with `HOST=127.0.0.1` for
  local-only.
- **`Dockerfile CMD` ran `dist/index-stdio.js`** — stdio mode is meaningless
  inside an HTTP-exposed container. Now runs `dist/index-http.js`.

### Added

- `Dockerfile` `HEALTHCHECK` directive — polls `/health` every 30s. Dokploy /
  Coolify / Kubernetes will use this signal.
- `Dockerfile` `EXPOSE 3000` — explicit port declaration.
- `docker-compose.yaml` — ready-to-use example with health check, environment
  block, restart policy.
- README sections for **Docker**, **Docker Compose**, **Dokploy / Coolify /
  Railway / Render / Fly** with copy-paste snippets.

### Notes

- Smithery deploys are unaffected — `smithery.yaml` overrides the `CMD` to run
  stdio, which is what Smithery expects.
- `npx -y nocodb-mcp` (stdio for Claude Code etc.) is unaffected — only the
  HTTP entrypoint defaults changed.

## [1.0.0] — 2026-04-26

### Added — Phase 4: HTTP transport, Smithery, Docker

- **`src/index-http.ts`** — Streamable HTTP transport entrypoint (the
  modern replacement for SSE in the MCP spec). Single endpoint
  `POST/GET/DELETE /mcp` plus `/health`. Stateful by default
  (session ID per client) or stateless via `MCP_STATELESS=true`.
- **Second binary**: `nocodb-mcp-http` for `npx` HTTP deploys.
- **`smithery.yaml`** — Smithery deployment config with full
  `configSchema` for one-click cloud deploys.
- **`Dockerfile`** — multi-stage build (Node 20-slim), production
  image with only `dist/` and runtime deps.
- **`.dockerignore`** — keeps the image lean.

### Changed

- `src/server.ts` — exports `SERVER_VERSION` constant for HTTP health
  check, bumped to 1.0.0.
- `package.json` — added second binary, refreshed description.
- README rewritten end-to-end:
  - install snippets for Claude Code, Claude Desktop, Cursor, HTTP,
    Docker, Smithery
  - configuration table
  - 92 tools listed by group with notes on field types, view types,
    filter operators, webhook events
  - example AI prompts mapped to tool calls

### Stability

- Stateful HTTP transport persists session IDs across reconnects
- Graceful shutdown on SIGINT/SIGTERM
- 13 tests still passing

## [0.3.0] — 2026-04-26

### Added — Phase 3: schema-ops, comments, scripts, dashboards, workflows, docs (+34 tools)

- **schema-ops.ts** ⭐ (3): `bulk_create_fields` (create many fields atomically
  with per-field success reporting), `clone_base` (full structural clone
  into same workspace), `import_base_schema` (recreate base from JSON
  document — accepts inline object or file path).
- **comments.ts** (5): record comment lifecycle + `resolve_comment`.
- **scripts.ts** (5): full CRUD for NocoDB Scripts feature.
- **dashboards.ts** (10): dashboards CRUD + `get_dashboard_data` + widgets CRUD.
- **workflows.ts** (5): list, get, execute, list executions, get execution.
- **docs.ts** (6): NocoDocs CRUD (shipped in NocoDB 2026.04.2) + reorder.

### Changed

- 19 tool groups registered in `server.ts`
- 92 unique tools (was 58 in v0.2.0)
- Lines of code: ~3.5k (+0.9k)

## [0.2.0] — 2026-04-26

### Added — Phase 2: full feature parity + the gaps

- **Views** (5 tools): `list_views`, `get_view`, `create_view`, `update_view`,
  `delete_view`. Supports all 6 v3 view types (grid, gallery, kanban, form,
  calendar, map — the last shipped in NocoDB 2026.04.0).
- **Filters** (5 tools): `list_filters`, `create_filter`, `set_filters`
  (atomic replace), `update_filter`, `delete_filter`. Covers all 21 v3
  comparison operators including `allof`, `anyof`, `isWithin`.
- **Sorts** (4 tools): `list_sorts`, `create_sort`, `update_sort`,
  `delete_sort`.
- **Webhooks** (5 tools): full lifecycle for all 6 event types
  (`after.insert`/`update`/`delete` + bulk variants) and 7 delivery
  channels (URL, Email, Slack, Discord, Teams, Whatsapp, Twilio).
- **Links** ⭐ (4 tools): `create_link_field` (LinkToAnotherRecord with
  `hm`/`mm`/`bt`/`oo`), `list_linked_records`, `link_records`,
  `unlink_records` — full relational data management without UI.
- **Attachments** (2 tools): `upload_attachment_to_record` (multipart
  upload of local file) and `attach_url_to_record` (NocoDB downloads
  remote URL server-side).
- **Import / Export** ⭐ (5 tools):
  - `import_csv_to_new_table` with **automatic field-type inference**
    (Number, Decimal, Checkbox, Date, DateTime, LongText, SingleLineText)
  - `import_csv_append`, `import_json_records` with configurable batching
  - `export_table_json` with built-in pagination (cap 10k by default)
  - `export_base_schema` — full structural dump (tables + fields + views
    + filters + sorts) as a portable JSON document for templating/backup.

### Changed

- Built-in RFC 4180 CSV parser — no third-party dependency for CSV.
- Server now registers 13 tool groups; total **58 unique tools**
  (was 28 in v0.1.0).
- Bumped MCP server `name` version to 0.2.0.

### Stats

- Lines of code: ~2.6k (+1.2k)
- Files in `src/tools/`: 13 (+7)
- Dependencies still: just MCP SDK + zod
- npm package: 32.8 kB tarball / 153 kB unpacked

## [0.1.0] — 2026-04-26

### Added — Phase 1: bases, tables, fields, records

- **Workspaces** (1 tool): `list_workspaces` — needed for base creation.
- **Bases** (5 tools): `list`, `get`, `create`, `update`, `delete`. The
  delete supports `dry_run: true` for safe AI invocation.
- **Tables** (6 tools): full CRUD plus `clone_table` (structure only).
- **Fields** ⭐ (7 tools): `list`, `get`, `create`, `update`, `delete`,
  `reorder`, `bulk_rename` — covers **all 40 v3 UIDT field types**
  (SingleSelect, MultiSelect, Formula, LinkToAnotherRecord, Attachment,
  CreatedBy, LastModifiedBy, Button, etc). This is the gap other NocoDB
  MCPs leave open.
- **Records** (8 tools): `list`, `get`, `create_bulk`, `update_bulk`,
  `delete_bulk`, `upsert`, `count`, `global_search` (multi-table
  substring search). Supports the new v3 quoted `where` syntax.

### Safety

- All destructive tools (`delete_*`) accept `dry_run: true` to return
  a preview of the affected entities without touching anything.

## [0.0.1] — 2026-04-26

### Added — Phase 0: bootstrap

- TypeScript project, Node 20+, ES2022, NodeNext modules
- `@modelcontextprotocol/sdk` + zod
- `NocoDBClient` thin fetch wrapper with v1/v2/v3 API version support,
  AbortController-based timeout, structured `NocoDBError`
- Single tool: `ping_nocodb`
- Vitest + Biome + GitHub Actions CI on Node 20 and 22
- MIT license

[Unreleased]: https://github.com/zoyak-tech/nocodb-mcp/compare/v1.0.4...HEAD
[1.0.4]: https://github.com/zoyak-tech/nocodb-mcp/releases/tag/v1.0.4
[1.0.3]: https://github.com/zoyak-tech/nocodb-mcp/releases/tag/v1.0.3
[1.0.2]: https://github.com/zoyak-tech/nocodb-mcp/releases/tag/v1.0.2
[1.0.1]: https://github.com/zoyak-tech/nocodb-mcp/releases/tag/v1.0.1
[1.0.0]: https://github.com/zoyak-tech/nocodb-mcp/releases/tag/v1.0.0
[0.3.0]: https://github.com/zoyak-tech/nocodb-mcp/releases/tag/v0.3.0
[0.2.0]: https://github.com/zoyak-tech/nocodb-mcp/releases/tag/v0.2.0
[0.1.0]: https://github.com/zoyak-tech/nocodb-mcp/releases/tag/v0.1.0
[0.0.1]: https://github.com/zoyak-tech/nocodb-mcp/commit/1789e9d
