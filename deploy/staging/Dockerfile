# GameNight Host WEB — STAGING image (Timeweb Cloud Apps / Docker)
# Builds WEB (dist-web) + Express API. Serves both from one origin when
# GNH_SERVE_WEB_STATIC=1 (default in this image).
#
# DO NOT point DATABASE_URL at gnh_supabase.
# DO NOT use production YooKassa or @GameNightHostBot tokens.

FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js vite.config.ts tsconfig*.json ./
COPY public ./public
COPY src ./src
COPY .env.web ./.env.web
RUN npm run build:web

FROM node:20-bookworm-slim AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server ./
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    GNH_STAGING=1 \
    GNH_SERVE_WEB_STATIC=1 \
    GNH_DISABLE_TELEGRAM_BOT=1 \
    GNH_DISABLE_ADMIN_BROADCAST=1 \
    WEB_DEV_LOGIN_ENABLED=0 \
    WEB_COOKIE_SECURE=true \
    TRUST_PROXY=1 \
    PORT=3001 \
    GNH_WEB_STATIC_DIR=/app/dist-web

RUN useradd --system --uid 10001 --create-home gnh
COPY --from=server-build /app/server /app/server
COPY --from=frontend-build /app/dist-web /app/dist-web
COPY server/db /app/server/db
WORKDIR /app/server
USER gnh
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
