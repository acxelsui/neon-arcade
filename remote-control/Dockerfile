FROM node:24-alpine
WORKDIR /app
COPY protocol.mjs auth.mjs relay.mjs ./
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production PORT=8080 NEON_REMOTE_STORE=/data/neon-remote.json
EXPOSE 8080
CMD ["node", "relay.mjs"]
