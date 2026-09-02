# The Mandatory 9-Stage Post-Coding Review Pipeline

A hand-off document. Everything needed to adopt this pipeline is in this file —
no other repo docs required.

---

## What this is

A fixed sequence of nine review stages that runs **after any coding work that
changes repository files** and **before that work is called done, committed, or
shipped**. It applies to backend, frontend, mobile, scripts, config, and docs
that affect implementation.

It exists because AI-assisted coding fails in a specific, repeatable way: the
code compiles, the tests pass, the diff looks plausible — and it still contains
a dead helper nobody calls, a re-validation of already-validated data, a
swallowed error, or a trust-boundary hole. A single review pass does not catch
these, because a single reviewer has a single bias. The pipeline stacks passes
with *different* biases (bloat, correctness, security, adversarial, automated)
and only exits when two independent automated rounds agree there is nothing new.

**It is not optional and it is not a checklist you tick from memory.** Each
stage produces output you read. A stage you did not run did not happen.

---

## Where the pipeline sits in the wider workflow

The pipeline is **rule 5 of a five-rule mandatory workflow**. The other four are
what make it survivable — running nine review stages on a change that should
never have been written is expensive theatre. In our `CLAUDE.md` they read:

1. **Check in before starting; verify the plan with the human.** No silent
   starts on non-trivial work.
2. **Give a high-level explanation at every step.** The human should never have
   to read the diff to find out what you did.
3. **Make changes minimal — only what the task requires.** Scope creep is the
   single largest source of review load.
4. **Find root causes; never patch over symptoms. No temp fixes.** Before
   editing, grep every caller of the function you are about to touch: one guard
   in the shared function is a smaller diff than a guard in every caller, and
   patching only the path the ticket names leaves every sibling caller broken.
5. **After any coding work that changes repo files, run the mandatory 9-stage
   review pipeline. If a stage can't run, say which and why — never skip
   silently.**

Rules 1–4 shrink the diff; rule 5 proves the diff. Adopt them together — the
pipeline on top of unbounded, symptom-level changes just certifies the wrong
code more thoroughly.

Two supporting policies from the same file are worth carrying over because
reviewers keep tripping on them:

- **Don't create new `.md` files unless explicitly requested.** Review output
  belongs in the PR body or the working log, not in a new status document.
- **Test timeout: 300 s wall, 30 s per method.** A stage-2 baseline that hangs
  is a failed baseline, not a slow one.

---

## The non-negotiable rules

1. **No silent skips.** If a stage cannot run — missing tool, no credential, no
   network, no emulator, no PR — you say *which stage*, *why*, and *what you ran
   instead*. Silence is the failure mode this whole document exists to prevent.
2. **Never delete pre-existing code without an explicit yes from a human.**
   Bloat *introduced by the current change* may be removed on sight. Bloat that
   was already there gets queued as a question, not a commit.
3. **Evidence, not assertion.** "Tests pass" is a claim. The literal command
   output pasted in the working log is evidence. Only evidence closes a stage.
4. **Fix rounds breed bloat.** That is why the bloat audit runs twice — once
   before review and once over the final cumulative diff.
5. **Delegated work inherits nothing.** If you hand a stage to a subagent, the
   brief must restate these rules. An unbriefed agent will claim success without
   running anything.

---

## The nine stages

### Stage 1 — Bloat audit (pre)

Run a bloat audit scoped to the diff and the files just touched, **before any
other review**. Hunting specifically for what AI coders over-produce:

- dead code and unreachable branches
- helpers called exactly once (inline them)
- safety checks for impossible conditions
- re-validation of data already validated upstream
- middleman functions that only forward arguments
- "just in case" leftovers and config knobs nobody will ever change

**Investigate before flagging.** Dynamic call sites are invisible to grep:
dependency-injection graphs (Hilt/Dagger/Spring), reflection, serializer-bound
DTOs (Jackson/Retrofit/Codable), layout- or template-inflated views, entrypoints
named in config files. A "dead" function may have exactly one caller and that
caller may be a framework.

Strip self-introduced bloat now. Queue pre-existing findings as questions.

*Why first?* Reviewing bloat wastes every downstream reviewer's attention on
code that should not exist. Delete before you scrutinize.

### Stage 2 — Baseline

Inspect `git status`, identify every changed file, and run the relevant
unit/integration/build checks for the touched platform.

**If it does not compile, stop and fix it before any reviewer runs.** Reviewing
code that does not build produces findings about code that will change.

Record the baseline you must not regress: test count, pass count, build status.
Every later stage is measured against this number.

### Stage 3 — Code reviewer

A cold code-review pass over the diff against the appropriate base branch —
"cold" meaning the reviewer reasons from the diff, not from the memory of having
written it. Priority order: **bugs → security → correctness**, then everything
else.

Read the diff as an adversary reading someone else's code: what input makes this
branch wrong, what happens on the error path, what does this assume about
ordering, nullability, or concurrency that nothing enforces.

### Stage 4 — Security review

Run a security-focused pass when the change touches any trust boundary:

auth · permissions and roles · network input · storage and file paths · admin
paths · parsers and deserializers · external URLs · secrets and credentials ·
billing and money paths · anything crossing a process or user boundary.

If the change touches none of these, say so explicitly and move on — that is a
recorded judgment, not a skip.

### Stage 5 — Adversarial challenge

A second-opinion pass whose job is to *disagree*. A different model, a different
tool, or at minimum a different prompt framing than stage 3. The instruction is
not "review this" but "find what the previous reviewer missed and argue the
change is wrong."

This is the stage that catches consensus errors — the bug both you and the first
reviewer accepted because you shared an assumption.

### Stage 6 — Consolidate findings

Merge everything from stages 1, 3, 4, and 5. Then:

- deduplicate (three reviewers describing one bug is one bug)
- classify severity: Critical / Important / Minor / Nit
- decide explicitly what must be fixed before completion and what is deferred
- for every deferral, write the reason and the follow-up

A finding that is neither fixed nor consciously deferred with a reason is an
unhandled finding.

### Stage 7 — Patch and re-review

Fix all Critical/Important/actionable findings. Re-run the targeted checks and
the relevant review passes until each finding is *closed*, not just *addressed*.

A fix you have not watched turn a failing check green is not a fix.

### Stage 8 — Bloat audit (post)

Re-run the stage-1 audit over the **final cumulative diff**, same rules.

This stage is the one people are tempted to skip, and it is the one that pays.
Fix rounds leave orphaned helpers, dead branches from reworked fixes, tests
covering paths that no longer exist, and abstractions introduced for a design
that got replaced two rounds later. Clean it here so the final automated gate
reviews lean code.

### Stage 9 — Automated final gate

Run your automated reviewer(s) as the final gate. In our setup that is gstack
`/review` followed by **Cubic**:

```bash
cubic review --base <base-sha> --json     # or: cubic review -b <base-sha> -j
```

Run from the repo root. The JSON key is `issues` (not `findings`).

Three things matter here:

1. **Cubic is stochastic.** Each run surfaces a different slice. One clean-ish
   run proves nothing.
2. **Exit rule: two consecutive rounds with no new P0/P1 findings.** Fix a
   batch, re-run, fix, re-run — until two rounds in a row come back clean at
   that bar. If a human sets a narrower bar, follow the explicit bar and report
   which bar you used.
3. **It cannot converge while the tree is moving.** If another agent or process
   is still writing files, stabilize first. Otherwise you are reviewing a
   snapshot that no longer exists.

Severity handling: **P0/P1 block completion** unless fixed, or documented as
pre-existing / architectural deferrals *with a concrete follow-up plan*. **P2
defaults to fix** unless scope was explicitly narrowed. **P3 is judgment.**

---

## Making it an essential part of the workflow

The pipeline only works if it is enforced by something other than good
intentions. Layered, weakest to strongest:

**1. Write it into the agent's standing instructions.** `CLAUDE.md`,
`AGENTS.md`, `.cursorrules`, `GEMINI.md` — whichever your tooling reads every
session. One line in the workflow section:

> After any coding work that changes repo files, run the mandatory 9-stage
> review pipeline. If a stage can't run, say which and why — never skip
> silently.

**2. Restate it in every subagent brief.** Session-level hooks and rule files
fire for the *main* session. A delegated agent receives only what its brief
says. An unbriefed agent skips TDD, claims success without running anything, and
returns no evidence. Every brief must name: the checks to run, the baseline not
to regress, the files it must not touch, and that it must not commit/push/tag/
deploy — the main session ships.

**3. Make it a definition-of-done, not a review step.** "Implemented" is not a
state. The states are *implemented* and *piped*. Nothing merges from the first.

**4. Gate the commit.** Strongest form: a pre-push hook or CI job that refuses
the push without a pipeline record — the stage list, what each produced, and the
two consecutive clean Cubic rounds.

**5. Keep the record in the PR body.** Nine lines, one per stage, each with its
result or its stated reason for not running. It costs a minute and it is the
only artifact that makes stage-skipping visible to a reviewer.

---

## The failure modes it catches (why it earns its cost)

| Failure | Caught by |
|---|---|
| Dead helper introduced this change | Stage 1 |
| Broken build handed to reviewers | Stage 2 |
| Off-by-one, null path, wrong error branch | Stage 3 |
| Unvalidated input at a trust boundary | Stage 4 |
| Bug both you and reviewer #1 assumed away | Stage 5 |
| Findings lost between passes | Stage 6 |
| "Fixed" without confirmation | Stage 7 |
| Orphaned code left by fix rounds | Stage 8 |
| Whatever five human-shaped passes still missed | Stage 9 |

---

## One-page summary

```
1. Bloat audit (pre)      → delete self-introduced bloat, queue the rest
2. Baseline               → git status, build, tests; must compile
3. Code reviewer          → cold pass: bugs → security → correctness
4. Security review        → only if trust boundaries touched (say so either way)
5. Adversarial challenge  → different reviewer, told to disagree
6. Consolidate            → dedupe, classify, decide fix vs. deferral
7. Patch and re-review    → fix and watch it close
8. Bloat audit (post)     → same rules, final cumulative diff
9. gstack /review + Cubic → until TWO consecutive rounds, no new P0/P1
```

Never skip silently. Never delete pre-existing code without an explicit yes.
Evidence, not assertion.
