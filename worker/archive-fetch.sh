#!/bin/sh
# archive-fetch.sh — NAS-kant van het originelen-archief (teambesluit 2026-08-10).
#
# Draait OP DE SYNOLOGY NAS (POSIX sh, alleen curl + sha256sum — beide standaard
# aanwezig, geverifieerd 2026-08-10). Werkt wachtrijbestanden af die de Mac in
# _queue/ zet (JSONL, één item per regel, gemaakt door archive-request-links.mjs
# en archive-images.mjs) en haalt elk bestand rechtstreeks van de bron
# (mezzanine.mux.com voor video's, alpha.uscreencdn.com voor beelden) naar
# /volume1/Albunyaan/archief-originelen/.
#
# Verificatie per bestand (definitie "geverifieerd", werkorder 2026-08-10):
#   1. bytes op schijf == expected_bytes uit de wachtrij (als die bekend is)
#   2. sha256 berekend en vastgelegd in manifest.jsonl
# Mislukt iets -> partial weg, regel met reden naar fouten.log, DOORGAAN met de
# rest (fail-closed per item, nooit stilzwijgend overslaan).
#
# BELANGRIJK: partials staan in _partial/ op /volume1 — NOOIT /tmp gebruiken,
# dat is op Synology een RAM-schijf (verliest alles bij reboot en is te klein).
#
# Wachtrijregel-formaat (JSON, per regel):
#   {"kind":"video","id":"1943630","url":"https://mezzanine...","filename":"Film_....mp4","expected_bytes":4458992617}
#   {"kind":"beeld-video","id":"1692484","url":"https://alpha.uscreencdn...","filename":"horizontal.jpg","expected_bytes":null}
#   kind bepaalt de doelmap: video -> video/<id>/, beeld-video -> beeld/video/<id>/,
#   beeld-serie -> beeld/serie/<id>/
#
# Aanroep (op de NAS):
#   sh archive-fetch.sh            # werk alle wachtrijen af en stop
#   sh archive-fetch.sh --loop     # blijf draaien, kijk elke 30s naar nieuwe wachtrijen
#
# Hervatbaar: al-gedane ids staan in done/<kind>-<id>; curl -C - hervat partials.

BASE="/volume1/Albunyaan/archief-originelen"
QUEUE="$BASE/_queue"
PARTIAL="$BASE/_partial"
DONE="$BASE/done"
MANIFEST="$BASE/manifest.jsonl"
LOG="$BASE/voortgang.log"
ERRLOG="$BASE/fouten.log"

mkdir -p "$QUEUE" "$PARTIAL" "$DONE" "$BASE/video" "$BASE/beeld/video" "$BASE/beeld/serie"

# ── single-instance-slot: mkdir is atomair, dus een perfecte lock zonder flock
# (Synology-sh heeft geen flock). Incident 2026-08-10: drie halfdode loop-
# instanties + een one-shot werkten dezelfde wachtrij tegelijk af -> mv-races,
# dubbele manifestregels en kapotgemaakte partials. Nooit meer.
LOCK="$BASE/_lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') al een instantie actief ($LOCK bestaat) — stop" >&2
  exit 3
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT INT TERM

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG"; echo "$(date '+%Y-%m-%d %H:%M:%S') $1" 2>/dev/null || true; }

# Eén JSON-veld uit een regel halen zonder jq (Synology heeft geen jq).
# Werkt omdat onze wachtrij-generator geen aanhalingstekens in waarden schrijft
# behalve in title (die gebruiken we hier niet).
jfield() { # $1=regel $2=veld  -> waarde of leeg
  echo "$1" | sed -n "s/.*\"$2\":\"\([^\"]*\)\".*/\1/p"
}
jnum() { # $1=regel $2=veld -> nummer of leeg (voor expected_bytes)
  echo "$1" | sed -n "s/.*\"$2\":\([0-9][0-9]*\).*/\1/p"
}

process_line() {
  line="$1"
  kind=$(jfield "$line" kind)
  id=$(jfield "$line" id)
  url=$(jfield "$line" url | sed 's/\\u0026/\&/g')
  filename=$(jfield "$line" filename)
  expected=$(jnum "$line" expected_bytes)

  [ -z "$kind" ] || [ -z "$id" ] || [ -z "$url" ] && {
    echo "$(date '+%Y-%m-%d %H:%M:%S') ONLEESBAAR: $line" >> "$ERRLOG"; return 1; }
  [ -z "$filename" ] && filename="$id.bin"

  case "$kind" in
    video)       dest_dir="$BASE/video/$id" ;;
    beeld-video) dest_dir="$BASE/beeld/video/$id" ;;
    beeld-serie) dest_dir="$BASE/beeld/serie/$id" ;;
    *) echo "$(date '+%Y-%m-%d %H:%M:%S') ONBEKEND KIND '$kind': id=$id" >> "$ERRLOG"; return 1 ;;
  esac

  marker="$DONE/$kind-$id-$(echo "$filename" | tr -c 'A-Za-z0-9._-' '_')"
  [ -f "$marker" ] && return 0   # al gedaan (hervatbaar)

  part="$PARTIAL/$kind-$id-$(echo "$filename" | tr -c 'A-Za-z0-9._-' '_')"
  # -C - hervat een eerdere partial; --retry dekt netwerk-hikken; fail op HTTP-fouten
  curl -fsS -C - --retry 5 --retry-delay 10 -o "$part" "$url"
  rc=$?
  if [ $rc -ne 0 ]; then
    # 416 (range voorbij einde) betekent meestal: partial was al compleet — check dat
    size_now=$(stat -c %s "$part" 2>/dev/null || echo 0)
    if [ -n "$expected" ] && [ "$size_now" = "$expected" ]; then
      : # compleet ondanks curl-exitcode; ga door naar verificatie
    else
      rm -f "$part"
      echo "$(date '+%Y-%m-%d %H:%M:%S') CURL-FOUT rc=$rc: $kind/$id $filename" >> "$ERRLOG"
      return 1
    fi
  fi

  size=$(stat -c %s "$part" 2>/dev/null || echo 0)
  if [ -n "$expected" ] && [ "$size" != "$expected" ]; then
    # De wachtrij-HEAD kan te vroeg zijn geweest: bij snel-geprepte video's
    # groeit het bronbestand nog even ná het verschijnen van de URL (gezien
    # 2026-08-10: wachtrij zei 114 MB, werkelijk 125 MB). Verse HEAD is dan de
    # scheidsrechter: komt de schijfgrootte dáármee overeen, dan is het bestand
    # compleet en accepteren we mét notitie. Anders echt fout.
    fresh=$(curl -fsSI "$url" 2>/dev/null | tr -d '\r' | sed -n 's/^[Cc]ontent-[Ll]ength: //p' | head -1)
    if [ -n "$fresh" ] && [ "$size" = "$fresh" ]; then
      echo "$(date '+%Y-%m-%d %H:%M:%S') NOTITIE: $kind/$id $filename wachtrij zei $expected, verse HEAD en schijf zeggen beide $size — geaccepteerd" >> "$LOG"
    else
      rm -f "$part"
      echo "$(date '+%Y-%m-%d %H:%M:%S') BYTES-MISMATCH: $kind/$id $filename kreeg=$size verwacht=$expected verse_head=${fresh:-onbekend}" >> "$ERRLOG"
      return 1
    fi
  fi

  sha=$(sha256sum "$part" | cut -d' ' -f1)
  mkdir -p "$dest_dir"
  mv "$part" "$dest_dir/$filename"
  echo "{\"kind\":\"$kind\",\"id\":\"$id\",\"filename\":\"$filename\",\"bytes\":$size,\"sha256\":\"$sha\",\"done_at\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"}" >> "$MANIFEST"
  touch "$marker"
  log "OK $kind/$id $filename ($size bytes)"
  return 0
}

run_queues() {
  for qf in "$QUEUE"/*.jsonl; do
    [ -f "$qf" ] || continue
    log "wachtrij: $(basename "$qf")"
    ok=0; fail=0
    while IFS= read -r line || [ -n "$line" ]; do
      [ -z "$line" ] && continue
      if process_line "$line"; then ok=$((ok+1)); else fail=$((fail+1)); fi
    done < "$qf"
    log "wachtrij $(basename "$qf") klaar: $ok ok, $fail fout"
    # wachtrij pas archiveren als ALLES gelukt is; anders laten staan zodat een
    # volgende run de mislukte items (die geen done-marker hebben) opnieuw probeert
    if [ "$fail" -eq 0 ]; then
      mkdir -p "$QUEUE/verwerkt"
      mv "$qf" "$QUEUE/verwerkt/"
    fi
  done
}

if [ "$1" = "--loop" ]; then
  log "archive-fetch gestart in loop-modus"
  while :; do
    run_queues
    sleep 30
  done
else
  run_queues
fi
