FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json build.mjs ./
COPY src/ ./src/

RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
