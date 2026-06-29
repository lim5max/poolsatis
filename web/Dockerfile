# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml web/tsconfig.json web/vite.config.ts web/index.html ./
COPY web/public ./public
COPY web/src ./src
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM nginx:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
