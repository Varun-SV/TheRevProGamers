---
title: "mrx: one session, three models, three different jobs"
date: 2026-08-17
description: "Assign a reasoning model to think, a cheap model to write, and a third to call tools — mixing Ollama, OpenAI, Anthropic and OpenRouter in the same conversation."
tags: [projects, ai, typescript, cli, llm]
type: project
repo: https://github.com/Varun-SV/mrx
author: Varun SV
---

There is a specific waste in how most people use LLMs: you pick one model at the start of a conversation and it does everything. It reasons through the hard part *and* formats the bullet list *and* decides which file to read. Those are three different jobs with wildly different difficulty, and you're paying reasoning prices for all of them.

mrx splits them apart. One interactive session, three roles, and you decide which model fills each.

```bash
npm install -g mrx-ai
mrx ask "explain recursion"
```

It works with no config at all — defaults to Ollama with `qwen3:8b` reasoning and `llama3.1:8b` executing, so if you have Ollama running the whole thing costs nothing and never leaves your machine.

## The three roles

- **reasoner** — thinks through the problem. The expensive one, if any of them is.
- **executor** — turns that thinking into the answer you actually read.
- **tool_caller** — decides which tool to invoke and with what arguments. Optional; falls back to the executor.

The config is the whole idea in one file:

```yaml
models:
  reasoner:
    provider: ollama
    model: qwen3:14b
    temperature: 0.6

  executor:
    provider: openai
    model: gpt-4o-mini
    temperature: 0.7

  tool_caller:
    provider: openrouter
    model: google/gemini-flash-1.5
    temperature: 0.2
```

Three providers, one session. Ollama, OpenAI, Anthropic, Google Gemini, LM Studio and OpenRouter are all supported and freely mixable. There is no vendor whose SDK the whole thing is built around, which was deliberate — the moment your orchestration is coupled to one provider you've lost the ability to put the cheap model where the cheap model belongs.

Note the temperatures, too. The reasoner runs warm because exploration helps when you're thinking. The tool caller runs cold at 0.2 because creative JSON is a bug.

## Three ways to route

**`think_then_answer`** (default) — the reasoner works through the problem inside `<thinking>` tags, then the executor writes the user-facing response using that reasoning as context. Good for architecture questions and anything where the answer needs depth but the prose doesn't need genius.

**`planner_executor`** — the reasoner produces a numbered plan; the executor works through it step by step and synthesises a final answer. Good for multi-step tasks with clear sub-problems.

**`manual`** — you route by hand. Prefix a message with `@reasoner`, `@executor` or `@tool_caller`; no prefix goes to the executor.

```bash
mrx chat   # then: @reasoner what's the best architecture for X?
```

Manual mode started as a debugging aid and became the mode I use most. Once you can feel which questions actually need the big model, you stop delegating that decision.

## The TUI

`mrx chat` opens an interactive session:

| Key | Action |
|---|---|
| `Enter` | Send |
| `Ctrl+M` | Cycle interaction mode |
| `Ctrl+R` | Toggle reasoning visibility |
| `Ctrl+C` | Quit |

`Ctrl+R` matters more than it sounds. Being able to flip the reasoner's trace on mid-conversation — and see *why* the answer came out the way it did — is the difference between trusting the routing and hoping it works.

Sessions persist if you want them to:

```yaml
session_memory: true
session_db_path: ~/.mrx/sessions.db
```

```bash
mrx sessions                      # list them
mrx chat --session a1b2c3d4       # resume one
```

## Tools, and a warning

Three tools, all opt-in:

| Tool | Config | Does |
|---|---|---|
| Shell | `tools.shell: true` | Runs bash via `execa` |
| File system | `tools.file_system: true` | Read, write, list |
| Web fetch | `tools.web_fetch: true` | Fetch a URL, extract text |

**`shell: true` runs model-requested bash commands directly, with no confirmation step.** That is stated plainly in the README and I'll restate it here: leave it off unless you trust both the input and the models, and you're in a sandbox. It's off by default for exactly this reason.

## How this relates to Cascade

Fair question if you've read [the Cascade AI write-up](/blog/cascade-ai/), because these are two answers to the same observation — that model choice should be per-step, not per-session.

They differ in shape:

- **Cascade** builds a *hierarchy that spawns workers.* One prompt fans out into managers and workers running in parallel, and you get a delegation receipt at the end. It's built for a whole task you hand over.
- **mrx** is a *conversation you stay inside.* No spawning, no org chart — three named roles and a session you steer, with manual routing when you want it.

Cascade is for "go do this." mrx is for "let's work through this, and I'll decide who thinks."

## Running it

```bash
npm install -g mrx-ai        # needs Node ≥ 22.12
npx mrx-ai ask "..."         # or one-shot, no install
```

```bash
mrx ask <prompt>   # one-shot
mrx chat           # interactive TUI
mrx sessions       # saved sessions
mrx check          # validate config
```

Config goes in `mrx.config.yaml` in the working directory, or `~/.mrx/mrx.config.yaml` for global defaults. API keys as env vars — `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY` — or inline in the config, in which case redact before committing.

MIT licensed, [on GitHub](https://github.com/Varun-SV/mrx), [on npm](https://www.npmjs.com/package/mrx-ai).
