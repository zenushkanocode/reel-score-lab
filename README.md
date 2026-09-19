# Reel Score Lab

**Viral Reel Formats** — screen-recordable concept demo for X.

powered by Jev · [@zenushkascut](https://x.com/zenushkascut)

> Concept demo UI · scores from TypeSafe Jev pilot · **not affiliated with TypeSafe**.  
> This is **not** an official TypeSafe product UI.

## What’s inside

Static GitHub Pages site in `docs/`:

- **Full bank wall: 501 Instagram reels** from `reel_bank.csv`
- **10 real Jev pilot scores** joined from `pilot_scores.csv` (only those URLs — **no invented scores**)
- **491 queued / scanning** cards for Roman-style batch density (dimmed; views + account only)
- Real Instagram thumbnails under `docs/thumbs/{shortcode}.jpg` (plus a few labeled placeholders if media 404’d)
- Scan-wave animation + KPI counters tick up as the batch “processes”
- Auto-cycles selection after scan completes (pauses on hover / click) for screen recording

## Enable GitHub Pages

1. Repo **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` → folder **`/docs`**
4. Save. Wait ~1–2 minutes.

**Expected URL:**  
`https://zenushkanocode.github.io/reel-score-lab/`

If OAuth blocks Actions workflows, use **branch + `/docs`** (no `.github/workflows` required).

## Screen-record for X

### macOS (built-in)

1. Open the Pages URL (or `docs/index.html` locally) at full window / 1280-wide
2. **Cmd + Shift + 5** → Record Selected Portion
3. Frame the white rounded board (16:9)
4. Let the scan wave run across the 501-cell wall, then auto-cycle 12–20s
5. Hover to pause on a strong reel, click a high-score thumb, then resume
6. Stop → trim → post

### Loom / OBS

- Loom Chrome extension or OBS browser source pointed at the Pages URL
- Crop to the white card; export 16:9 (1280×720 or 1920×1080)

### Caption template (X)

```
Viral Reel Formats.

I ran a 501-reel bank through a TypeSafe Jev-style batch scan.
10 reels scored (hook · story · CTA · visual · audio).
the rest stay queued — no fake numbers.

demo UI by me · scores from the Jev pilot
not affiliated with TypeSafe

Reel Score Lab → https://zenushkanocode.github.io/reel-score-lab/
```

Optional hashtags: `#buildinpublic` `#saas` `#reels`

## Local preview

```bash
cd docs && python3 -m http.server 8765
# open http://localhost:8765
```

## Data notes

- Scored rows: real Jev fields (`hook_score` … `audio_score`, `cta_type`, `framework_name`, `visual_style`, TypeSafe `share_link`)
- Unscored rows: labeled **SCAN** / queued — dimmed in the grid; **no invented Jev scores**
- Thumbnails: `thumb` → `thumbs/{shortcode}.jpg` (IG `/p/{code}/media/?size=l` when available)

## License

Demo / concept — use at your own risk. Pilot scores remain subject to TypeSafe’s terms.
