---
title: "Cascade AI: what happens when your CLI runs an org chart instead of an agent"
date: 2026-08-16
description: "Most AI CLIs run one agent on one expensive model. Cascade runs a three-tier hierarchy that plans, delegates and executes in parallel — routing each step to the cheapest model good enough for it."
tags: [projects, ai, typescript, cli, agents]
type: project
repo: https://github.com/Varun-SV/Cascade-AI
author: Varun SV
---

Every AI coding CLI I'd used had the same shape: one agent, one model, one very long conversation. That works, and it also means you pay frontier-model prices for every trivial step — reading a file, running a lint command, renaming a variable. The expensive model does the thinking *and* the typing.

Cascade is my attempt at the other design. One prompt goes in, and what comes out the other side isn't an agent — it's an organisation.

```bash
cascade "Refactor the auth module to use JWT, add tests, and open a PR"
```

## Three tiers, not one agent

The core idea is a hierarchy that mirrors how actual teams work:

- **T1 plans.** A premium model reads your request, decides the shape of the work, and produces an org chart — how many managers, how many workers, and a budget estimate.
- **T2 manages.** Mid-tier models take a slice of the plan each and break it into concrete tasks.
- **T3 executes.** Cheap — usually *local* — models do the actual file editing, shell running and grepping.

The point is that step three is where almost all the tokens go, and step three is the part that doesn't need a frontier model. A local Llama running through Ollama can apply an exact string replacement perfectly well. It doesn't need to also be capable of writing a migration strategy.

Each tier has its own routing priority:

| Tier | Priority order |
|---|---|
| T1 | Anthropic → OpenAI → Google *(never local)* |
| T2 | Anthropic → OpenAI → Google → Local (≥70B) |
| T3 | **Local first** → Anthropic → OpenAI → Google |

Set a tier to `Auto` and Cascade fuses live public benchmark scores with live pricing to pick the best *value* model for that step — not the best model, the best ratio. Those two are rarely the same thing.

## The number I most wanted to see

Every run prints what the hierarchy saved you:

```
$0.031 · saved $0.094 — 75% vs. all-T1
```

That line is the entire thesis of the project in one string. A flat single-agent tool structurally cannot show you this number, because there's no counterfactual — it only ever ran one way. Cascade knows what the work would have cost if T1 had done all of it, so it can tell you what delegating bought.

On larger runs the gap widens considerably; the README's headline claim is up to 90% cheaper, and the delegation-heavy runs are where that comes from.

## The parts I didn't expect to need

Some features started as nice-to-haves and became the ones I use constantly.

**The boardroom.** With `planApproval: "always"`, complex runs stop before spawning anything and show you T1's proposed org chart with a budget — *"3 managers · 7 workers · est. $0.40"* — plus a critique from a separate AI reviewer. You can edit the plan, steer it, or kill it. Catching a bad plan here costs nothing. Catching it after seven workers have run costs forty cents and a dirty working tree.

**`/comms`.** A live feed of the agents talking to each other: peer messages, broadcasts, file locks, barrier syncs. I built it to debug a deadlock and kept it because watching an agent organisation coordinate is genuinely legible in a way that a single scrolling transcript isn't.

**`/why`.** Any run can explain itself — the complexity verdict, the classifier's reasoning, which model served each tier, what failed over, what escalated. When a run goes strangely, this is the first thing I check.

**`/continue`.** Hit the budget cap halfway through something big and you resume from partial state rather than redoing it. This one exists purely because I lost a long run to a cap once and was annoyed enough to fix it.

**Workers recruiting workers.** A T3 worker that finds its task fanning out can ask its manager to spawn bounded siblings. Parallelism that responds to the actual shape of the work, rather than whatever T1 guessed up front.

## Safety, because delegation cuts both ways

An organisation of agents with shell access is a larger blast radius than one agent with shell access. The guardrails are deliberate:

- **Permission escalation runs upward** — T3 asks T2, T2 asks T1, T1 asks you. A worker can't grant itself anything.
- **Budget cap is a hard stop**, not a warning.
- **SSRF-guarded fetch**, and the dashboard binds to loopback only.
- **`.cascadeignore`** marks files agents may not touch at all.
- In autonomous mode (`/auto`), safe tools run silently but dangerous ones still ask.

## Getting it running

```bash
npm install -g cascade-ai   # needs Node ≥ 22

cd my-project
cascade init
export ANTHROPIC_API_KEY=sk-ant-...
```

For the cost savings to actually materialise you want Ollama installed so T3 has somewhere local to run:

```bash
ollama pull llama3.2:3b
```

Six providers are supported — Anthropic, OpenAI, Gemini, Azure OpenAI, any OpenAI-compatible endpoint (Groq, Together, custom), and Ollama. T3 workers get shell, file, diff, git, GitHub/GitLab, Playwright browser and image tools, and there's MCP support for connecting anything else.

## Where it stands

It's MIT licensed and [on GitHub](https://github.com/Varun-SV/Cascade-AI). The idea I'd defend hardest is the one underneath all of it: **model choice should be a per-step decision, not a per-session one.** Once you accept that, the hierarchy follows naturally — and so does the bill.
