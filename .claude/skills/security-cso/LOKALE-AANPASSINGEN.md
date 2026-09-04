# Lokale aanpassingen t.o.v. gstack (RV 2, 2026-09-04)

Bron: `https://github.com/garrytan/gstack` commit `0d1bd5616c0ef096bb7ccee336f63c60ee408618` (0d1bd5616c0e (v1.79.0.0, 2026-09-01)), licentie MIT (`LICENSE-MIT.txt`).
Gebouwd met `~/projects/_scratch/rv2-build-gstack-copies.py` uit de `.tmpl`-bronnen + de gerenderde secties die de
placeholders vullen. Geen symlink, geen auto-update, geen gstack-binaries, geen telemetrie (RV 0 §2.1, plan "Waarom gstack niet als geheel").
Vaste regels: bij tegenspraak wint `CLAUDE.md`; Fix-First uit (ASK-only); bloat-uitzondering B47.

## Vervangingen (geteld door het bouwscript)
- cso frontmatter: name cso → security-cso, versie gepind
- cso PREAMBLE: 1× vervangen
- GBRAIN_CONTEXT_LOAD: 1× vervangen
- GBRAIN_SAVE_RESULTS: 1× vervangen
- cso SECTION_INDEX: 1× vervangen
- cso LEARNINGS_SEARCH: 1× vervangen
- cso CONFIDENCE_CALIBRATION (uit render): 1× vervangen
- SECTION:audit-phases: 1× vervangen
- cso LEARNINGS_LOG: 1× vervangen
- cso rapportmap → docs/review-pipeline/security (B51): 3× vervangen
- cso TODOS.md → plan §5: 1× vervangen
- cso gitignore-advies: 1× vervangen
- cso/sections/audit-phases.md: AUTO-GENERATED-kop → LOKALE KOPIE-kop (1×)
- gekopieerd: cso/sections/audit-phases.md → .claude/skills/security-cso/sections/audit-phases.md
- cso/ACKNOWLEDGEMENTS.md gekopieerd
