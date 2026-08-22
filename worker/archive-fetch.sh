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
#   {"kind":"video","id":"1943630","url":"https://mezzanine...","filename":"Film_....mp4",
#    "dest":"01 - Categorie/03 - Serie/05 - Titel.mp4","links":"07 - .../....mp4|12 - .../....mp4",
#    "expected_bytes":4458992617}
#   {"kind":"beeld-video","id":"1692484","url":"https://alpha.uscreencdn...","filename":"horizontal.jpg","expected_bytes":null}
#   Bestanden landen op $BASE/<dest> (primaire archiefpad, teambesluit
#   2026-08-11, structuur uit archive-structure.mjs); "links" = alle andere
#   platform-plekken — daar komen HARDLINKS (teamfeedback 2026-08-11: elke
#   categorie oogt volledig, opslag telt één keer). Een video-regel ZONDER dest
#   is een fout (wachtrij opnieuw genereren), geen terugval. filename blijft de
#   originele Uscreen-bestandsnaam en gaat als "orig" het manifest in;
#   dest/links bevatten gegarandeerd geen aanhalingstekens of |-in-namen
#   (gesaneerd). Beelden-legacy: beeld-video -> beeld/video/<id>/,
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
  # Kan óók een verweesde lock zijn (2026-08-11 live gezien: EXIT-trap vuurde
  # niet bij een gesneuvelde loop). Alleen-lezen diagnose: /proc-scan naar een
  # échte instantie; busybox-ps verbergt processen, dus alleen /proc telt.
  echo "$(date '+%Y-%m-%d %H:%M:%S') $LOCK bestaat — stop. Draait er echt een instantie? Check: for p in /proc/[0-9]*/cmdline; do tr '\\0' ' ' < \$p; echo; done | grep archive-fetch (minus je eigen grep). Geen instantie -> verweesde lock, handmatig: rmdir '$LOCK'" >&2
  exit 3
fi
# INT/TERM: opruimen én ÉCHT stoppen — een trap-handler zonder exit laat de
# lus gewoon doorlopen na het signaal (live gezien 2026-08-11: kill → lock
# vrijgegeven maar de loop draaide door, zonder lock).
trap 'rmdir "$LOCK" 2>/dev/null' EXIT
trap 'rmdir "$LOCK" 2>/dev/null; trap - EXIT; exit 143' INT TERM

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

# Hardlinks (teamfeedback 2026-08-11): één fysieke kopie op de primaire plek,
# in elke andere betreffende map een hardlink. Regels (adversarieel getoetst):
# - eerst -ef (zelfde inode -> klaar): idempotent, en nooit vertrouwen op
#   ln -f-gedrag bij bron==doel;
# - set -f verplicht: gesaneerde namen mogen [ ] bevatten (glob-patronen die
#   anders tegen de mapinhoud expanderen);
# - geen `tr | while read`-subshell (verliest de foutstatus, breekt fail-closed);
# - ln -f mag hier bewust een bestaande KOPIE vervangen (extras-kopieën van
#   vóór het hardlink-besluit) — de enige gesanctioneerde overschrijving.
make_links() { # $1=fysiek pad  $2=linkpaden ("|"-gescheiden, relatief aan $BASE)
  [ -z "$2" ] && return 0
  _rc=0
  _oldifs=$IFS; IFS='|'; set -f
  for _lp in $2; do
    [ -z "$_lp" ] && continue
    _lpath="$BASE/$_lp"
    [ "$_lpath" -ef "$1" ] && continue
    if ! { mkdir -p "$(dirname "$_lpath")" && ln -f "$1" "$_lpath"; }; then
      echo "$(date '+%Y-%m-%d %H:%M:%S') LINK-FOUT: $_lp" >> "$ERRLOG"; _rc=1
    fi
  done
  set +f; IFS=$_oldifs
  return $_rc
}

process_line() {
  line="$1"
  kind=$(jfield "$line" kind)
  id=$(jfield "$line" id)
  url=$(jfield "$line" url | sed 's/\\u0026/\&/g')
  filename=$(jfield "$line" filename)
  dest=$(jfield "$line" dest)
  links=$(jfield "$line" links)
  expected=$(jnum "$line" expected_bytes)

  [ -z "$kind" ] || [ -z "$id" ] || [ -z "$url" ] && {
    echo "$(date '+%Y-%m-%d %H:%M:%S') ONLEESBAAR: $line" >> "$ERRLOG"; return 1; }
  [ -z "$filename" ] && filename="$id.bin"

  case "$kind" in
    video|cover|thumb|bijlage)
      # dest = doorbladerbaar archiefpad (verplicht sinds teambesluit 2026-08-11)
      if [ -z "$dest" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') GEEN DEST: $kind/$id $filename — wachtrij met archive-structure.mjs-structuur opnieuw genereren" >> "$ERRLOG"; return 1
      fi
      dest_path="$BASE/$dest"; dest_dir=$(dirname "$dest_path") ;;
    beeld-video) dest_dir="$BASE/beeld/video/$id"; dest_path="$dest_dir/$filename" ;;
    beeld-serie) dest_dir="$BASE/beeld/serie/$id"; dest_path="$dest_dir/$filename" ;;
    *) echo "$(date '+%Y-%m-%d %H:%M:%S') ONBEKEND KIND '$kind': id=$id" >> "$ERRLOG"; return 1 ;;
  esac

  # markernaam: video's op originele bestandsnaam (compatibel met bestaande
  # markers); extras op sha16 van het dest-pad — Arabische paden zijn te lang
  # voor een bestandsnaam en de hash is aan Mac-kant reproduceerbaar
  # (archive-extras.mjs slaat al-gedane items zo over)
  case "$kind" in
    cover|thumb|bijlage) mkey="$kind-$id-$(printf '%s' "$dest" | sha256sum | cut -c1-16)" ;;
    *) mkey="$kind-$id-$(echo "$filename" | tr -c 'A-Za-z0-9._-' '_')" ;;
  esac
  marker="$DONE/$mkey"
  [ -f "$marker" ] && return 0   # al gedaan (hervatbaar)

  if [ -f "$dest_path" ]; then
    # Kortsluiting (toets 2026-08-11): mv is atomair, dus een bestaand dest is
    # een compleet, eerder geverifieerd bestand. Nooit opnieuw downloaden
    # (multi-GB!) — alleen links/manifest/marker afmaken (herstel na een crash
    # tussen mv en marker, of na een eerdere LINK-FOUT).
    size=$(stat -c %s "$dest_path" 2>/dev/null || echo 0)
    if [ -n "$expected" ] && [ "$size" != "$expected" ]; then
      echo "$(date '+%Y-%m-%d %H:%M:%S') KORTSLUITING-MISMATCH: $kind/$id $dest kreeg=$size verwacht=$expected — handmatig beoordelen, niet overschreven" >> "$ERRLOG"
      return 1
    fi
    sha=$(sha256sum "$dest_path" | cut -d' ' -f1)
  else
    part="$PARTIAL/$mkey"
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
    mv "$part" "$dest_path"
  fi

  # hardlinks vóór manifest/marker: faalt een link, dan blijft het item open
  # (geen marker) en herkanst de volgende run via de kortsluiting hierboven
  if ! make_links "$dest_path" "$links"; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') LINKS ONVOLLEDIG: $kind/$id $dest — item blijft open voor herkansing" >> "$ERRLOG"
    return 1
  fi

  # manifest = technische waarheid: dest (primaire pad) + orig (originele
  # Uscreen-bestandsnaam) + links (alle hardlink-plekken)
  case "$kind" in
    video|cover|thumb|bijlage)
      echo "{\"kind\":\"$kind\",\"id\":\"$id\",\"dest\":\"$dest\",\"orig\":\"$filename\",\"bytes\":$size,\"sha256\":\"$sha\",\"links\":\"$links\",\"done_at\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"}" >> "$MANIFEST" ;;
    *)
      echo "{\"kind\":\"$kind\",\"id\":\"$id\",\"filename\":\"$filename\",\"bytes\":$size,\"sha256\":\"$sha\",\"done_at\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"}" >> "$MANIFEST" ;;
  esac
  touch "$marker"
  log "OK $kind/$id ${dest:-$filename} ($size bytes${links:+, links})"
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
    # VANGNET (2026-08-22): een wachtrij met NUL verwerkte regels is nooit
    # "klaar" — dat betekende in de praktijk dat de loop een bestand oppikte
    # dat nog niet (volledig) was aangekomen. Vroeger telde dat als fail=0 en
    # verhuisde het bestand naar verwerkt/, waarna de Mac-guard die ids voorgoed
    # oversloeg: twaalf wachtrijen = 300 video's stil kwijt. Nu: melden en laten
    # staan, zodat de volgende ronde hem alsnog leest. (De Mac stuurt sinds
    # dezelfde datum via .tmp + mv, dus dit zou niet meer mogen voorkomen.)
    if [ "$ok" -eq 0 ] && [ "$fail" -eq 0 ]; then
      echo "$(date '+%Y-%m-%d %H:%M:%S') LEGE WACHTRIJ GELEZEN: $(basename "$qf") ($(wc -l < "$qf" 2>/dev/null || echo 0) regels op schijf) — NIET gearchiveerd, volgende ronde opnieuw" >> "$ERRLOG"
      continue
    fi
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
