# CLAUDE.md — plainvoice

## Binding decisions (loaded at session boot)

Decisions already made for plainvoice — honor them, don't relitigate. Generated
from the Second Brain; to add one, use `brain.py decision` (see below).

@/Users/lich/secondbrain/projects/plainvoice/DECISIONS.md

## Second Brain (business / decision context)

This repo is wired to the **Second Brain**, a cross-project knowledge base at
`/Users/lich/secondbrain`. Consult it for business context, past decisions, and
cross-project knowledge — **not** code-level details (those stay in this file).

Query it before making product/business decisions:

```bash
/Users/lich/secondbrain/.venv/bin/python /Users/lich/secondbrain/brain.py \
    query "<your question>" --project plainvoice --json
```

Add `--all` to check whether another project already solved something.

## Writing back to the brain

When a durable product/business **decision** or **constraint** is made in a
session — something worth remembering months from now — save it to the brain so
future sessions (and other projects) can find it:

```bash
/Users/lich/secondbrain/.venv/bin/python /Users/lich/secondbrain/brain.py \
    decision --project plainvoice "decided X over Y because Z"
```

**Save** (durable knowledge): pricing/monetization choices, vendor/stack
decisions and *why*, hard constraints (e.g. "MoR must onboard VN sellers"),
direction changes, reusable lessons.

**Do NOT save** (noise): code changes, bug fixes, todos, file-level details,
anything transient — those belong in this repo and its git history, not the brain.

One decision per call, phrased as a single self-contained sentence with the
reasoning. A SessionEnd hook also runs as a backstop, but prefer saving important
decisions explicitly rather than relying on it.

## Code conventions

<!-- TODO: this repo's own code-level context goes here -->
