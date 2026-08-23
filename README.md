# Tagarr

Sidecar for the *arr stack. Polls qBittorrent, inspects torrent tracker URLs, and adds tags without removing existing ones.

```
Sonarr / Radarr → qBittorrent → Tagarr → tracker tags
```

## Run

```yaml
services:
  tagarr:
    image: ghcr.io/YOUR_GITHUB_USERNAME/tagarr:latest
    container_name: tagarr
    restart: unless-stopped
    environment:
      QBIT_URL: "http://qbittorrent:8080"
      QBIT_USERNAME: "dummy_username"
      QBIT_PASSWORD: "dummy_password"
      CHECK_INTERVAL: "60"
      TRACKER_TAG_RULES: |
        [
          { "match": "torrentleech", "tag": "torrentleech" }
        ]
    networks:
      - downloads
```

qBittorrent's Web API authenticates with username/password and a session cookie. There is no static API key.

`TRACKER_TAG_RULES` is a JSON array in Compose. Each `match` is a case-insensitive substring of the tracker URL.

A TorrentLeech download that Sonarr already tagged `sonarr` becomes `sonarr, torrentleech`.

Replace `YOUR_GITHUB_USERNAME` with the GitHub account that owns this repo. After the first publish, make the GHCR package public (or `docker login ghcr.io`) so the homelab can pull it.

Username and password can be left empty if qBittorrent allows unauthenticated local clients.
