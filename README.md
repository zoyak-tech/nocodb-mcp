# nocodb-mcp

[![npm](https://img.shields.io/npm/v/nocodb-mcp)](https://www.npmjs.com/package/nocodb-mcp)
[![CI](https://github.com/zoyak-tech/nocodb-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/zoyak-tech/nocodb-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Full-coverage Model Context Protocol (MCP) server for NocoDB v3 — including everything other MCPs miss: **field creation**, **view management**, **webhooks**, **schema export/import**, **CSV import**, and more.

## Why another NocoDB MCP?

Existing NocoDB MCP servers focus on records (CRUD on rows). This one covers the **whole NocoDB v3 API surface** so an AI agent can manage your databases end-to-end without dropping into the UI:

- 🆕 **Schema operations**: create / update / delete fields, tables, views, filters, sorts
- 🪝 **Webhooks**: full lifecycle management
- 📥 **CSV import** & schema export/import for portable templates
- 🔗 **Links and attachments** as first-class operations
- 🛡️ **Dry-run mode** on destructive operations
- 📊 Records, dashboards, comments, scripts, NocoDocs

## Status

✅ **Phase 1 — v0.1.0**. 28 tools across 6 groups: connectivity, workspaces, bases, tables, fields, records.
See [ROADMAP](#roadmap) for what's coming.

## Requirements

- Node.js 20 or newer
- A NocoDB instance running version `0.265+` (recommended: `2026.04.x`)
- A NocoDB API token: NocoDB → Account Settings → Tokens → Create

## Install

```bash
npm install -g nocodb-mcp
```

Or run directly via `npx`:

```bash
npx -y nocodb-mcp
```

## Configure

Set environment variables:

```bash
export NOCODB_BASE_URL=https://data.example.com
export NOCODB_API_TOKEN=nc_pat_...
```

See [`.env.example`](.env.example) for all options.

## Use with Claude Code

```bash
claude mcp add nocodb -- npx -y nocodb-mcp \
  -e NOCODB_BASE_URL=https://data.example.com \
  -e NOCODB_API_TOKEN=nc_pat_...
```

Then in Claude Code:

> Use the `ping_nocodb` tool to check the connection.

## Use with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nocodb": {
      "command": "npx",
      "args": ["-y", "nocodb-mcp"],
      "env": {
        "NOCODB_BASE_URL": "https://data.example.com",
        "NOCODB_API_TOKEN": "nc_pat_..."
      }
    }
  }
}
```

## Tools (v0.1.0 — 28 tools)

### Connectivity
| Tool | Description |
|---|---|
| `ping_nocodb` | Check connectivity, return NocoDB version + accessible workspace count |

### Workspaces
| Tool | Description |
|---|---|
| `list_workspaces` | List all workspaces accessible by the API token |

### Bases
| Tool | Description |
|---|---|
| `list_bases` | List all bases in a workspace |
| `get_base` | Get a base by ID |
| `create_base` | Create a new base in a workspace |
| `update_base` | Rename, change description or color |
| `delete_base` | Delete a base (supports `dry_run`) |

### Tables
| Tool | Description |
|---|---|
| `list_tables` | List all tables in a base |
| `get_table` | Get table details (with fields) |
| `create_table` | Create a table, optionally with initial fields |
| `update_table` | Rename or update description |
| `delete_table` | Delete a table (supports `dry_run`) |
| `clone_table` | Duplicate table structure (no records) |

### Fields ⭐ (the main gap in other MCPs)
| Tool | Description |
|---|---|
| `list_fields` | List all fields of a table |
| `get_field` | Get field details with options |
| `create_field` | Create a new field of any v3 type (incl. SingleSelect, Formula, LinkToAnotherRecord) |
| `update_field` | Rename, change description, modify options |
| `delete_field` | Delete a field (supports `dry_run`) |
| `reorder_field` | Change field position |
| `bulk_rename_fields` | Rename many fields atomically |

### Records
| Tool | Description |
|---|---|
| `list_records` | List with v3 `where` syntax, sort, pagination, view filter |
| `get_record` | Get single record by ID |
| `create_records` | Bulk insert |
| `update_records` | Bulk update (each record needs primary key) |
| `delete_records` | Bulk delete (supports `dry_run`) |
| `upsert_records` | Insert or update (idempotent imports) |
| `count_records` | Count matching records |
| `global_search` | Substring search across all string fields of all tables in a base |

### Safety

All destructive operations (`delete_*`) accept a `dry_run: true` parameter that returns a preview of what would have been affected without making any changes. Use this from AI agents to safely confirm before committing.

### Roadmap

| Phase | Tools | Status |
|---|---|---|
| **1** | bases, tables, fields, records | ✅ shipped (v0.1.0) |
| **2** | views (grid/gallery/kanban/form/calendar/map), filters, sorts, webhooks, links, attachments, CSV/JSON import-export | planned |
| **3** | schema export/import, comments, scripts, dashboards, workflows, NocoDocs | planned |
| **4** | HTTP/SSE transport, Smithery listing | planned |

## Develop

```bash
git clone https://github.com/zoyak-tech/nocodb-mcp.git
cd nocodb-mcp
npm install
cp .env.example .env  # fill in your values
npm run typecheck
npm run lint
npm test
npm run build
```

To test locally with Claude Code, build first then point it at the local entry:

```bash
npm run build
claude mcp add nocodb-dev -- node $(pwd)/dist/index-stdio.js \
  -e NOCODB_BASE_URL=... -e NOCODB_API_TOKEN=...
```

## Contributing

PRs welcome. Please:

1. Open an issue first for larger changes.
2. Run `npm run lint && npm test && npm run typecheck` before submitting.
3. Follow the existing tool registration pattern in `src/server.ts`.

## License

MIT © zoyak-tech
