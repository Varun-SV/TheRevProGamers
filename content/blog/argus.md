---
title: "Argus: GUI testing without a single selector"
date: 2026-08-13
description: "Describe the behaviour you want validated and let a multimodal model drive the app like a person would. Plus the isolation problem that forced me to put the whole thing inside disposable VMs."
tags: [projects, python, testing, ai, automation]
type: project
repo: https://github.com/Varun-SV/Argus
author: Varun SV
---

Every GUI test suite I have ever maintained died the same death. Not from bugs — from selectors. Someone renames a button, restructures a panel, swaps a component library, and forty tests go red without a single one having found a real defect. The suite stops being a safety net and becomes a tax.

Argus is the alternative I wanted: **describe the behaviour, not the DOM path.**

```text
$ argus run checkout.test.yaml

Argus v0.1.0 · provider: ollama:gemma3:9b

Running checkout.test.yaml…
  ✓  Type 'hello from argus' into the editor          2.31s
  ✓  text_visible: 'hello from argus'                  0.12s
  ✓  Open the File menu                                1.08s
  ✓  element_exists: {name: Save, control_type: MenuItem}  0.09s

4 passed · 0 failed · 0 skipped · 3.6s · 1840 tokens · exit 0
```

A multimodal model looks at the application, decides what to do, does it, and verifies the result — the same loop a human tester runs. "Open the File menu" keeps working when the menu moves, because there is no recorded coordinate to go stale.

It drives Windows desktop GUIs, web apps through Playwright, CLI tools and plain scripts.

## The problem that reshaped the project

The first version drove the local desktop directly. That works, and it is also a genuinely bad idea for anything but development.

An LLM with synthetic mouse and keyboard control over *your actual desktop* is not sandboxed in any meaningful sense. A misread screen and it's clicking through something it shouldn't. Worse, it's non-deterministic: the same test can behave differently depending on what else is on screen. Test runs and the operator's real work were sharing one input space, and there was nothing but good intentions between them.

So execution got split from targeting:

```text
Runner / Roam
     |
     v
ExecutionEnvironment
   |            |
   |            +---- CapsuleExecutionEnvironment
   |                       |
   |                       v
   |                  Capsule provider (Hyper-V / libvirt)
   |                       |
   |                       v
   |                  Guest adapter
   |
   +---- LocalExecutionEnvironment
                |
                v
             Adapter
```

## Capsules

A **Capsule** is a disposable VM that the test runs inside. The isolation boundary between Argus-driven input and your desktop is a hypervisor, not a hope.

| Provider | Host | Guest |
|---|---|---|
| Hyper-V | Windows | Windows — disposable Gen-2 VM sessions |
| libvirt/QEMU/KVM | Linux | Linux — isolated KVM with qcow2 overlays |
| `auto` | either | picks the host-appropriate provider |

The design details that matter:

- **Pinned HTTPS guest control** in production mode, with bootstrap-to-random per-session bearer rotation — a leaked token from one session is worthless in the next.
- **Isolated networking** and fail-closed provider capabilities.
- **Explicit staging** host→guest and artifact collection guest→host. Nothing crosses implicitly.
- **Failure Capsules** — optionally retain the VM after a failed `argus run` so you can open the machine and see exactly what state the failure happened in. Post-mortem debugging on a real snapshot rather than a screenshot.
- **No silent fallback.** If Capsule requirements can't be met, the run fails. It does not quietly drop to local execution — that's precisely the failure mode that would defeat the point.

`local` remains the default for compatibility and is genuinely useful for development and machines without virtualization. It is a shared, non-isolated environment and the docs say so plainly. On Windows, even local mode defaults to target-constrained semantic UI Automation rather than host-wide physical input injection; legacy physical input is opt-in and should be treated as the higher-risk mode it is.

## Assertions

Natural-language steps are checked by structured assertions, so a pass means something specific:

```yaml
- text_visible: "hello from argus"
- element_exists: { name: Save, control_type: MenuItem }
```

The model decides *how* to reach the state. The assertion decides *whether it got there*. Keeping those separate is what stops "the AI said it worked" from being the whole test result.

## Roam

`argus roam` is the exploratory mode — point it at a target and give it a time budget:

```bash
argus roam "notepad.exe" --minutes 5
argus roam "http://localhost:3000" --adapter browser --minutes 10
argus roam "my-script.sh" --adapter cli
```

It wanders the app looking for things that break. This is the mode that most wants a Capsule, for reasons I hope are obvious.

## Running it

```bash
pip install argus-app-testing
pip install "argus-app-testing[windows]"   # Windows desktop
pip install "argus-app-testing[browser]"   # Playwright
pip install "argus-app-testing[linux]"     # X11/Xvfb
pip install "argus-app-testing[serve]"     # dashboard
```

```bash
argus init            # scaffold .argus/
argus providers       # check provider + vision support
argus run             # every .argus/*.test.yaml
argus watch           # re-run on changes
argus serve           # dashboard
argus tokens          # cumulative token usage
argus gui             # native desktop app
```

Provider and budgets live in `.argus/config.yaml`. It runs against local Ollama models by default — vision-capable ones, since the whole approach depends on the model actually seeing the screen.

## The honest caveat

This is slower and less deterministic than a selector-based suite, and it costs tokens. If your UI is stable and your selectors aren't breaking, Playwright is the better tool and I'd tell you to use it.

Argus earns its place when the UI churns faster than the tests can be maintained, when there is no accessible selector layer at all (native desktop apps, legacy tooling), or when you want exploratory testing that isn't limited to paths someone already thought to write down.

MIT licensed, [on GitHub](https://github.com/Varun-SV/Argus), with a [documentation hub](https://github.com/Varun-SV/Argus/blob/main/docs/README.md) covering the Capsule guides.
