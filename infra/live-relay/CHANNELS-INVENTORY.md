# Uscreen Live-Channel Inventory (captured 2026-07-12 via admin recon)

29 live TV channels relayed through Uscreen. Architecture confirmed: Uscreen provides an
RTMP INGEST endpoint per channel — `rtmp://global-live.uscreen.app:5222/app` + a per-channel
Stream key (e.g. Makkah = fd7a6429-45f8-d825-0edd-cb6fc30f66e3). Something on the FOUNDER's
side pushes each IPTV feed INTO that ingest. **The IPTV SOURCE URLs are NOT stored in Uscreen**
— they live in the founder's IPTV provider/relay setup and must be supplied to relay ourselves.
Our relay kit (infra/live-relay/) replaces this exact step: push the same IPTV feeds into
Bunny Stream Live instead of Uscreen's RTMP ingest.

Top-watched per 2026-07-11 analytics: Basmah TV Live (#1), Rawdah TV Live (#4).

| Uscreen ID | Channel | Lang |
|---|---|---|
| 3201685 | Sharjah Quran Live TV | AR |
| 2951266 | Channel 9 News Live TV | AR |
| 2828466 | Ssad Channel Live TV | AR |
| 2828463 | Arrahmah Channel Live TV | AR |
| 2828459 | Almajd News Live TV | AR |
| 2772917 | Hadeeth Channel Live TV | AR |
| 2772402 | Al Anis Channel Live TV | AR |
| 2772400 | Peace TV Live | EN |
| 2761391 | Sharjah 2 Channel Live TV | Urdu & EN |
| 2761385 | Makkah Channel Live TV | AR |
| 2761047 | Nour Channel Live TV | FA |
| 2761024 | Almajd General Channel Live TV | AR |
| 2761017 | Almajd Quran Channel Live TV | AR |
| 2761010 | Almajd Documentary Channel Live TV | AR |
| 2760999 | Almajd Science Channel Live TV | AR |
| 2760989 | Natural Channel Live TV | AR |
| 2760975 | Almajd Kids Channel Live TV | AR |
| 2760725 | bin othaimeen Channel Live | AR |
| 2760536 | Maassah Channel Live TV | AR |
| 2760528 | Radio Daal Live | AR |
| 2760517 | Sunnah Channel Live TV | AR |
| 2760453 | Huda Channel Live TV | EN |
| 2759643 | Al Nada Channel Live TV | AR |
| 2759145 | Eman Channel Live TV | EN |
| 2759039 | Ajaweed Channel Live | AR |
| 2112732 | Rawdah TV Live | AR |
| 2112729 | Mecca Quran TV Live | AR |
| 2112727 | Basmah TV Live | AR |
| 2112725 | Zaad TV Live | AR |

## What the founder must provide to go live
For each channel we keep: the IPTV SOURCE URL (m3u8/http/rtmp from the IPTV provider).
These are not recoverable from Uscreen. Once supplied → relay kit config (channels/*.env) → live.
