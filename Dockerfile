# syntax=docker/dockerfile:1.7

# Stage 1: full deps (includes devDeps — Nuxt build needs them).
# --ignore-scripts skips the postinstall hook (which references
# scripts/codesign-natives.sh — not present at this stage and a no-op
# on Linux anyway). nuxt build in the builder stage runs nuxt prepare
# internally, so generated types still end up in .output/.
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

# Stage 2: build Nuxt — produces self-contained .output/
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx nuxt build

# Stage 3: production runtime (slim).
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Nuxt's .output/ bundles everything the app needs at runtime
# (no node_modules required for the app itself).
COPY --from=builder /app/.output ./.output

# Drizzle migrations: copy migration SQL + config + schema (drizzle.config.ts
# references the schema path). Install just drizzle-kit + drizzle-orm + postgres
# driver into an isolated package.json — avoids inheriting devDeps/omit rules
# from the main package.json that would skip drizzle-kit at install time.
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/server/db/schema ./server/db/schema
RUN echo '{"name":"scrumban-runner","private":true}' > package.json \
 && npm install --no-package-lock --legacy-peer-deps \
    drizzle-kit drizzle-orm postgres

COPY scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
