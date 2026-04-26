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

🚧 Phase 0 — bootstrap. Currently exposes only `ping_nocodb` for connectivity testing.
See [ROADMAP](#roadmap) for the planned tool surface.

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

## Tools

### Phase 0 (current)

| Tool | Description |
|---|---|
| `ping_nocodb` | Check connectivity, return NocoDB version + accessible workspace count |

### Roadmap

| Phase | Tools | Status |
|---|---|---|
| **1** | bases, tables, **fields** (the gap), records (CRUD + bulk + count + global search) | planned |
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
