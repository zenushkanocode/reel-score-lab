# Reel Score Lab

**pick the best reel** — screen-recordable concept demo for X.

powered by Jev · [@zenushkascut](https://x.com/zenushkascut)

> Concept demo UI · scores from TypeSafe Jev pilot · **not affiliated with TypeSafe**.  
> This is **not** an official TypeSafe product UI.

## What’s inside

Static GitHub Pages site in `docs/`:

- **10 real Jev pilot scores** joined from `pilot_scores.csv` ↔ `reel_bank.csv`
- **54 queued / DEMO** cards for grid density (dimmed, **no invented scores**)
- Roman / Gojiberry-inspired layout: white 16:9 board, KPI tiles, dense thumb grid, black/orange score bars, bottom “best reels” strip
- Auto-cycles selection every ~2.8s (pauses on hover / click) for screen recording

## Enable GitHub Pages

1. Repo **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` (or `feat/demo-v1` until merged) → folder **`/docs`**
4. Save. Wait ~1–2 minutes.

**Expected URL:**  
`https://zenushkanocode.github.io/reel-score-lab/`

If OAuth blocks Actions workflows, use **branch + `/docs`** (no `.github/workflows` required).

## Screen-record for X

### macOS (built-in)

1. Open the Pages URL (or `docs/index.html` locally) at full window / 1280-wide
2. **Cmd + Shift + 5** → Record Selected Portion
3. Frame the white rounded board (16:9)
4. Let auto-cycle run 12–20s (bars animate; selection moves)
5. Hover to pause on a strong reel, click a high-score thumb, then resume
6. Stop → trim → post

### Loom / OBS

- Loom Chrome extension or OBS browser source pointed at the Pages URL
- Crop to the white card; export 16:9 (1280×720 or 1920×1080)

### Caption template (X)

```
pick the best reel.

I ran 10 Instagram reels through TypeSafe Jev (pilot).
hook · story · CTA · visual · audio — scored 0–5.

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
- Unscored rows: labeled **DEMO** / queued — dimmed in the grid
- Thumbnails: gradient + account initial + views badge (Instagram CDN is flaky)

## License

Demo / concept — use at your own risk. Pilot scores remain subject to TypeSafe’s terms.
