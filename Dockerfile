FROM node:22-alpine

WORKDIR /app

LABEL org.opencontainers.image.title="Tagarr" \
      org.opencontainers.image.description="Tag qBittorrent torrents from tracker URLs" \
      org.opencontainers.image.source="https://github.com/kartikbhalla12/tagarr" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="kartikbhalla12"

COPY package.json ./
COPY src ./src

USER node

CMD ["node", "src/index.js"]
