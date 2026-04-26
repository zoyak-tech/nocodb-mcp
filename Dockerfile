# Multi-stage build for nocodb-mcp
# - Builder stage compiles TypeScript
# - Runtime stage is minimal Node 20 slim with just dist/ and prod deps

FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY README.md LICENSE ./

# Default to stdio. Smithery's startCommand will use this.
# For HTTP deployment, override with: CMD ["node", "dist/index-http.js"]
CMD ["node", "dist/index-stdio.js"]
