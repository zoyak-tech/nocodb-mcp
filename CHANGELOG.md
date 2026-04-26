# Changelog

All notable changes to `nocodb-mcp` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/zoyak-tech/nocodb-mcp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/zoyak-tech/nocodb-mcp/releases/tag/v1.0.0
[0.3.0]: https://github.com/zoyak-tech/nocodb-mcp/releases/tag/v0.3.0
[0.2.0]: https://github.com/zoyak-tech/nocodb-mcp/releases/tag/v0.2.0
[0.1.0]: https://github.com/zoyak-tech/nocodb-mcp/releases/tag/v0.1.0
[0.0.1]: https://github.com/zoyak-tech/nocodb-mcp/commit/1789e9d
