# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
RUN pnpm install --frozen-lockfile

COPY src ./src
COPY migrations ./migrations
RUN pnpm build
RUN pnpm prune --prod

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3300

RUN corepack enable

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations

EXPOSE 3300

CMD ["node", "dist/cli/serve.js"]
