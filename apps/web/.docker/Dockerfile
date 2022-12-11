FROM node:18.12.0 AS builder
WORKDIR /usr/raineworks
COPY . .
RUN curl -fsSL "https://github.com/pnpm/pnpm/releases/latest/download/pnpm-linuxstatic-x64" -o /bin/pnpm; chmod +x /bin/pnpm;
RUN pnpm i
RUN pnpm build.server

FROM node:18.12.0
WORKDIR /usr/web
COPY --from=builder /usr/raineworks/apps/web/package*.json /usr/web
COPY --from=builder /usr/raineworks/apps/web/.build /usr/web/.build
COPY --from=builder /usr/raineworks/apps/web/server /usr/web/server
COPY --from=builder /usr/raineworks/node_modules /usr/web/node_modules

CMD ["node", "server/entry.express.js"]