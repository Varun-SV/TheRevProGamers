---
title: "EviCortex: 200 updated facts, zero stale ones packed"
date: 2026-10-29
description: "Agent memory has a quiet failure mode: old facts look exactly as relevant as new ones. EviCortex keeps every observation, tracks what replaced what, and in its first large evaluation packed a superseded source into context 0% of the time. Both chunk baselines did it 100% of the time."
tags: [projects, ai, python, research, agents, memory]
type: project
repo: https://github.com/Varun-SV/EviCortex
author: Varun SV
---

In January, Ada tells her assistant she likes the light theme. In April, she switches to dark. In June, she asks it which theme she prefers.

To a chunk retriever those two sentences are nearly identical. Both mention Ada, both mention a theme, both score well against the question. So both get packed into the prompt, and the model reading that prompt has to guess which one is still true. Sometimes it guesses wrong. Even when it guesses right, the old fact took up budget the new one needed.

That is the failure I built EviCortex to remove. Last week it hit the number I'd been chasing:

```stats
0.00% | Stale sources packed on knowledge-update queries | n = 200 queries. Fixed-chunk FTS and Hybrid RAG: 100% | good
99.27% | Clean contexts at 4,000 tokens | Every gold source, no forbidden one. Both baselines: 89.59%
1,921 | Answerable queries in the matched cohort | Same corpus, same budgets, same query stream
```

Across 200 knowledge-update queries, not one EviCortex context contained a source that a later update had replaced. Both baselines included one every single time.

## Old facts look just as relevant as new ones

Most agent memory today is retrieval-augmented generation wearing a different hat. You chunk the history, index the chunks, and at question time you pull the top few that look most similar to the question. That works for a library of documents that don't change. It works much less well for an assistant that has been running for months, because a long-lived assistant's history is full of facts that *used to be* true.

Similarity search has no idea that one chunk replaced another. "Prefers light" and "switched to dark" are equally close to "which theme does Ada prefer?" Recency weighting helps a bit, but recency isn't truth. The newest mention of a topic isn't always the one that changed it.

The obvious fix is to delete old facts when new ones arrive. I didn't want that either. An assistant that overwrites history can't answer "what did I prefer in February?" and can't show you *why* it believes something. Worse, it can't recover when the "update" turns out to be a mistake.

So the question EviCortex asks is deliberately narrow:

> Can a lossless, temporal memory retrieve the right evidence, and only the right evidence, under a strict token budget as information changes and grows?

## Three planes, one bounded capsule

EviCortex splits three jobs that a typical RAG pipeline fuses into one:

1. **The evidence ledger.** An append-only log of everything observed, exactly as it was recorded. Each entry gets its source, a SHA-256 digest, a namespace, and two timestamps: when the thing happened and when the system learned it. Nothing in here is ever edited. This is the source of truth.
2. **The memory indexes.** Claims, lexical, entity, graph, temporal and optional semantic views built *from* the ledger. A correction becomes a new revision of a claim, not an erasure. These views can be wrong, and they can be thrown away and rebuilt, because the evidence underneath them never moves.
3. **The context compiler.** At question time it ranks candidates, applies a temporal filter, surfaces conflicts and packs the result into a *capsule* under a hard token budget. Every item keeps a stable evidence ID so an agent can expand just the detail it needs later instead of hauling whole transcripts into the prompt.

The internal names are Genome, Engram and Transcript. They're borrowed from biology as metaphors. Nobody is claiming memories are literally stored like DNA.

Here's the Ada example as code. The library has no dependencies outside the Python standard library:

```python
from evicortex import ClaimInput, EviCortex

with EviCortex.open("memory.db") as memory:
    earlier = memory.remember(
        namespace="assistant/user-1",
        content="Ada prefers the light interface theme.",
        source="conversation/7",
        occurred_at="2026-01-02T10:00:00Z",
        claims=[ClaimInput("user:ada", "prefers_theme", "light")],
    )
    memory.remember(
        namespace="assistant/user-1",
        content="Ada switched to the dark interface theme.",
        source="conversation/42",
        occurred_at="2026-04-18T09:30:00Z",
        claims=[ClaimInput("user:ada", "prefers_theme", "dark",
                           supersedes=earlier.claims[0].id)],
    )

    now = memory.recall(
        namespace="assistant/user-1",
        query="Which interface theme does Ada prefer?",
        budget_tokens=300,
    )
    then = memory.recall(
        namespace="assistant/user-1",
        query="Which interface theme did Ada prefer?",
        as_of="2026-02-01T00:00:00Z",
        budget_tokens=300,
    )
```

The April claim supersedes the January one, so `now` packs only `dark`. Both observations stay in the ledger, and `then` packs `light`, valid from 2 January to 18 April, because that was true on 1 February. **History is a query, not a deletion.**

Supersession is explicit: an update names the claim it replaces. If two claims disagree and nothing says which one won, EviCortex doesn't guess. It packs both and flags them as a conflict, so the model reading the capsule knows there's a disagreement instead of quietly picking one.

## The results

The latest numbers come from interim results with a 25 October 2026 cutoff. There are three things worth looking at, and one of them is not flattering.

### Stale facts stay out

This is the headline, and it's the clearest result in the set:

```chart
title: Stale-source inclusion on knowledge-update queries
note: n = 200 · 512-token budget · lower is better
unit: %
series: EviCortex, Fixed-chunk FTS, Hybrid RAG
Contexts that packed a superseded source: 0, 100, 100
caption: Every query here asks about a fact that changed. Both baselines retrieved the replaced version alongside the current one in all 200 queries. EviCortex did it in none of them.
```

That 0% doesn't come from luckier ranking. Superseded evidence drops out at the temporal filter, before the packer ever sees it, so it never has to be outranked. Making that guarantee hold by construction in every code path is still on the roadmap below.

### Clean contexts at realistic budgets

The stricter question: did the packed context contain *every* gold source *and no* forbidden one? Over the matched cohort of 1,921 answerable queries:

```chart
title: Every gold source, no forbidden one
note: Matched answerable cohort · n = 1,921
unit: %
series: EviCortex, Fixed-chunk FTS, Hybrid RAG
512 tokens: 65.12, 89.59, 89.59
4,000 tokens: 99.27, 89.59, 89.59
caption: At 4,000 tokens EviCortex delivers a clean context in 99.27% of queries. The baselines plateau at 89.59% whatever the budget, because the problem for them isn't space. It's that they keep packing things they shouldn't.
```

The baselines' line is flat for a reason. They find every gold source at every budget, but in about one query in ten they also pack something that should never have been there. More budget can't fix that. It only gives the wrong evidence more room.

### The part that isn't solved yet

Here's the chart I'd rather not show, and the one that matters most for what comes next:

```chart
type: line
title: Mean gold-source recall by budget
note: Matched answerable cohort · n = 1,921 · higher is better
unit: %
series: EviCortex, FTS and Hybrid RAG (identical)
512: 71.73, 100
1,000: 69.99, 100
2,000: 69.73, 100
4,000: 99.27, 100
8,000: 100, 100
caption: Below 4,000 tokens, EviCortex recovers only about 70–72% of gold source IDs, while both chunk baselines recover all of them.
```

```note
title: Small budgets are the open problem
tone: warn
At 512 tokens the baselines fit *all* the gold evidence into the budget, so space isn't what's stopping EviCortex. The gap comes from what it selects and how it serializes the result. That is fixable engineering rather than a wall, and it is where all of my current effort is going.
```

That tradeoff is the honest picture right now. EviCortex never lets stale evidence in, but at tight budgets it sometimes leaves out evidence it should have kept. The baselines keep everything, including the things that are wrong.

## What these numbers do and don't say

I'd rather be precise than impressive, so here is exactly what was measured:

| Setting | What was used |
|---|---|
| **Corpus** | An authored evaluation corpus, *not* the official LongMemEval-S dataset |
| **Mode** | Retrieval only. No reader model generated an answer |
| **What's scored** | Which evidence IDs end up inside the packed context |
| **Budgets** | 512, 1,000, 2,000, 4,000 and 8,000 estimated tokens |
| **Token count** | One token per three UTF-8 bytes, not a real model tokenizer |
| **Baselines** | Fixed-chunk full-text search and a Hybrid RAG comparator |

These are **source-ID retrieval proxies, not answer accuracy.** Getting clean evidence into the prompt is necessary for a correct answer, but it isn't the same thing as one. Nothing here compares EviCortex with Mem0, Graphiti or HippoRAG 2, and nothing here uses the official benchmark yet. Those come next, and they're the comparisons that would actually settle the question.

The earlier checkpoints were honest about costs too. The July prototype used about 40% fewer context tokens than a mechanical lexical baseline and fixed its update failures, but it needed roughly 50% more storage and had slower median lookups. Keeping everything and indexing it several ways isn't free.

## What's next

The roadmap is staged so the 0% stale result can't quietly slip while recall improves:

- **Phase 1, no models.** A per-stage audit of where gold evidence gets dropped, a fine-grained budget sweep, a budget-monotone knapsack packer, a compact provenance legend, and a temporal annotate-then-guard step so 0% stale holds by construction.
- **Phase 2, local retrieval.** A dense or learned-sparse channel fused with reciprocal-rank fusion, plus cross-encoder reranking for histories full of paraphrases and distractors.
- **Phase 3, optional LLM.** Ingest-time proposition keys, multi-hop expansion over valid edges and conditional query rewriting, each reported as a separate variant so the model-free numbers stay visible.
- **Then the real tests.** The official LongMemEval-S evaluation with a byte-verified dataset and a preregistered configuration, then a shared reader model for actual answer accuracy with exact tokenizer accounting.

There's also a paper in preparation: *EviCortex: evidence-preserving temporal memory under token budgets.* It will report final numbers, not the interim ones in this post.

## Try it

```bash
git clone https://github.com/Varun-SV/EviCortex.git
cd EviCortex
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e .
python examples/quickstart.py
```

It needs Python 3.12 and SQLite with FTS5, which ships with standard CPython builds. It's MIT licensed, pre-alpha, and very much research software. The [project site](https://varun-sv.github.io/EviCortex/) has the full results, the benchmark contract and the docs.

The idea I'd defend hardest is the one underneath all of it: **memory for a long-lived system should never forget, but it should always know what's no longer true.** Those two goals sound like they pull against each other. Separating the evidence from the views over it is what lets you have both.
