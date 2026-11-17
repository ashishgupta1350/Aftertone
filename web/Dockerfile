FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates python3 python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/aftertone \
    && /opt/aftertone/bin/pip install --no-cache-dir 'yt-dlp[default]'

ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000 PATH="/opt/aftertone/bin:${PATH}"
WORKDIR /srv/aftertone
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs firebase.mjs music.mjs state.mjs ./
COPY public/ ./public/
USER node
EXPOSE 10000
CMD ["node", "server.mjs"]
