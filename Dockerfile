# syntax=docker/dockerfile:1

FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=5000
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node . .

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" > /dev/null || exit 1

CMD ["node", "server.js"]
