---
title: "Start here: what this site is for"
date: 2026-08-14
description: "A YouTube channel is a terrible archive. This is the fix — the written half of TheRevProGamers, where the numbers, the sources and the corrections live."
tags: [meta, writing, youtube]
type: post
featured: true
author: Varun SV
---

Video is a wonderful format for showing you a thing and a genuinely awful one for letting you find it again. If I mention a specific fan curve in minute fourteen of a twenty-minute build video, that information is effectively gone. You can't search it, you can't skim it, you can't copy the numbers out of it, and you certainly can't correct it six months later when I turn out to have been wrong.

So this is the other half of the channel. Everything I make a video about ends up here in text, with the parts that video is bad at bolted back on: the raw numbers, the sources, the things I got wrong, and links that don't require pausing to read.

## What actually gets published here

Four kinds of thing, and I try to keep them honestly separated.

**Reviews.** Hardware I have actually used for long enough to have an opinion worth reading. Every review carries a score out of ten, an explicit list of what works and what doesn't, and the specs in a table you can scan in five seconds. If I was sent something for free I say so at the top, in the post, not in a description three scrolls down.

**Build guides.** Step-by-step things I have done myself and would do again. If a guide tells you to buy something, there's a reason attached to it, and usually a cheaper option that I'll admit is nearly as good.

**Project write-ups.** I write code. Some of it is useful. The repos are public and the posts explain the decisions I'd want explained if I were reading someone else's project — the trade-offs, not just the finished thing.

**The gear list.** One page, everything I use, updated when it changes rather than rewritten every quarter for engagement.

## The rules I'm holding myself to

I would rather be trusted than be first, so a few commitments in writing:

- **No sponsored verdicts.** Sponsorships pay for videos, not for opinions. No brand gets to see a review before it's published, and no brand gets to change a score.
- **Affiliate links are labelled.** There are affiliate links on this site — they're marked with an arrow, and every page carrying them says so at the top. They cost you nothing and they don't influence what makes the list. If something is bad I say it's bad, affiliate link or not.
- **Corrections stay visible.** When I get something wrong, the correction goes in the post itself, dated, not quietly edited into the text as though it was always right.
- **Numbers come with methodology.** A benchmark without the conditions it was run under is decoration. If I give you a number, I'll tell you how I got it.

## How this site is built

The whole thing is a folder of Markdown files in a public Git repository. There is no CMS, no database, and no admin panel — I write a `.md` file, push it, and a build turns it into the page you're reading. The supporter walls, video grid and project list pull themselves from the YouTube, Patreon, Buy Me a Coffee and GitHub APIs on a schedule, so nothing on this site is a number I typed in by hand and forgot to update.

If that sounds like something you'd want to steal, [I wrote up how it works](/blog/building-this-blog/) — including the parts that don't work, which turned out to be the interesting half.

## Where to go next

- [The blog index](/blog/) — everything, newest first
- [Reviews](/reviews/) — just the hardware, with scores
- [Projects](/projects/) — the code, pulled live from GitHub
- [Gear](/gear/) — what I actually use, one page
- [Support](/support/) — if any of this was worth your time

Thanks for reading. That genuinely still feels strange to type.
