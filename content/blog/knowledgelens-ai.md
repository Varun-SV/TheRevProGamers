---
title: "KnowledgeLens AI: turning documents into a graph you can interrogate"
date: 2026-08-06
description: "Upload PDFs, code or XML and get an interactive knowledge graph out — then ask questions answered only from the extracted relationships, not from whatever the model already believed."
tags: [projects, python, llm, rag, streamlit]
type: project
repo: https://github.com/Varun-SV/KnowledgeLens-AI
author: Varun SV
---

Chatting with a PDF is a solved problem and a slightly unsatisfying one. You get answers, but you have no idea what the model actually drew on, and no view of how the ideas in the document connect to each other. The document goes in, prose comes out, and the structure in between stays invisible.

KnowledgeLens AI makes the structure the product. Documents go in; **an interactive knowledge graph** comes out — entities, concepts and the relationships between them, laid out as something you can zoom, drag and explore.

## What it takes and what it does

Feed it PDFs, Markdown, plain text, code (`.py`, `.js`, `.java`, …), JSON or XML. An LLM extracts the entities and the relationships between them, and `pyvis` plus `networkx` render the result as a live graph.

Two features matter more than the rest:

**Master concept detection.** It works out the central theme of what you uploaded, or you set it manually. Without this, graphs over any real document collapse into an unreadable hairball — everything connects to everything, and no node is more important than any other. Anchoring on a master concept is what gives the layout a spine.

**Graph-augmented chat.** You can ask questions, and answers are grounded *only* in the extracted graph — the entities and relationships that were actually pulled out of your documents. Not the model's pretraining. If the graph doesn't contain it, you don't get told it.

That constraint is the whole point. A normal RAG chat blends retrieved context with everything the model already believed, and you cannot tell which is which. Restricting answers to the graph makes the failure mode visible: a wrong answer means a wrong edge, and you can go look at the edge.

## Provider-agnostic by design

It talks to any OpenAI-compatible endpoint:

- **Ollama** — fully local, nothing leaves the machine
- **llama.cpp** — same
- **OpenAI API** — when you want the quality

The base URL is a text field in the sidebar. That was a deliberate constraint from the start, because the documents people most want to build a graph from are frequently the ones they cannot send to a third party. Contracts, internal specs, private codebases. Being able to point it at `http://localhost:11434` and have it work identically is the difference between a demo and something usable at work.

## Persistence and export

Graph extraction over a large document set is slow and costs tokens, so the graph state saves and loads — you pick up where you left off rather than reprocessing. Export is available as JSON or human-readable text, so the graph can leave the tool and go into whatever comes next.

## Running it

```bash
git clone https://github.com/Varun-SV/KnowledgeLens-AI
cd KnowledgeLens-AI

python -m venv venv
source venv/bin/activate        # .\venv\Scripts\activate on Windows

pip install -r requirements.txt
streamlit run KnowledgeLens_AI.py
```

Opens at `http://localhost:8501`. Set the base URL in the sidebar — `http://localhost:11434` for Ollama, `http://localhost:8080` for llama.cpp, `https://api.openai.com/v1` for OpenAI — plus an API key if your endpoint wants one.

Needs Python 3.8+ and a running LLM endpoint. If you're using Ollama, pull a model first:

```bash
ollama run llama3.1
```

## Where it's genuinely useful

Where I keep reaching for it: **an unfamiliar codebase**, where the graph shows which modules actually reference which; and **a stack of related documents**, where the interesting thing is the connection between two of them that neither one states directly.

Where it isn't the right tool: a single short document you could just read. The graph is overhead that only pays for itself once there is more material than you can hold in your head at once.

MIT licensed, [on GitHub](https://github.com/Varun-SV/KnowledgeLens-AI).
