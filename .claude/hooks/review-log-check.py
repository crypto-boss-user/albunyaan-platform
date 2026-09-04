#!/usr/bin/env python3
"""PreToolUse-check (Bash) — Review-log-conventie, repo-eigen (plan §5 B50, RV 2, 2026-09-04).

Weigert een `git commit` waarvan de commit-tekst geen regel bevat die begint met "Review-log:".
Expliciete uitzondering: "Review-log: n.v.t. — <reden>" — de reden is verplicht, zodat de poort
nooit stil blokkeert en een docs-only commit altijd door kan met één eerlijke regel.

Wat de check leest (per commit-segment; ELK `git … commit` in een keten wordt beoordeeld):
  -m/--message (meerdere = alinea's), -Xm/-Xm<tekst> gecombineerd, --message=…, -F/--file <pad>
  (relatief aan `git -C <dir>` of anders aan de cwd van de sessie; alleen gewone bestanden, max 1 MB),
  -F - met een heredoc in hetzelfde commando. `--amend --no-edit`, -C/-c <commit>, --reuse-message,
  --help, --dry-run → doorlaten. Geen leesbare tekst (editor-commit, -F uit een variabele, --fixup/--squash
  zonder -m) → weigeren met uitleg.
Alles wat geen echte `git commit` is (ook de tekst "git commit" binnen quotes/heredocs): exit 0.
Malformed hook-input of een eigen fout: exit 0 (nooit blokkeren op eigen bug — zelfde keuze als guardrail.py).
Deny = exit 2 + reden op stderr (Claude ziet het en past de commit-tekst aan).
Bekend en bewust niet gedicht (conventie eerst, B50): TOCTOU op een -F-bestand dat in hetzelfde commando
wordt herschreven; commits via gh/merge/cherry-pick/rebase/commit-tree/scripts; -m "$(…)"/"$VAR" wordt geweigerd.
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
SEP = ("&&", ";", "||", "|")
GIT_GLOBAL_WITH_ARG = ("-C", "-c", "--git-dir", "--work-tree", "--exec-path", "--namespace")
GIT_GLOBAL_FLAGS = ("--no-pager", "--paginate", "-p", "--bare", "--literal-pathspecs", "--no-optional-locks")
MAX_MSG_BYTES = 1_000_000


def deny(reason: str) -> None:
    print(f"REVIEW-LOG CHECK GEWEIGERD: {reason}", file=sys.stderr)
    sys.exit(2)


def newlines_to_separators(s: str) -> str:
    """Een newline buiten aanhalingstekens scheidt commando's (zoals `;`); binnen quotes blijft hij staan."""
    out, q, esc = [], None, False
    for ch in s:
        if esc:
            out.append(ch); esc = False; continue
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


def split_segments(toks):
    seg, out = [], []
    for t in toks:
        if t in SEP:
            if seg:
                out.append(seg)
            seg = []
        else:
            seg.append(t)
    if seg:
        out.append(seg)
    return out


def parse_git_commit(seg):
    """Geeft (is_commit, c_dir, argv_na_commit)."""
    if not seg or os.path.basename(seg[0]) != "git":
        return False, None, []
    i, c_dir = 1, None
    while i < len(seg):
        t = seg[i]
        if t in GIT_GLOBAL_WITH_ARG:
            if t == "-C" and i + 1 < len(seg):
                c_dir = seg[i + 1]
            i += 2
            continue
        if t.startswith(("--git-dir=", "--work-tree=", "--exec-path=", "--namespace=", "-c")) and t != "-c":
            i += 1
            continue
        if t in GIT_GLOBAL_FLAGS:
            i += 1
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
    if not isinstance(cmd, str) or "commit" not in cmd:
        sys.exit(0)
    cwd = payload.get("cwd")
    cwd = cwd if isinstance(cwd, str) and cwd else os.getcwd()
    # heredoc-inhoud apart houden (voor -F -) en uit het commando knippen; de rest blijft parsebaar
    heredocs = [m.group(3) for m in HEREDOC_RE.finditer(cmd)]
    stripped = HEREDOC_RE.sub(" ; ", cmd)  # einde heredoc = commandogrens
    stripped = re.sub(r"<<-?\s*(['\"]?)\w+\1", " ", stripped)
    stripped = newlines_to_separators(stripped)
    try:
        toks = shlex.split(stripped, posix=True)
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
