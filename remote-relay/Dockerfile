FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate && pnpm install --frozen-lockfile --prod --ignore-scripts --ignore-workspace
COPY --chown=node:node *.mjs ./
COPY --chown=node:node web ./web
USER node
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
CMD ["node","server.mjs"]
