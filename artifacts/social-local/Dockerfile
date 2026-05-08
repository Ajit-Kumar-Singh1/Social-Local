FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy shared libs used by the frontend
COPY lib/api-client-react ./lib/api-client-react
COPY lib/api-spec ./lib/api-spec

# Copy the frontend artifact
COPY artifacts/social-local ./artifacts/social-local

# Install dependencies
FROM base AS deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Build stage — produces static files in artifacts/social-local/dist/public
FROM deps AS builder
ENV PORT=4173
ENV BASE_PATH=/
ENV NODE_ENV=production
RUN pnpm --filter @workspace/social-local run build

# Serve with nginx
FROM nginx:alpine AS runner

# Copy built static files
COPY --from=builder /app/artifacts/social-local/dist/public /usr/share/nginx/html

# nginx config: proxy /api to the API service, serve everything else from static
COPY artifacts/social-local/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
