FROM node:18.12.0 AS builder
WORKDIR /usr/raineworks
COPY . .
RUN npm i -g pnpm
RUN pnpm i
RUN pnpm build

FROM node:18.12.0
WORKDIR /usr/api
COPY --from=builder /usr/raineworks/apps/api/package*.json /usr/api
COPY --from=builder /usr/raineworks/apps/api/.build /usr/api
COPY --from=builder /usr/raineworks/node_modules /usr/api/node_modules

CMD ["node", "index.js"]