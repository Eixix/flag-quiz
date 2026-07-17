FROM oven/bun:1.3.14-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run check

FROM oven/bun:1.3.14-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/protocol.ts ./src/protocol.ts
COPY --from=build /app/src/res ./src/res
EXPOSE 3000
USER bun
CMD ["bun", "server/index.ts"]
