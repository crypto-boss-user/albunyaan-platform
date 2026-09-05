#!/usr/bin/env python3
"""PreToolUse-check (Bash) — Review-log-conventie, repo-eigen (plan §5 B50, RV 2, 2026-09-04).

Weigert een `git commit` waarvan de commit-tekst geen regel bevat die begint met "Review-log:".
Expliciete uitzondering: "Review-log: n.v.t. — <reden>" — de reden is verplicht, zodat de poort
nooit stil blokkeert en een docs-only commit altijd door kan met één eerlijke regel.

Segmentering (B77, 2026-09-05): het commando wordt met shlex in punctuation-modus ontleed en gesplitst op
`;` `&&` `||` `|` `|&` `&` en newline; subshell-haken `( )`, accolades `{ }` en voorlopende VAR=waarde-toewijzingen
worden gestript; ELK segment dat een `git … commit` is wordt afzonderlijk gekeurd — één geweigerd segment = geheel
geweigerd. Vóór B77 hield shlex `status;` als één token, zodat `git status; git commit -m "x"` doorglipte.

Wat de check leest (per commit-segment):
  -m/--message (meerdere = alinea's), -Xm/-Xm<tekst> gecombineerd, --message=…, -F/--file <pad>
  (relatief aan `git -C <dir>` of anders aan de cwd van de sessie; alleen gewone bestanden, max 1 MB),
  -F - met een heredoc in hetzelfde commando. `--amend --no-edit`, -C/-c <commit>, --reuse-message,
  --help, --dry-run → doorlaten. Geen leesbare tekst (editor-commit, -F uit een variabele, --fixup/--squash
  zonder -m) → weigeren met uitleg.
Alles wat geen echte `git commit` is (ook de tekst "git commit" binnen quotes/heredocs): exit 0 — behalve de
B80-fail-closed-gevallen hieronder (wrapper zonder git-token met "commit" in een token, `env -S` zonder git-token,
onbekende git-globale vlag vóór een `commit`-token), die bewust ook een niet-commit kunnen weigeren.
Malformed hook-input of een eigen fout: exit 0 (nooit blokkeren op eigen bug — zelfde keuze als guardrail.py).
Deny = exit 2 + reden op stderr (Claude ziet het en past de commit-tekst aan).
Bekend en bewust niet gedicht (conventie eerst, B50): TOCTOU op een -F-bestand dat in hetzelfde commando
wordt herschreven; commits via gh/merge/cherry-pick/rebase/commit-tree/scripts; een commit binnen een
string (`bash -c "git commit …"`, `$(…)`) of achter een wrapper buiten de B80-lijst (`sudo`, `nohup`, `xargs`,
`script`); -m "$(…)"/"$VAR" wordt geweigerd. Sinds B80 (2026-09-05) wél gekeurd: de wrappers `command`/`exec`/`env`/
`nice`/`time`/`caffeinate` (met eigen vlaggen/argumenten en VAR=x) vóór `git` worden afgepeld tot het git-token, en de
git-globale vlaggen vóór `commit` (-P/-p, -c x=y, -C pad, --no-pager, --git-dir, --work-tree, --config-env, …) worden
overgeslagen; het LAATSTE git-token wint (`env X=a/git git commit`, `exec -a git git commit`) en meerdere `-C` stapelen
zoals bij git. Fail-closed: een wrapper zonder herkenbaar git-token maar met "commit" in het segment, `env -S`/
`--split-string` zonder kaal git-token, of een ONBEKENDE globale vlagvorm vóór een `commit`-token, wordt geweigerd met
melding (ook mét geldige Review-log — herschrijf naar een kale `git commit`). Een kale `VAR=x git commit` wordt sinds B77 gekeurd. Hook = AF (founderbesluit 2026-09-05): verdere
bypass-vondsten worden genoteerd (plan §5), niet meer gebouwd.
Globaal (~/.claude) wordt niets gewijzigd (B23); deze check leeft alleen in .claude/settings.json van de repo.
Live in Claude Code pas ná herstart van de sessie (hooks worden bij sessiestart geladen).
"""
import json
import os
import re
import shlex
import sys

REVIEW_RE = re.compile(r"^\s*Review-log:\s*(.*)$")
NVT_RE = re.compile(r"^n\.?v\.?t\.?\s*(?:—|–|-|:)\s*(\S.*)$", re.IGNORECASE)
HEREDOC_RE = re.compile(r"<<-?\s*(['\"]?)(\w+)\1[^\n]*\n(.*?)\n\2[ \t]*(?:\n|$)", re.DOTALL)
SEP_CHARS = set(";|&")            # een token dat alléén hieruit bestaat scheidt commando's: ; && || | |& & ;;
GROUP_TOKENS = {"(", ")", "{", "}"}  # subshell/accolades: geen eigen commando, alleen groepering
ENV_ASSIGN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")  # VAR=waarde vóór het commando (bv. GIT_EDITOR=true git commit)
GIT_GLOBAL_WITH_ARG = ("-C", "-c", "--git-dir", "--work-tree", "--exec-path", "--namespace", "--super-prefix",
                       "--config-env", "--list-cmds", "--attr-source")  # `git <vlag> <waarde> commit` (B80)
GIT_GLOBAL_LONG_EQ = tuple(f + "=" for f in GIT_GLOBAL_WITH_ARG if f.startswith("--"))  # `--git-dir=x` enz.
GIT_GLOBAL_FLAGS = ("--no-pager", "-P", "--paginate", "-p", "--bare", "--literal-pathspecs", "--glob-pathspecs",
                    "--noglob-pathspecs", "--icase-pathspecs", "--no-optional-locks", "--no-replace-objects",
                    "--no-lazy-fetch", "--no-advice", "--html-path", "--man-path", "--info-path")
WRAPPERS = {"command", "exec", "env", "nice", "time", "caffeinate"}  # B80: vóór git afpellen tot het git-token
MAX_MSG_BYTES = 1_000_000


def deny(reason: str) -> None:
    print(f"REVIEW-LOG CHECK GEWEIGERD: {reason}", file=sys.stderr)
    sys.exit(2)


def newlines_to_separators(s: str) -> str:
    """Een newline buiten aanhalingstekens scheidt commando's (zoals `;`); binnen quotes blijft hij staan;
    `\`+newline (regelvervolg) wordt een spatie."""
    out, q, esc = [], None, False
    for ch in s:
        if esc:
            if ch == "\n":
                out[-1] = " "  # `\`+newline = regelvervolg: de backslash weg, de newline wordt een spatie
            else:
                out.append(ch)
            esc = False; continue
        if ch == "\\" and q != "'":
            out.append(ch); esc = True; continue
        if q:
            if ch == q:
                q = None
            out.append(ch); continue
        if ch in ("'", '"'):
            q = ch; out.append(ch); continue
        out.append(" ; " if ch == "\n" else ch)
    return "".join(out)


def tokenize(s: str):
    """shlex in punctuation-modus: `;`, `&&`, `(`, `)` enz. worden eigen tokens, ook zonder spatie eromheen."""
    lex = shlex.shlex(s, posix=True, punctuation_chars=True)
    lex.whitespace_split = True
    lex.commenters = ""  # fail-closed: anders verbergt `# opmerking` de rest van het commando, inclusief een `git commit`
    return list(lex)


def split_segments(toks):
    """Splitst op scheidingstokens; stript groeperingshaken en voorlopende VAR=waarde-toewijzingen per segment."""
    seg, out = [], []

    def flush():
        cleaned = [t for t in seg if t not in GROUP_TOKENS]
        while cleaned and ENV_ASSIGN_RE.match(cleaned[0]):
            cleaned.pop(0)
        if cleaned:
            out.append(cleaned)

    for t in toks:
        if t and set(t) <= SEP_CHARS:
            flush()
            seg = []
        else:
            seg.append(t)
    flush()
    return out


def peel_wrappers(seg):
    """B80: `command`/`exec`/`env`/`nice`/`time`/`caffeinate` (met eigen vlaggen, argumenten en VAR=x) vóór git
    afpellen tot het eerste git-token; gestapelde wrappers (`env nice time git …`) vallen daar vanzelf onder.
    Fail-closed: een wrapper zonder git-token maar met "commit" in het segment (bv. `env -S "git commit …"`) = weigeren."""
    if not seg or os.path.basename(seg[0]) not in WRAPPERS:
        return seg
    for j in range(1, len(seg)):
        if os.path.basename(seg[j]) == "git":
            return seg[j:]
    if any("commit" in t for t in seg):
        deny(f"wrapper `{seg[0]}` zonder herkenbaar `git`-token, maar met `commit` in het segment (B80, fail-closed); "
             "schrijf een kale `git commit -m \"Review-log: ...\"`.")
    if os.path.basename(seg[0]) == "env" and any(
            t.startswith("--split-string") or (t.startswith("-") and not t.startswith("--") and "S" in t) for t in seg[1:]):
        # koude review I-2: `env -S` knipt een string zelf tot een commando en expandeert ${VAR}; `C=commit env -S "git ${C}"`
        # bevat dan geen git-token en geen "commit" meer → zonder kaal git-token altijd weigeren (fail-closed)
        deny("`env -S`/`--split-string` zonder kaal `git`-token (B80, fail-closed: de string kan een commit verbergen); "
             "schrijf een kale `git commit -m \"Review-log: ...\"`.")
    return []


def parse_git_commit(seg):
    """Geeft (is_commit, c_dir, argv_na_commit)."""
    seg = peel_wrappers(seg)
    if not seg or os.path.basename(seg[0]) != "git":
        return False, None, []
    i, c_dir = 1, None
    while i < len(seg):
        t = seg[i]
        if t in GIT_GLOBAL_WITH_ARG:
            if t == "-C" and i + 1 < len(seg):
                c_dir = os.path.join(c_dir or "", seg[i + 1])  # meerdere -C stapelen zoals git (koude review M-2)
            i += 2
            continue
        if t.startswith(GIT_GLOBAL_LONG_EQ) or (t.startswith("-c") and not t.startswith("--") and t != "-c"):
            i += 1
            continue
        if t in GIT_GLOBAL_FLAGS:
            i += 1
            continue
        if t.startswith("-"):
            # onbekende globale vlagvorm (B80): fail-closed als er nog een `commit`-token volgt, anders geen commit
            if "commit" in seg[i:]:
                deny(f"onbekende git-globale vlag `{t}` vóór `commit` (B80, fail-closed); "
                     "schrijf een kale `git commit -m \"Review-log: ...\"` zonder die vlag.")
            return False, None, []
        if os.path.basename(t) == "git":
            # koude review I-1: het eerdere "git" was een wrapper-waarde (`env X=a/git git …`, `env -u git git …`,
            # `exec -a git git …`); het laatste git-token wint — scan opnieuw vanaf hier
            seg, i, c_dir = seg[i:], 1, None
            continue
        break
    if i < len(seg) and seg[i] == "commit":
        return True, c_dir, seg[i + 1:]
    return False, None, []


def message_from_args(args, heredocs, cwd, c_dir):
    """Geeft (tekst, bron) — tekst None = niet leesbaar (bron = reden), "__SKIP__" = doorlaten."""
    msgs, file_path, amend, reuse, no_edit = [], None, False, False, False
    i = 0
    while i < len(args):
        t = args[i]
        if t in ("--help", "-h", "--dry-run"):
            return "__SKIP__", t
        if t in ("-m", "--message"):
            if i + 1 < len(args):
                msgs.append(args[i + 1]); i += 2; continue
        elif t.startswith("--message="):
            msgs.append(t.split("=", 1)[1])
        elif t.startswith("-") and not t.startswith("--") and "m" in t[1:]:
            # -m<tekst>, -am, -qm, -am<tekst>: alles ná de eerste 'm' is de tekst (zoals git het leest)
            flags, _, rest = t[1:].partition("m")
            if flags.isalpha() or flags == "":
                if rest:
                    msgs.append(rest)
                elif i + 1 < len(args):
                    msgs.append(args[i + 1]); i += 2; continue
        elif t in ("-F", "--file"):
            if i + 1 < len(args):
                file_path = args[i + 1]; i += 2; continue
        elif t.startswith("--file="):
            file_path = t.split("=", 1)[1]
        elif t.startswith("-") and not t.startswith("--") and t.endswith("F") and t[1:-1].isalpha():
            if i + 1 < len(args):
                file_path = args[i + 1]; i += 2; continue
        elif t == "--amend":
            amend = True
        elif t == "--no-edit":
            no_edit = True
        elif t in ("-C", "-c", "--reuse-message", "--reedit-message") or t.startswith(("--reuse-message=", "--reedit-message=", "-C", "-c")):
            reuse = True
        i += 1
    if msgs:
        return "\n\n".join(msgs), "-m"
    if file_path is not None:
        if file_path == "-":
            if heredocs:
                return heredocs[-1], "heredoc"
            return None, "-F - zonder heredoc: tekst niet leesbaar"
        if file_path.startswith("$") or "$(" in file_path:
            return None, "-F met een shell-variabele: tekst niet leesbaar"
        base = cwd or os.getcwd()
        if c_dir:
            base = os.path.join(base, os.path.expanduser(c_dir))
        p = os.path.expanduser(file_path)
        if not os.path.isabs(p):
            p = os.path.join(base, p)
        if not os.path.isfile(p):
            return None, f"bestand uit -F is geen gewoon bestand of ontbreekt ({file_path})"
        try:
            with open(p, encoding="utf-8", errors="replace") as fh:
                return fh.read(MAX_MSG_BYTES), f"-F {file_path}"
        except OSError as e:
            return None, f"bestand uit -F niet leesbaar ({e})"
    if reuse or (amend and no_edit):
        return "__SKIP__", "hergebruik bestaande commit-tekst"
    return None, "geen -m of -F: de commit-tekst is voor de check niet leesbaar (editor-commit, --fixup/--squash zonder -m)"


def check_text(text: str, source: str) -> None:
    hit = next((REVIEW_RE.match(ln) for ln in text.splitlines() if REVIEW_RE.match(ln)), None)
    if hit is None:
        deny('geen regel die begint met "Review-log:" in de commit-tekst (bron: ' + source + "). "
             "Zet als eerste regel `Review-log: <stappen>` of, voor docs-only, "
             "`Review-log: n.v.t. — <reden>` (plan §5 B50).")
    body = hit.group(1).strip()
    if not body:
        deny("`Review-log:` zonder inhoud. Noem de gedraaide/overgeslagen stappen, of `n.v.t. — <reden>`.")
    if body.lower().startswith(("n.v.t", "nvt")):
        m = NVT_RE.match(body)
        if not m or not m.group(1).strip():
            deny("`Review-log: n.v.t.` zonder reden. De uitzondering vereist `n.v.t. — <reden>` "
                 "(bv. `n.v.t. — docs-only (plan-update)`), zodat de poort nooit stil blokkeert.")


def run() -> None:
    payload = json.load(sys.stdin)
    if not isinstance(payload, dict):
        sys.exit(0)
    ti = payload.get("tool_input")
    cmd = ti.get("command") if isinstance(ti, dict) else None
    if not isinstance(cmd, str):
        sys.exit(0)
    if "commit" not in cmd and not re.search(r"\benv\b", cmd):
        sys.exit(0)  # `env` altijd keuren: `env -S` kan een commit uit ${VAR}-delen samenstellen (koude review I-2)
    cwd = payload.get("cwd")
    cwd = cwd if isinstance(cwd, str) and cwd else os.getcwd()
    # heredoc-inhoud apart houden (voor -F -) en uit het commando knippen; de rest blijft parsebaar
    heredocs = [m.group(3) for m in HEREDOC_RE.finditer(cmd)]
    stripped = HEREDOC_RE.sub(" ; ", cmd)  # einde heredoc = commandogrens
    stripped = re.sub(r"<<-?\s*(['\"]?)\w+\1", " ", stripped)
    stripped = newlines_to_separators(stripped)
    try:
        toks = tokenize(stripped)
    except ValueError:
        if re.search(r"\bgit\b[^|;&]*\bcommit\b", stripped):
            deny("commando niet te ontleden (aanhalingstekens?) en het bevat `git commit`; "
                 "gebruik `git commit -m \"Review-log: ...\"` met sluitende quotes.")
        sys.exit(0)
    found = False
    for seg in split_segments(toks):
        is_commit, c_dir, args = parse_git_commit(seg)
        if not is_commit:
            continue
        found = True
        text, source = message_from_args(args, heredocs, cwd, c_dir)
        if text == "__SKIP__":
            continue
        if text is None:
            deny(f"{source}. Gebruik `git commit -m \"Review-log: ...\"` of `-F <bestand>` met een Review-log-regel "
                 f"(uitzondering: `Review-log: n.v.t. — <reden>`).")
        check_text(text, source)
    sys.exit(0 if found or True else 0)


def main() -> None:
    try:
        run()
    except SystemExit:
        raise
    except Exception:
        # eigen fout: nooit blokkeren (fail-open op eigen bug, zoals guardrail.py)
        sys.exit(0)


if __name__ == "__main__":
    main()
