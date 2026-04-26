# nocodb-mcp

[![npm](https://img.shields.io/npm/v/nocodb-mcp)](https://www.npmjs.com/package/nocodb-mcp)
[![CI](https://github.com/zoyak-tech/nocodb-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/zoyak-tech/nocodb-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![NocoDB v3](https://img.shields.io/badge/NocoDB-v3%20%E2%80%A2%202026.04+-1ABC9C)](https://nocodb.com)

> Full-coverage Model Context Protocol (MCP) server for NocoDB v3 — including everything other MCPs miss: **field creation**, **view management**, **webhooks**, **schema export/import**, **CSV import**, **relational links**, **dashboards**, **NocoDocs**, and more.

**92 tools across 19 groups.** Two transports (stdio + HTTP). Works with Claude Code, Claude Desktop, Cursor, and any MCP-compatible client.

---

## Why another NocoDB MCP?

Existing NocoDB MCPs cover only records (CRUD on rows). This one covers the **whole NocoDB v3 API surface** so an AI agent can manage your databases end-to-end without dropping into the UI:

- **Schema operations** — create / update / delete fields, tables, views, filters, sorts. Bulk create fields. Clone bases. Import/export schema as JSON.
- **All 40 v3 field types** — SingleSelect, MultiSelect, Formula, LinkToAnotherRecord, Attachment, Rollup, Lookup, etc.
- **Views** — all 6 types (grid, gallery, kanban, form, calendar, map).
- **Webhooks** — full lifecycle, all 6 events × 7 channels.
- **Relational links** — create relations, link/unlink records.
- **CSV import** with auto type inference. JSON import. Schema export.
- **Dashboards & widgets**, **NocoDocs**, **Scripts**, **Workflows**, **Comments**.
- **Dry-run mode** on every destructive operation — AI agents preview before executing.

---

## Install

### With Claude Code

```bash
claude mcp add nocodb -s user \
  -e NOCODB_BASE_URL=https://your-nocodb.com \
  -e NOCODB_API_TOKEN=nc_pat_... \
  -- npx -y nocodb-mcp
```

### With Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nocodb": {
      "command": "npx",
      "args": ["-y", "nocodb-mcp"],
      "env": {
        "NOCODB_BASE_URL": "https://your-nocodb.com",
        "NOCODB_API_TOKEN": "nc_pat_..."
      }
    }
  }
}
```

### With Cursor / Windsurf / any MCP client

Same idea — point the client at `npx -y nocodb-mcp` with the env variables above.

### Self-hosted HTTP

```bash
NOCODB_BASE_URL=... NOCODB_API_TOKEN=... PORT=3000 npx -y nocodb-mcp-http
```

Then connect any MCP HTTP client to `http://your-host:3000/mcp`. Health check at `/health`.

### Docker

The default `CMD` runs the HTTP transport on `0.0.0.0:3000`, suitable for any container PaaS.

```bash
docker build -t nocodb-mcp .
docker run -d -p 3000:3000 \
  -e NOCODB_BASE_URL=https://your-nocodb.com \
  -e NOCODB_API_TOKEN=nc_pat_... \
  --name nocodb-mcp nocodb-mcp
```

Image includes a `HEALTHCHECK` that polls `/health` every 30s.

### Docker Compose

A ready `docker-compose.yaml` is in the repo:

```bash
NOCODB_API_TOKEN=nc_pat_... docker compose up -d
```

### Dokploy / Coolify / Railway / Render / Fly

All work the same — they auto-detect the `Dockerfile`, build, and deploy. Set env vars through their UI:

| Variable | Value |
|---|---|
| `NOCODB_BASE_URL` | your NocoDB URL |
| `NOCODB_API_TOKEN` | your token |
| `MCP_STATELESS` | `true` if you want horizontal scaling |

The image binds to `0.0.0.0:3000` and exposes `/health` for the platform's health check. No extra config needed.

### Smithery

Deployable via [Smithery](https://smithery.ai) — see `smithery.yaml` in this repo. Smithery overrides the default `CMD` to run stdio (since Smithery wraps stdio servers).

---

## ⚠️ NocoDB Community vs Enterprise

NocoDB gates large parts of the v3 Meta API behind an **Enterprise license** — even though the same features are available **for free in the NocoDB UI**. This is a NocoDB licensing decision, not an MCP limitation.

### Works on **Community Self-hosted** (free)

✅ Connectivity, workspaces, bases (read), tables, fields (CRUD), records (CRUD + bulk + count + global search), filters (list), sorts (list), CSV / JSON import + export, link records, attachments

> Roughly **40–50 of the 92 tools work on free self-hosted**. The exact count depends on which write endpoints NocoDB exposes — some only error on actual write attempts.

### Requires **NocoDB Enterprise** (paid) or **Cloud Business+**

❌ Views (`feature_api_view_v3`)
❌ Webhooks (`feature_api_webhook_v3`)
❌ Dashboards & widgets (`feature_api_dashboard_v3`)
❌ Workflows (`feature_api_workflow_management`)
❌ Scripts (`feature_api_script_management`)
❌ NocoDocs (`feature_docs_apis`) — feature works in UI, API gated
❌ Record comments (`feature_api_comment_v3`)

When you call a gated tool on a Community instance, you'll get a structured error:

```json
{
  "ok": false,
  "status": 402,
  "error": "ERR_LICENSE_REQUIRED",
  "details": { "message": "The \"feature_X\" feature requires an Enterprise license." }
}
```

The MCP server itself runs fine and continues to work for everything else.

### Cloud (`app.nocodb.com`)

Most of these features are tied to NocoDB Cloud's pricing tiers — Free, Team, Business, Enterprise. See [nocodb.com/pricing](https://nocodb.com/pricing).

---

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `NOCODB_BASE_URL` | ✅ | — | NocoDB instance URL (no trailing slash) |
| `NOCODB_API_TOKEN` | ✅ | — | API token from NocoDB → Account → Tokens |
| `NOCODB_DEFAULT_BASE_ID` | — | — | Optional default base ID |
| `NOCODB_TIMEOUT_MS` | — | `30000` | HTTP timeout for NocoDB calls |
| `NOCODB_LOG_LEVEL` | — | `info` | `debug` / `info` / `warn` / `error` |
| `PORT` (HTTP only) | — | `3000` | HTTP server port |
| `HOST` (HTTP only) | — | `0.0.0.0` | Bind address (set to `127.0.0.1` for loopback only) |
| `MCP_STATELESS` (HTTP only) | — | `false` | Set to `true` to disable session IDs |

See [`.env.example`](.env.example).

---

## Tool surface — 92 tools across 19 groups

### Connectivity (1)
| Tool | Description |
|---|---|
| `ping_nocodb` | Verify connection, return NocoDB version + accessible workspace count |

### Workspaces (1)
| Tool | Description |
|---|---|
| `list_workspaces` | List all workspaces accessible by the API token |

### Bases (5)
`list_bases`, `get_base`, `create_base`, `update_base`, `delete_base` (dry_run)

### Tables (6)
`list_tables`, `get_table`, `create_table`, `update_table`, `delete_table` (dry_run), `clone_table`

### Fields ⭐ (7)
`list_fields`, `get_field`, `create_field`, `update_field`, `delete_field` (dry_run), `reorder_field`, `bulk_rename_fields`

> Supports all 40 v3 UIDT types: SingleLineText, LongText, Number, Decimal, Currency, Percent, Duration, Rating, Checkbox, SingleSelect, MultiSelect, Date, DateTime, Time, Year, PhoneNumber, Email, URL, Attachment, User, Formula, Rollup, Lookup, LinkToAnotherRecord, Links, Barcode, QrCode, JSON, Geometry, GeoData, SpecificDBType, CreatedTime, LastModifiedTime, CreatedBy, LastModifiedBy, AutoNumber, ID, ForeignKey, Button.

### Records (8)
`list_records` (with v3 quoted `where` syntax), `get_record`, `create_records`, `update_records`, `delete_records` (dry_run), `upsert_records`, `count_records`, `global_search` (cross-table substring)

### Views (5) — 🔒 Enterprise
`list_views`, `get_view`, `create_view`, `update_view`, `delete_view` (dry_run)

> All 6 types: grid, gallery, kanban, form, calendar, map.

### Filters (5)
`list_filters`, `create_filter`, `set_filters` (atomic replace), `update_filter`, `delete_filter` (dry_run)

> 21 operators: eq, neq, like, nlike, gt, lt, ge, le, in, notin, null, notnull, empty, notempty, between, notbetween, allof, anyof, nallof, nanyof, isWithin.

### Sorts (4)
`list_sorts`, `create_sort`, `update_sort`, `delete_sort` (dry_run)

### Webhooks (5) — 🔒 Enterprise
`list_webhooks`, `get_webhook`, `create_webhook`, `update_webhook`, `delete_webhook` (dry_run)

> 6 events × 7 channels (URL, Email, Slack, Discord, Teams, Whatsapp, Twilio).

### Links (4)
`create_link_field`, `list_linked_records`, `link_records`, `unlink_records`

### Attachments (2)
`upload_attachment_to_record` (multipart from local file), `attach_url_to_record` (NocoDB downloads URL)

### Import / Export (5)
`import_csv_to_new_table` (with auto field-type inference), `import_csv_append`, `import_json_records`, `export_table_json`, `export_base_schema` (uses views — partial on Community)

### Schema operations ⭐ (3)
`bulk_create_fields`, `clone_base`, `import_base_schema`

### Comments (5) — 🔒 Enterprise
`list_record_comments`, `create_record_comment`, `update_comment`, `delete_comment` (dry_run), `resolve_comment`

### Scripts (5) — 🔒 Enterprise
`list_scripts`, `get_script`, `create_script`, `update_script`, `delete_script` (dry_run)

### Dashboards (10) — 🔒 Enterprise
`list_dashboards`, `get_dashboard`, `get_dashboard_data`, `create_dashboard`, `update_dashboard`, `delete_dashboard` (dry_run), `list_widgets`, `create_widget`, `update_widget`, `delete_widget` (dry_run)

### Workflows (5) — 🔒 Enterprise
`list_workflows`, `get_workflow`, `execute_workflow`, `list_workflow_executions`, `get_workflow_execution`

### NocoDocs (6) — 🔒 Enterprise
`list_docs`, `get_doc`, `create_doc`, `update_doc`, `delete_doc` (dry_run), `reorder_doc`

> NocoDocs is free in the NocoDB UI but its v3 API is gated behind Enterprise license (`feature_docs_apis`). Same pattern applies to other 🔒 groups above.

### Safety: dry_run

All `delete_*` tools accept a `dry_run: true` parameter that returns a JSON preview of the action without performing it. Use this from AI agents to confirm before committing destructive operations:

```json
{
  "dryRun": true,
  "action": "delete_table",
  "wouldAffect": { "base_id": "p123", "table_id": "m456" },
  "note": "No changes were made. Re-run without dry_run: true to execute."
}
```

---

## Requirements

- **Node.js 20** or newer
- **NocoDB 0.265+** (v3 API). Recommended: latest `2026.04.x`.
- A NocoDB API token (NocoDB → Account Settings → Tokens → Create)

Verify your NocoDB version:

```bash
curl https://your-nocodb.com/api/v1/version
```

---

## Examples

> Talk to your AI agent in plain language; it picks the right tools.

**Schema design:**
> "Create a 'Customers' table in base p_xyz with fields: Name (text, required), Email (email, unique), Status (single select: Lead/Active/Churned), Revenue (decimal currency)."

→ `create_table` + `bulk_create_fields`

**CSV import:**
> "Import `/Users/me/leads.csv` into base p_xyz as a new table called 'Q1 Leads'."

→ `import_csv_to_new_table` (auto-infers field types)

**Cross-table search:**
> "Find any record mentioning 'acme' anywhere in base p_xyz."

→ `global_search` (queries every string field across every table)

**Templating:**
> "Clone base p_xyz into a new base called 'Q2 Pipeline' (same workspace)."

→ `clone_base`

**Webhook setup:**
> "When a new record is added to the Deals table, POST to https://example.com/hooks/deal-created."

→ `create_webhook` with `event=after.insert, operation=URL`

---

## Develop

```bash
git clone https://github.com/zoyak-tech/nocodb-mcp.git
cd nocodb-mcp
npm install
cp .env.example .env  # fill in your NocoDB credentials

npm run typecheck
npm run lint
npm test
npm run build

# Try it locally
NOCODB_BASE_URL=... NOCODB_API_TOKEN=... node dist/index-stdio.js
# Or HTTP:
NOCODB_BASE_URL=... NOCODB_API_TOKEN=... PORT=3000 node dist/index-http.js
```

To register the local build with Claude Code:

```bash
claude mcp add nocodb-dev -s user \
  -e NOCODB_BASE_URL=... -e NOCODB_API_TOKEN=... \
  -- node $(pwd)/dist/index-stdio.js
```

---

## Roadmap

| | Status |
|---|---|
| Phase 1 — bases, tables, fields, records | ✅ v0.1.0 |
| Phase 2 — views, filters, sorts, webhooks, links, attachments, CSV/JSON | ✅ v0.2.0 |
| Phase 3 — schema-ops, comments, scripts, dashboards, workflows, NocoDocs | ✅ v0.3.0 |
| Phase 4 — HTTP transport, Smithery, Docker | ✅ v1.0.0 |
| Future | OAuth, granular permissions, NocoDB self-hosted Enterprise APIs |

See [CHANGELOG.md](CHANGELOG.md).

---

## Contributing

Pull requests welcome. Before submitting:

1. Open an issue first for larger changes.
2. Run `npm run lint && npm test && npm run typecheck`.
3. Follow the existing pattern — one file per tool group in `src/tools/`, register in `src/server.ts`.

---

## License

[MIT](LICENSE) © zoyak-tech

---

> Built for the [Model Context Protocol](https://modelcontextprotocol.io/). Compatible with Claude Code, Claude Desktop, Cursor, and any MCP-aware client.
