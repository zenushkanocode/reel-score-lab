# Viral Reel Formats · Reel Score Lab

**Viral Reel Formats** — screen-recordable concept demo for X.

powered by Jev · [@zenushkascut](https://x.com/zenushkascut)

> Concept demo UI · scores from TypeSafe Jev full batch (501/501) · **not affiliated with TypeSafe**.  
> This is **not** an official TypeSafe product UI.

## What’s inside

Static GitHub Pages site in `docs/`:

- **501 real Jev scores** joined from `data/full_scores.csv` ↔ reel bank
- Dense mosaic of all 501 cards with a **batch-scoring scan** animation
- KPI tiles from live aggregates (avg hook / CTA / visual, comment magnets, strong hooks)
- Thumbnails from `docs/thumbs/` when available; otherwise styled gradient cards (initial + score + CTA stripe)
- Roman / Gojiberry-inspired layout: white 16:9 board, black/orange score bars, “top viral formats” strip

## Enable GitHub Pages

1. Repo **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` (or `feat/full-501-viral-formats` until merged) → folder **`/docs`**
4. Save. Wait ~1–2 minutes.

**Expected URL:**  
`https://zenushkanocode.github.io/reel-score-lab/`

If OAuth blocks Actions workflows, use **branch + `/docs`** (no `.github/workflows` required).

## Screen-record for X

### macOS (built-in)

1. Open the Pages URL (or `docs/index.html` locally) at full window / 1280-wide
2. **Cmd + Shift + 5** → Record Selected Portion
3. Frame the white rounded board (16:9)
4. Let the scan sweep the 501 grid, then linger on top formats (bars animate)
5. Hover to pause, click a HOT thumb, then resume
6. Stop → trim → post

### Caption template (X)

```
viral reel formats.

I ran 501 Instagram reels through TypeSafe Jev.
hook · story · CTA · visual · audio — scored 0–5.

demo UI by me · full-batch scores
not affiliated with TypeSafe

Viral Reel Formats → https://zenushkanocode.github.io/reel-score-lab/
```

Optional hashtags: `#buildinpublic` `#saas` `#reels`

## Local preview

```bash
cd docs && python3 -m http.server 8765
# open http://localhost:8765
```

## Data notes

- `docs/data.json` — all 501 rows with real Jev fields (`hook_score` … `audio_score`, `cta_type`, `framework_name`, `visual_style`)
- `docs/kpis.json` — aggregates used by the KPI tiles
- `data/full_scores.csv` — transparent copy of the full batch CSV
- Thumbnails: 24 local `docs/thumbs/{shortcode}.png`; remaining cards use styled gradients (not blank)

## License

Demo / concept — use at your own risk. Scores remain subject to TypeSafe’s terms.
