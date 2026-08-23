# Tagarr

Sidecar for the *arr stack. Polls qBittorrent, inspects torrent tracker URLs, and adds tags without removing existing ones.

```
Sonarr / Radarr → qBittorrent → Tagarr → tracker tags
```

Images are published for `linux/amd64` and `linux/arm64`.

## Run

Create a `.env` next to your compose file (see `.env.example`):

```
QBIT_USERNAME=admin
QBIT_PASSWORD=secret
```

```yaml
services:
  tagarr:
    image: ghcr.io/kartikbhalla12/tagarr:latest
    container_name: tagarr
    restart: unless-stopped
    environment:
      QBIT_URL: "http://qbittorrent:8080"
      QBIT_USERNAME: "${QBIT_USERNAME}"
      QBIT_PASSWORD: "${QBIT_PASSWORD}"
      CHECK_INTERVAL: "60"
      LOG_LEVEL: "info"
      TRACKER_TAG_RULES: |
        [
          { "match": "tracker.example.com", "tag": "example" }
        ]
```

Pin a release instead of `latest` if you want a fixed version:

```yaml
image: ghcr.io/kartikbhalla12/tagarr:1.0.0
```

If the GHCR package is private, run `docker login ghcr.io` on the host or make the package public.

Username and password can be left empty if qBittorrent allows unauthenticated local clients.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `QBIT_URL` | yes | | qBittorrent Web UI base URL |
| `QBIT_USERNAME` | no | | Web UI username |
| `QBIT_PASSWORD` | no | | Web UI password |
| `TRACKER_TAG_RULES` | yes | | JSON array of `{ "match", "tag" }` rules |
| `CHECK_INTERVAL` | no | `60` | Seconds between scans |
| `LOG_LEVEL` | no | `info` | `debug` (gray), `info` (cyan), `warn` (yellow), or `error` (red). Set `NO_COLOR=1` or `LOG_COLOR=false` to disable |

`TRACKER_TAG_RULES` is a JSON array in Compose. Each `match` is a case-insensitive substring of the tracker URL.

A download from `tracker.example.com` that Sonarr already tagged `sonarr` becomes `sonarr, example`.

qBittorrent's Web API authenticates with username/password and a session cookie. There is no static API key.

## Releases

Every push to `master` publishes `ghcr.io/kartikbhalla12/tagarr:latest`.

To publish a versioned image:

```bash
git tag v1.0.0
git push origin v1.0.0
```

That creates:

```
ghcr.io/kartikbhalla12/tagarr:1.0.0
ghcr.io/kartikbhalla12/tagarr:1
```

You can also run the **Publish** workflow from the Actions tab (`workflow_dispatch`).

## Troubleshooting

Failed qBittorrent calls log the URL and the underlying cause.

| Cause | Meaning |
|---|---|
| `ENOTFOUND` | Hostname does not resolve. Use a reachable `QBIT_URL` (host IP or published port) if Tagarr is not on the same Docker network as qBittorrent |
| `ECONNREFUSED` | Host was found, but nothing is listening on that port |
| `ETIMEDOUT` | Network path is blocked or the host is down |
| `qBittorrent login failed` | The Web UI rejected the login. The log now includes the HTTP status and body. `Fails.` means wrong Web UI credentials. HTML or a `location=` redirect means a reverse proxy / SSO is in front of qBittorrent |
| Password with `$` | Compose interpolates `$`. Escape as `$$` or put the password in `.env` |
