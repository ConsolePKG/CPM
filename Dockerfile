FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@12.5.1
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run web:build
RUN pnpm --filter @consolepkg/server deploy --prod --legacy /runtime

FROM node:22-bookworm-slim AS library
WORKDIR /app
COPY --from=build /runtime /app
COPY --from=build /app/apps/web/dist /app/web
ENV PORT=8080 CPM_DATA=/data CPM_WEB_ROOT=/app/web CPM_LIBRARY_ROOT=/games
VOLUME ["/data"]
EXPOSE 8080
CMD ["./node_modules/.bin/tsx", "src/main.ts"]

FROM nginx:stable-alpine AS static
COPY nginx.static.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
