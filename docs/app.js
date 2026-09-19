(() => {
  const SCAN_STEP_MS = 28;      // how fast the batch-scan advances per cell
  const DETAIL_HOLD_MS = 2400;  // how long to linger on a highlighted reel
  const COLS = 28;
  const SCORE_KEYS = [
    { key: "hook_score", label: "Hook" },
    { key: "story_score", label: "Story" },
    { key: "cta_score", label: "CTA" },
    { key: "visual_score", label: "Visual" },
    { key: "audio_score", label: "Audio" },
  ];

  let data = [];
  let kpis = null;
  let selected = 0;
  let scanIdx = 0;
  let scanTimer = null;
  let detailTimer = null;
  let paused = false;
  let userLocked = false;
  let mode = "scanning"; // scanning | holding

  const $ = (id) => document.getElementById(id);

  function scoreToPct(s) {
    if (s == null || Number.isNaN(s)) return 0;
    return Math.round(Math.max(0, Math.min(5, s)) / 5 * 100);
  }

  function barTone(pct, index) {
    if (index === 1 || index === 3) return "orange";
    if (pct < 35) return "orange";
    return "black";
  }

  function gradientStyle(g) {
    return `linear-gradient(145deg, ${g[0]} 0%, ${g[1]} 100%)`;
  }

  function checkSvg() {
    return `<span class="check" aria-hidden="true"><svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  }

  function faceBackground(d) {
    if (d.thumb) {
      return `url('${d.thumb}'), ${gradientStyle(d.gradient)}`;
    }
    return gradientStyle(d.gradient);
  }

  async function load() {
    const [dataRes, kpiRes] = await Promise.all([
      fetch("data.json"),
      fetch("kpis.json").catch(() => null),
    ]);
    data = await dataRes.json();
    if (kpiRes && kpiRes.ok) {
      try { kpis = await kpiRes.json(); } catch (_) { kpis = null; }
    }
    $("lede-scored").textContent = data.filter((d) => d.scored).length;
    document.documentElement.style.setProperty("--cols", String(COLS));
    renderKpis();
    renderGrid();
    renderBest();
    // start on a strong reel for first paint
    const hot = interestingIndices();
    selected = hot[0] || 0;
    select(selected, true);
    startScan();
    wirePause();
  }

  function renderKpis() {
    const scored = data.filter((d) => d.scored);
    const n = scored.length || 1;
    const avgHook = kpis?.avg_hook ?? (scored.reduce((a, d) => a + d.hook_score, 0) / n);
    const avgCta = kpis?.avg_cta ?? (scored.reduce((a, d) => a + d.cta_score, 0) / n);
    const avgVisual = kpis?.avg_visual ?? (scored.reduce((a, d) => a + d.visual_score, 0) / n);
    const cm = kpis?.comment_magnets ?? scored.filter((d) => d.cta_type === "comment_magnet").length;
    const strong = kpis?.strong_hooks ?? scored.filter((d) => d.hook_score >= 2).length;
    const tiles = [
      { label: "Reels scored", value: String(scored.length), dark: true },
      { label: "Avg hook", value: Number(avgHook).toFixed(2) },
      { label: "Avg CTA", value: Number(avgCta).toFixed(2) },
      { label: "Avg visual", value: Number(avgVisual).toFixed(2) },
      { label: "Comment magnets", value: String(cm), dark: true },
      { label: "Strong hooks", value: String(strong), hint: "hook ≥ 2.0" },
    ];
    $("kpi-row").innerHTML = tiles
      .map(
        (t) => `<div class="kpi${t.dark ? " dark" : ""}">
        <div class="label">${t.label}</div>
        <div class="value">${t.value}</div>
        ${t.hint ? `<div class="hint">${t.hint}</div>` : ""}
      </div>`
      )
      .join("");
  }

  function renderGrid() {
    const grid = $("lead-grid");
    grid.innerHTML = data
      .map((d, i) => {
        const hot = d.overall_pct >= 30 || d.cta_type === "comment_magnet" || d.hook_score >= 2;
        const tag = hot ? `<span class="thumb-tag">HOT</span>` : `<span class="thumb-tag">JEV</span>`;
        const imgClass = d.thumb ? " has-img" : "";
        const scoreLabel = d.scored ? `${d.overall_pct}%` : "—";
        const faceStyle = d.thumb
          ? `background: center/cover url('${d.thumb}')`
          : `background: ${gradientStyle(d.gradient)}`;
        const faceInner = d.thumb
          ? `<span class="face-score face-score-img">${scoreLabel}</span>`
          : `<span class="face-initial">${d.initial}</span><span class="face-score">${scoreLabel}</span><span class="face-stripe"></span>`;
        return `<button type="button" class="thumb scored${hot ? " hot" : ""}${i === selected ? " selected" : ""}" data-i="${i}" data-cta="${d.cta_type || "none"}" aria-label="@${d.account} ${d.views_label}">
          <div class="thumb-face${imgClass}" style="${faceStyle}">${faceInner}</div>
          <span class="thumb-badge">${d.views_label}</span>
          ${tag}
        </button>`;
      })
      .join("");

    grid.querySelectorAll(".thumb").forEach((el) => {
      el.addEventListener("click", () => {
        userLocked = true;
        pause();
        stopScan();
        select(Number(el.dataset.i), true);
      });
    });
  }

  function interestingIndices() {
    return data
      .map((d, i) => ({ i, s: d.overall_pct, h: d.hook_score, cm: d.cta_type === "comment_magnet" ? 1 : 0 }))
      .filter((x) => x.s >= 20 || x.h >= 2 || x.cm)
      .sort((a, b) => b.s - a.s || b.h - a.h)
      .map((x) => x.i);
  }

  function renderBest() {
    const scored = data
      .filter((d) => d.scored)
      .slice()
      .sort((a, b) => b.overall_pct - a.overall_pct || b.hook_score - a.hook_score);
    const top = [];
    const seen = new Set();
    for (const d of scored) {
      if (seen.has(d.account)) continue;
      seen.add(d.account);
      top.push(d);
      if (top.length >= 7) break;
    }
    for (const d of scored) {
      if (top.length >= 7) break;
      if (top.includes(d)) continue;
      top.push(d);
    }
    $("best-row").innerHTML = top
      .map((d) => {
        const idx = data.indexOf(d);
        const bg = d.thumb
          ? `center/cover url('${d.thumb}')`
          : gradientStyle(d.gradient);
        return `<div class="best-item" data-i="${idx}">
          <div class="mini" style="background:${bg}">${d.thumb ? "" : d.initial}</div>
          <div class="score">${d.overall_pct}%</div>
          <div class="name">@${d.account}</div>
        </div>`;
      })
      .join("");
    $("best-row").querySelectorAll(".best-item").forEach((el) => {
      el.addEventListener("click", () => {
        userLocked = true;
        pause();
        stopScan();
        select(Number(el.dataset.i), true);
      });
    });
  }

  function select(i, animateBars) {
    selected = i;
    const d = data[i];
    document.querySelectorAll(".thumb").forEach((el) => {
      const idx = Number(el.dataset.i);
      el.classList.toggle("selected", idx === i);
    });
    document.querySelectorAll(".best-item").forEach((el) => {
      el.classList.toggle("active", Number(el.dataset.i) === i);
    });
    // ensure selected thumb is in view if grid ever scrolls
    const el = document.querySelector(`.thumb[data-i="${i}"]`);
    if (el) el.scrollIntoView({ block: "nearest", inline: "nearest" });
    renderDetail(d, animateBars);
  }

  function markScannedUpTo(n) {
    document.querySelectorAll(".thumb").forEach((el) => {
      const idx = Number(el.dataset.i);
      el.classList.toggle("scanned", idx <= n);
      el.classList.toggle("scanning", idx === n);
    });
  }

  function renderDetail(d, animateBars) {
    const avBg = d.thumb
      ? `center/cover url('${d.thumb}')`
      : gradientStyle(d.gradient);

    $("detail-profile").innerHTML = `
      <div class="avatar-lg" style="background:${avBg}">
        ${d.thumb ? "" : d.initial}${checkSvg()}
      </div>
      <div class="profile-meta">
        <h2>@${d.account}</h2>
        <div class="sub">${d.caption_line ? escapeHtml(d.caption_line.slice(0, 64)) : "Instagram reel"}</div>
        <div class="stats">
          <span>${d.views_label} views</span>
          <span>${d.likes || "—"} likes</span>
          <span>${d.comments || "—"} comments</span>
        </div>
        <div class="status-pill"><span class="dot"></span> Jev scored · ${d.overall_pct}%</div>
      </div>`;

    $("score-block").innerHTML = SCORE_KEYS.map((sk, idx) => {
      const pct = scoreToPct(d[sk.key]);
      const tone = barTone(pct, idx);
      return `<div class="score-row">
        <div class="name">${sk.label}</div>
        <div class="bar-track"><div class="bar-fill ${tone}" data-pct="${pct}" style="width:0%"></div></div>
        <div class="pct">${pct}</div>
      </div>`;
    }).join("");

    const chips = [];
    if (d.cta_type) chips.push(`<span class="chip"><strong>cta</strong>${escapeHtml(d.cta_type)}</span>`);
    if (d.framework_name) chips.push(`<span class="chip"><strong>framework</strong>${escapeHtml(d.framework_name)}</span>`);
    if (d.visual_style) chips.push(`<span class="chip"><strong>visual</strong>${escapeHtml(d.visual_style)}</span>`);
    chips.push(`<span class="chip accent">overall · ${d.overall_pct}%</span>`);
    $("chip-row").innerHTML = chips.join("");

    let links = `<a href="${d.reel_url}" target="_blank" rel="noopener">Open reel ↗</a>`;
    if (d.share_link) {
      links += `<a href="${d.share_link}" target="_blank" rel="noopener">TypeSafe share ↗</a>`;
    }
    $("caption-block").innerHTML = `
      <div class="cap-label">Caption</div>
      <p>${escapeHtml(d.caption || "—")}</p>
      <div class="detail-links">${links}</div>`;

    if (animateBars) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.querySelectorAll(".bar-fill").forEach((el) => {
            el.style.width = el.dataset.pct + "%";
          });
        });
      });
    } else {
      document.querySelectorAll(".bar-fill").forEach((el) => {
        el.style.width = el.dataset.pct + "%";
      });
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function startScan() {
    stopScan();
    mode = "scanning";
    const rail = $("scan-rail");
    if (rail) rail.classList.add("on");
    scanIdx = Math.max(0, scanIdx);
    scanTimer = setInterval(() => {
      if (paused || userLocked) return;
      if (mode !== "scanning") return;
      markScannedUpTo(scanIdx);
      // every COLS cells (end of a row-ish), peek a detail if interesting
      if (scanIdx % COLS === Math.floor(COLS / 2)) {
        const d = data[scanIdx];
        if (d && (d.overall_pct >= 25 || d.hook_score >= 2 || d.cta_type === "comment_magnet")) {
          select(scanIdx, true);
        }
      }
      scanIdx += 1;
      if (scanIdx >= data.length) {
        // finished a full pass — hold on top formats, then rescan
        scanIdx = 0;
        holdOnInteresting();
      }
    }, SCAN_STEP_MS);
  }

  function holdOnInteresting() {
    mode = "holding";
    const rail = $("scan-rail");
    if (rail) rail.classList.remove("on");
    document.querySelectorAll(".thumb").forEach((el) => {
      el.classList.add("scanned");
      el.classList.remove("scanning");
    });
    const hot = interestingIndices();
    let hi = 0;
    const showNext = () => {
      if (paused || userLocked) return;
      if (!hot.length) {
        mode = "scanning";
        if (rail) rail.classList.add("on");
        return;
      }
      select(hot[hi % hot.length], true);
      hi += 1;
      if (hi >= Math.min(hot.length, 6)) {
        // back to scanning
        clearTimeout(detailTimer);
        detailTimer = setTimeout(() => {
          mode = "scanning";
          if (rail) rail.classList.add("on");
        }, DETAIL_HOLD_MS);
        return;
      }
      clearTimeout(detailTimer);
      detailTimer = setTimeout(showNext, DETAIL_HOLD_MS);
    };
    showNext();
  }

  function stopScan() {
    if (scanTimer) clearInterval(scanTimer);
    scanTimer = null;
    if (detailTimer) clearTimeout(detailTimer);
    detailTimer = null;
    const rail = $("scan-rail");
    if (rail) rail.classList.remove("on");
  }

  function pause() {
    paused = true;
  }
  function resume() {
    if (!userLocked) paused = false;
  }

  function wirePause() {
    const board = $("board");
    board.addEventListener("mouseenter", pause);
    board.addEventListener("mouseleave", () => {
      if (userLocked) {
        setTimeout(() => {
          userLocked = false;
          paused = false;
          if (!scanTimer) startScan();
        }, 1400);
      } else {
        resume();
        if (!scanTimer) startScan();
      }
    });
    document.addEventListener("keydown", (e) => {
      const hot = interestingIndices();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        userLocked = true;
        pause();
        stopScan();
        const pos = hot.indexOf(selected);
        const next = hot[(pos + 1) % hot.length] ?? ((selected + 1) % data.length);
        select(next, true);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        userLocked = true;
        pause();
        stopScan();
        const pos = hot.indexOf(selected);
        const prev = hot[(pos - 1 + hot.length) % hot.length] ?? ((selected - 1 + data.length) % data.length);
        select(prev, true);
      }
    });
  }

  load().catch((err) => {
    console.error(err);
    $("kpi-row").innerHTML = `<div class="kpi dark"><div class="label">Error</div><div class="value">load</div></div>`;
  });
})();
