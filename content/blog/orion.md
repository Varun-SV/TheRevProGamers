---
title: "Orion: making a decade of messy media folders legible to Jellyfin"
date: 2026-08-09
description: "Jellyfin is only as good as your folder names. Orion is a PyQt6 desktop app that scans, renames and moves an entire collection — video, music and books — with API metadata lookups."
tags: [projects, python, jellyfin, media, desktop]
type: project
repo: https://github.com/Varun-SV/Orion
author: Varun SV
---

Jellyfin is excellent software with one unforgiving requirement: it identifies your media by **filename and folder structure**. Get those right and it fetches artwork, cast, episode summaries and season art automatically. Get them wrong and you have a library full of `[YIFY]_Some.Movie.2010.1080p.BRRip.x264-GROUP.mkv` sitting in an "Unknown" pile.

Ten years of downloads meant thousands of files in a dozen naming conventions, half of them from tools that no longer exist. Renaming by hand was not happening.

Orion is the desktop app that fixed it.

## What it produces

The whole job is turning arbitrary mess into the exact shape Jellyfin expects:

```text
Movies/
  Inception (2010)/
    Inception (2010) [1080p] [BluRay].mkv

TV Shows/
  Breaking Bad (2008)/
    Season 01/
      Breaking Bad (2008) - S01E01 - Pilot.mkv

Anime/
  Attack on Titan (2013)/
    Season 01/
      Attack on Titan (2013) - S01E01 - To You, in 2000 Years.mkv

Web Series/
  The Boys (2019)/
    Season 01/
      The Boys (2019) - S01E01 - The Name of the Game.mkv

Music/
  Queen/
    A Night at the Opera (1975)/
      11 - Bohemian Rhapsody.flac
```

Note that **Anime, Anime Films and Web Series are separate categories** from Movies and TV Shows. That's deliberate. Lumping anime in with live-action TV produces a browsing experience where nothing is findable, and Jellyfin handles them better as distinct libraries with their own metadata providers.

## Why a desktop app and not a script

I wrote the script first. The script was wrong, and here is why: **a bulk rename is destructive and irreversible, and a script gives you no chance to disagree with it before it happens.**

Metadata matching is fuzzy. Two films share a title. A series has an alternate romanisation. An episode is numbered differently by two databases. The automated guess is right most of the time, and "most of the time" across four thousand files means a lot of wrongly-filed media and no undo.

So Orion is PyQt6 with a panel per category — Dashboard, Movies, Series, Anime, Anime Films, Web Series, Music, Books — where you review what it intends to do before it does it. A setup wizard handles first-run category detection, there's an activity log for everything it touched, and API keys live in Settings.

The app is the feature. Seeing the proposed rename next to the original filename is what makes bulk operations on an irreplaceable library survivable.

## Beyond video

Music and books go through the same pipeline. Music gets `Artist/Album (Year)/NN - Track` with metadata lookups filling in what the tags don't. Books get organised for the ebook side of a Jellyfin setup — the part most media organisers ignore entirely because video is the glamorous problem.

## Running it

Python 3.11+, PyQt6:

```bash
git clone https://github.com/Varun-SV/Orion
cd Orion
pip install -r requirements.txt
python main.py
```

There's a `build.spec` for packaging it into a standalone binary if you'd rather not keep a Python environment around for a tool you use twice a year.

You'll want API keys for the metadata providers — the wizard walks through which ones and where they go.

## Status

Beta, and honest about it. It has reorganised my library completely and I trust it, but "works on my collection" is a sample size of one and your naming chaos is probably differently shaped from mine.

The advice I'd give anyone pointing a bulk renamer at irreplaceable files, mine included: **run it on a copy of one category first.** Check what it produced. Then let it loose on the rest.

MIT licensed, [on GitHub](https://github.com/Varun-SV/Orion), screenshots of every panel in the README.
