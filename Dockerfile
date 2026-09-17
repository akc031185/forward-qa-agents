# The AI Site Auditor, standalone worker image. Runs the same Fastify API as `npm start`
# (src/api/server.ts, unchanged) so the CLIs and the generic /agents /engagements /runs routes
# still work; the routes a hosted worker actually needs are POST/GET /worker/audits (see
# src/api/worker.ts) and GET /health/browser.
#
# Base image: mcr.microsoft.com/playwright — the one Playwright itself publishes with Chromium,
# Firefox, WebKit and every system library they need already installed and version-matched. The
# tag below is pinned to the exact Playwright version in package.json; bump both together.
# See docs/DEPLOYING-THE-WORKER.md for the full deploy story (env vars, memory sizing, per-host
# notes for Railway/Fly.io/Render, and how to verify a deployment with curl).
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

# Install with dev deps: this repo ships no build step (`npm start` runs TypeScript directly
# through tsx), so tsx and typescript — both devDependencies — are part of the runtime, not just
# the toolchain. `npm ci` for a reproducible install from the lockfile.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# Chromium's own sandbox needs a seccomp profile most container hosts do not let you attach, so
# the worker launches it with --no-sandbox instead (src/core/config.ts: CHROMIUM_NO_SANDBOX).
# That is safe specifically *because* the process is not root: the image's own `pwuser` account.
ENV NODE_ENV=production \
    LLM_PROVIDER=none \
    CHROMIUM_NO_SANDBOX=1 \
    DB_PATH=/data/forward-qa.db \
    WORKSPACE_DIR=/data/workspace \
    PORT=8787

RUN mkdir -p /data/workspace && chown -R pwuser:pwuser /data /app
USER pwuser

EXPOSE 8787

# Confirms Chromium can actually launch, not just that the Node process is up — see the comment
# on GET /health/browser in src/api/server.ts for why that distinction matters for this image.
HEALTHCHECK --interval=30s --timeout=20s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health/browser').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "tsx", "src/api/server.ts"]
