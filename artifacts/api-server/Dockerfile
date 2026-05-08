FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy lib packages
COPY lib/api-zod ./lib/api-zod
COPY lib/db ./lib/db
COPY lib/api-spec ./lib/api-spec

# Copy api-server source
COPY artifacts/api-server ./artifacts/api-server

# Install only production deps for api-server
FROM base AS deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Build stage
FROM deps AS builder
RUN pnpm --filter @workspace/api-server run build

# Production image
FROM node:24-alpine AS runner
WORKDIR /app/artifacts/api-server

# Copy built output
COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/lib /app/lib
COPY --from=builder /app/artifacts/api-server/package.json ./package.json

# Create uploads directory
RUN mkdir -p /app/artifacts/api-server/uploads

EXPOSE 5000

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
