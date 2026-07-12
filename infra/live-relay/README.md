# Live-channel relay kit (WS6)

Relays the 3 live TV channels (Basmah TV, Rawdah TV, + third — confirm name
with founder) from their third-party IPTV sources to our own delivery stack,
replacing the Uscreen→Mux relay. Plain bash + systemd on one small VPS; no
Docker.

> **Rights note (once, plainly):** these channels come from outside IPTV
> feeds. Relaying them is the founder's standing practice carried over from
> the current Uscreen/Mux setup; whether the permission/rights situation
> allows it remains the founder's call, not something this kit changes.

## Architecture

**Primary profile — Bunny Stream Live:**

```
3rd-party IPTV source (HLS / MPEG-TS URL)
        │  pull (ffmpeg -c copy, reconnect+timeout hardened)
        ▼
VPS (Hetzner, Ubuntu 24.04) — relay@<channel>.service × 3
        │  push RTMP(S)
        ▼
Bunny Stream Live ingest ── packaging, HLS delivery, token auth
        │
        ▼
player: hls.js  ←  videos.live_stream_url = Bunny playback URL
```

**Fallback profile — VPS packages HLS itself** (if Bunny Stream Live is
unavailable or unsuitable):

```
IPTV source ──ffmpeg──► /var/hls/<channel>/live.m3u8 + segments
                              │  nginx (nginx-hls.conf), port 80, origin-locked
                              ▼
                     Bunny CDN pull zone  ──►  player (hls.js)
        videos.live_stream_url = https://<pullzone>.b-cdn.net/hls/<channel>/live.m3u8
```

The push target is **pluggable per channel** via the env file: set
`TARGET_RTMP_URL` (primary) or `HLS_OUT_DIR` (fallback) — nothing else
changes. You can even run one channel on each profile during migration.

## Bunny live availability — VERIFY FIRST (known unknown)

This kit was written **without** confirming Bunny's live-streaming product
status/limits. Before provisioning:

1. Open the Bunny dashboard → **Stream** → look for a **Live streams**
   section inside a Stream library (or a live/ingest option when creating a
   video). If present, create one live stream per channel and note the
   **RTMP(S) ingest URL + stream key** and the **playback URL**.
2. Check limits that matter to us: max concurrent live streams per library,
   ingest bitrate caps, whether token authentication covers live playback,
   and live pricing (it may differ from VOD storage/delivery pricing).
3. **If Live streams don't exist / limits don't fit → use the fallback
   profile**: run `setup-vps.sh --with-fallback`, set `HLS_OUT_DIR` in the
   channel envs, create a Bunny **CDN pull zone** with the VPS as origin.

Either way the player side is identical: hls.js pointed at
`videos.live_stream_url`.

## Files

| File | Purpose |
|---|---|
| `relay.sh` | Core relay one channel runs: hardened ffmpeg pull → RTMP push or local HLS. |
| `systemd/relay@.service` | Template unit, one instance per channel, restart w/ backoff, journald logging. |
| `systemd/relay-watchdog.service` + `.timer` | Every minute: restart units whose output stopped advancing (heartbeat mtime; HLS: manifest mtime); publishes `/run/albunyaan/status.json`. |
| `relay-watchdog.sh` | The watchdog logic the service runs. |
| `healthcheck.sh` | Per-channel status JSON (unit state, heartbeat age, manifest age, healthy flag). |
| `channels/example.env` | Documented per-channel config template (no real values in repo). |
| `setup-vps.sh` | Idempotent Ubuntu 24.04 bootstrap (user, packages, ufw, fail2ban, units). |
| `nginx-hls.conf` | Fallback profile: serve `/var/hls` behind a Bunny pull zone (cache + CORS). |
| `test-local-macos.sh` | Proves the relay logic locally with a synthetic live stream. Run it before touching a VPS. |

## What's needed to go live (exact list)

1. **VPS** — Hetzner Ubuntu 24.04. `-c copy` relay is network-bound, not
   CPU-bound: CX22/CPX11 (~€4–7/mo) is enough for 3 channels; take CPX21
   (~€9/mo) only if `TRANSCODE=1` is needed for a source.
2. **3 SOURCE_URLs from the founder** — the actual IPTV feed URLs currently
   fed to Uscreen/Mux (plus any required User-Agent/Referer headers), and
   the confirmed name of the third channel.
3. **Bunny side, one of:**
   - *Primary:* a Bunny Stream **live stream created per channel** → 3×
     (RTMP ingest URL + stream key) for the env files, 3× playback URL for
     the platform.
   - *Fallback:* a Bunny **CDN pull zone** pointing at the VPS origin
     (port 80), plus the origin lock (pull-key header or IP allowlist —
     see `nginx-hls.conf`).

## Cost notes

- VPS: ~€4–9/mo (see above). Hetzner includes 20 TB egress — 3 channels
  pushed 24/7 at ~3 Mbps ≈ 3 TB/mo, comfortably inside.
- Primary: Bunny Stream Live pricing **unverified** — check during the
  availability step; delivery replaces what Mux costs Uscreen today.
- Fallback: pull-zone traffic is billed per GB delivered and scales with
  *viewers* (edge cache absorbs most of it; origin egress stays ≈ 3 TB/mo).

## Runbook

```text
1. PROVISION      Create VPS, point DNS if desired, copy infra/live-relay/ to it.
                  sudo ./setup-vps.sh                # primary
                  sudo ./setup-vps.sh --with-fallback  # if Bunny Live is a no-go

2. CONFIGURE      For each channel (basmah, rawdah, <third>):
                  cp /etc/albunyaan/relay-example.env.sample /etc/albunyaan/relay-basmah.env
                  chmod 600 /etc/albunyaan/relay-basmah.env
                  vi  /etc/albunyaan/relay-basmah.env   # SOURCE_URL + target
                  (env files are /etc, mode 600, root-owned; never in git)

3. ENABLE         systemctl enable --now relay@basmah relay@rawdah relay@<third>
                  (relay-watchdog.timer is already enabled by setup-vps.sh)

4. VERIFY         journalctl -u relay@basmah -f        # event=start, no exits
                  /opt/albunyaan/live-relay/healthcheck.sh   # healthy:true ×3
                  Play the Bunny playback URL (or pull-zone URL) in hls.js/VLC.

5. SOAK 24h       Leave running a full day. Check:
                  journalctl -u relay@* --since -24h | grep -c ffmpeg_exit   # few/none
                  journalctl -t relay-watchdog --since -24h | grep watchdog_restart
                  healthcheck.sh again. A handful of source-side reconnects
                  is normal; restart loops are not.

6. GO LIVE        Paste the 3 playback URLs into the admin (videos.live_stream_url
                  per live channel). Web player is hls.js against that field.
                  Then disable the channels on Uscreen/Mux.
```

### Troubleshooting quick hits

- `event=ffmpeg_exit` loops right after start → check SOURCE_URL by hand:
  `ffprobe -user_agent '...' '<url>'` on the VPS; many IPTV feeds are
  User-Agent- or Referer-gated (`USER_AGENT`/`HEADERS` in the env).
- Audio errors pushing RTMP with `-c copy` → source audio isn't AAC; set
  `TRANSCODE=1` in that channel's env.
- Watchdog restarting a channel every few minutes → source stalls without
  disconnecting; that's the watchdog doing its job, but consider raising
  `HEARTBEAT_MAX_AGE` or finding a healthier source URL.
- Fallback playback 403/CORS → add the player origin to the `map` in
  `nginx-hls.conf` and mind `Vary: Origin` caching at the pull zone.
