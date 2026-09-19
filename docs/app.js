(() => {
  const CYCLE_MS = 900;
  const SCAN_WAVE_MS = 45;
  const SCORE_KEYS = [
    { key: "hook_score", label: "Hook" },
    { key: "story_score", label: "Story" },
    { key: "cta_score", label: "CTA" },
    { key: "visual_score", label: "Visual" },
    { key: "audio_score", label: "Audio" },
  ];

  let data = [];
  let selected = 0;
  let timer = null;
  let scanTimer = null;
  let paused = false;
  let userLocked = false;
  let scanIndex = 0;
  let scannedCount = 0;
  let scanning = true;
  let kpiTargets = {};
  let recentPickAccounts = []; // last few accounts shown (cycle/scan diversity)
  const BEST_STRIP_COUNT = 10;
  const MAX_PER_ACCOUNT_BEST = 1;
  const SKIP_SAME_ACCOUNT_WINDOW = 2;

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

  function faceHtml(d, className) {
    const cls = className || "thumb-face";
    if (d.thumb) {
      return `<div class="${cls} has-img" style="background:${gradientStyle(d.gradient)}">
        <img src="${d.thumb}" alt="@${d.account}" loading="lazy" decoding="async" />
      </div>`;
    }
    return `<div class="${cls}" style="background:${gradientStyle(d.gradient)}">${d.initial}</div>`;
  }

  async function load() {
    const res = await fetch("data.json");
    data = await res.json();
    $("lede-total").textContent = data.length;
    $("lede-scored").textContent = data.filter((d) => d.scored).length;
    $("lede-scanned").textContent = "0";
    renderKpis(true);
    renderGrid();
    renderBest();
    select(0, true);
    startScan();
    wirePause();
  }

  function renderKpis(initZero) {
    const scored = data.filter((d) => d.scored);
    const avgHook = scored.length
      ? scored.reduce((a, d) => a + d.hook_score, 0) / scored.length
      : 0;
    const avgCta = scored.length
      ? scored.reduce((a, d) => a + d.cta_score, 0) / scored.length
      : 0;
    const cm = scored.filter((d) => d.cta_type === "comment_magnet").length;
    const cmPct = scored.length ? Math.round((cm / scored.length) * 100) : 0;

    kpiTargets = {
      bank: data.length,
      scored: scored.length,
      scanned: data.length,
      avgHook: Number(avgHook.toFixed(2)),
      avgCta: Number(avgCta.toFixed(2)),
      cmPct,
    };

    const tiles = [
      { id: "kpi-bank", label: "In bank", value: initZero ? 0 : data.length, dark: true },
      { id: "kpi-scanned", label: "Scanned", value: initZero ? 0 : data.length, dark: true },
      { id: "kpi-scored", label: "Jev scored", value: initZero ? 0 : scored.length },
      { id: "kpi-hook", label: "Avg hook", value: initZero ? "0.00" : avgHook.toFixed(2) },
      { id: "kpi-cta", label: "Avg CTA", value: initZero ? "0.00" : avgCta.toFixed(2) },
      { id: "kpi-cm", label: "Comment-magnet", value: (initZero ? 0 : cmPct) + "%" },
    ];
    $("kpi-row").innerHTML = tiles
      .map(
        (t) => `<div class="kpi${t.dark ? " dark" : ""}" id="${t.id}">
        <div class="label">${t.label}</div>
        <div class="value" data-kpi="${t.id}">${t.value}</div>
      </div>`
      )
      .join("");
  }

  function tickKpis(progress) {
    // progress 0..1 during scan
    const p = Math.min(1, Math.max(0, progress));
    const bank = Math.round(kpiTargets.bank * Math.min(1, p * 1.05));
    const scanned = Math.round(kpiTargets.scanned * p);
    const scoredReveal = p > 0.55 ? kpiTargets.scored : Math.min(kpiTargets.scored, Math.floor(p * 12));
    const hook = (kpiTargets.avgHook * Math.min(1, p * 1.2)).toFixed(2);
    const cta = (kpiTargets.avgCta * Math.min(1, p * 1.2)).toFixed(2);
    const cm = Math.round(kpiTargets.cmPct * Math.min(1, p * 1.1));
    const set = (id, v) => {
      const el = document.querySelector(`#${id} .value`);
      if (el) el.textContent = v;
    };
    set("kpi-bank", bank);
    set("kpi-scanned", scanned);
    set("kpi-scored", scoredReveal);
    set("kpi-hook", hook);
    set("kpi-cta", cta);
    set("kpi-cm", cm + "%");
    $("lede-scanned").textContent = scanned;
  }

  function renderGrid() {
    const grid = $("lead-grid");
    grid.innerHTML = data
      .map((d, i) => {
        const tag = d.scored
          ? `<span class="thumb-tag">JEV</span>`
          : `<span class="thumb-tag">SCAN</span>`;
        return `<button type="button" class="thumb ${d.scored ? "scored" : "queued"}${i === selected ? " selected" : ""}" data-i="${i}" aria-label="@${d.account} ${d.views_label}">
          ${faceHtml(d)}
          <span class="thumb-badge">${d.views_label}</span>
          ${tag}
        </button>`;
      })
      .join("");

    grid.querySelectorAll(".thumb").forEach((el) => {
      el.addEventListener("click", () => {
        userLocked = true;
        pause();
        select(Number(el.dataset.i), true);
      });
    });
  }

  function renderBest() {
    // Top by hook_score, max 1 per account — ~8–12 diverse creators
    const scored = data
      .filter((d) => d.scored && d.hook_score != null)
      .slice()
      .sort((a, b) => (b.hook_score || 0) - (a.hook_score || 0));
    const top = [];
    const perAccount = new Map();
    for (const d of scored) {
      const n = perAccount.get(d.account) || 0;
      if (n >= MAX_PER_ACCOUNT_BEST) continue;
      perAccount.set(d.account, n + 1);
      top.push(d);
      if (top.length >= BEST_STRIP_COUNT) break;
    }
    // If still short, allow a 2nd reel per account (still hook-ranked)
    if (top.length < BEST_STRIP_COUNT) {
      for (const d of scored) {
        if (top.includes(d)) continue;
        const n = perAccount.get(d.account) || 0;
        if (n >= 2) continue;
        perAccount.set(d.account, n + 1);
        top.push(d);
        if (top.length >= BEST_STRIP_COUNT) break;
      }
    }
    $("best-row").innerHTML = top
      .map((d) => {
        const idx = data.indexOf(d);
        return `<div class="best-item" data-i="${idx}">
          ${faceHtml(d, "mini")}
          <div class="score">${d.overall_pct}%</div>
          <div class="name">@${d.account}</div>
        </div>`;
      })
      .join("");
    $("best-row").querySelectorAll(".best-item").forEach((el) => {
      el.addEventListener("click", () => {
        userLocked = true;
        pause();
        select(Number(el.dataset.i), true);
      });
    });
  }

  function select(i, animateBars) {
    selected = i;
    const d = data[i];
    if (d && d.account) {
      recentPickAccounts.push(d.account);
      if (recentPickAccounts.length > SKIP_SAME_ACCOUNT_WINDOW + 1) {
        recentPickAccounts.shift();
      }
    }
    document.querySelectorAll(".thumb").forEach((el) => {
      el.classList.toggle("selected", Number(el.dataset.i) === i);
    });
    document.querySelectorAll(".best-item").forEach((el) => {
      el.classList.toggle("active", Number(el.dataset.i) === i);
    });
    // keep selected in view during scan
    const thumb = document.querySelector(`.thumb[data-i="${i}"]`);
    if (thumb && scanning) {
      thumb.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
    renderDetail(d, animateBars);
  }

  function renderDetail(d, animateBars) {
    const scoredBadge = d.scored
      ? `<div class="status-pill"><span class="dot"></span> Jev scored</div>`
      : `<div class="status-pill queued"><span class="dot"></span> Queued · scanning</div>`;

    const avatarInner = d.thumb
      ? `<img src="${d.thumb}" alt="" /><span class="avatar-fallback" style="background:${gradientStyle(d.gradient)}">${d.initial}</span>`
      : d.initial;

    $("detail-profile").innerHTML = `
      <div class="avatar-lg ${d.thumb ? "has-img" : ""}" style="background:${gradientStyle(d.gradient)}">
        ${avatarInner}${d.scored ? checkSvg() : ""}
      </div>
      <div class="profile-meta">
        <h2>@${d.account}</h2>
        <div class="sub">${d.caption_line ? escapeHtml(d.caption_line.slice(0, 64)) : "Instagram reel"}</div>
        <div class="stats">
          <span>${d.views_label} views</span>
          <span>${d.likes || "—"} likes</span>
          <span>${d.comments || "—"} comments</span>
        </div>
        ${scoredBadge}
      </div>`;

    if (!d.scored) {
      $("score-block").innerHTML = `<div class="queued-note">In the bank — not yet scored by Jev.<br/>Views &amp; account only. No invented scores.</div>`;
      $("chip-row").innerHTML = `<span class="chip accent">status · queued</span><span class="chip">batch · scanning</span>`;
      $("caption-block").innerHTML = `
        <div class="cap-label">Caption</div>
        <p>${escapeHtml(d.caption || "—")}</p>
        <div class="detail-links"><a href="${d.reel_url}" target="_blank" rel="noopener">Open reel ↗</a></div>`;
      return;
    }

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

  function markScanned(i) {
    const el = document.querySelector(`.thumb[data-i="${i}"]`);
    if (!el) return;
    el.classList.add("scanned", "scan-flash");
    setTimeout(() => el.classList.remove("scan-flash"), 180);
  }

  function startScan() {
    scanning = true;
    scanIndex = 0;
    scannedCount = 0;
    document.body.classList.add("is-scanning");
    $("scan-status").textContent = "scanning…";
    const beam = $("scan-beam");
    if (beam) beam.classList.add("active");

    // Rapid wave across grid — feels like scoring 500 in parallel
    const step = () => {
      if (paused && userLocked) {
        scanTimer = setTimeout(step, SCAN_WAVE_MS);
        return;
      }
      if (scanIndex >= data.length) {
        finishScan();
        return;
      }
      // flash a burst of cells each tick for parallel vibe
      const burst = 7;
      for (let b = 0; b < burst && scanIndex < data.length; b++) {
        markScanned(scanIndex);
        scanIndex++;
        scannedCount++;
      }
      tickKpis(scannedCount / data.length);
      // occasionally focus a cell — prefer a different account than last 2 picks
      if (scannedCount % 28 === 0 || (data[scanIndex - 1] && data[scanIndex - 1].scored)) {
        let focus = Math.max(0, scanIndex - 1);
        const banned = bannedAccounts();
        const start = Math.max(0, scanIndex - 7);
        for (let j = scanIndex - 1; j >= start; j--) {
          if (data[j] && data[j].scored && !banned.has(data[j].account)) {
            focus = j;
            break;
          }
        }
        if (!userLocked) select(focus, true);
      }
      // move beam
      if (beam) {
        const cols = getComputedStyle($("lead-grid")).gridTemplateColumns.split(" ").length || 22;
        const row = Math.floor((scanIndex - 1) / cols);
        const totalRows = Math.ceil(data.length / cols);
        beam.style.transform = `translateY(${(row / Math.max(1, totalRows - 1)) * 100}%)`;
      }
      scanTimer = setTimeout(step, SCAN_WAVE_MS);
    };
    step();
  }

  function finishScan() {
    scanning = false;
    document.body.classList.remove("is-scanning");
    document.body.classList.add("scan-done");
    $("scan-status").textContent = "batch complete";
    tickKpis(1);
    const beam = $("scan-beam");
    if (beam) {
      beam.classList.remove("active");
      beam.classList.add("done");
    }
    // dim queued remain dim; scored stay bright
    document.querySelectorAll(".thumb.queued").forEach((el) => el.classList.add("scanned"));
    startCycle();
  }

  function bannedAccounts() {
    // Skip if same account as previous 2 picks (plus current)
    const banned = new Set(recentPickAccounts.slice(-SKIP_SAME_ACCOUNT_WINDOW));
    if (data[selected]) banned.add(data[selected].account);
    return banned;
  }

  function nextDiverseIndex(indices, fromPos, direction) {
    if (!indices.length) return selected;
    const banned = bannedAccounts();
    const n = indices.length;
    // Prefer next account different from recent picks (data is round-robin interleaved)
    for (let step = 1; step <= n; step++) {
      const idx = indices[(fromPos + direction * step + n * 10) % n];
      if (!banned.has(data[idx].account)) return idx;
    }
    // Fallback: any different account than current
    const cur = data[selected] && data[selected].account;
    for (let step = 1; step <= n; step++) {
      const idx = indices[(fromPos + direction * step + n * 10) % n];
      if (data[idx].account !== cur) return idx;
    }
    return indices[(fromPos + direction + n) % n];
  }

  function nextScoredOrAny() {
    const scoredIdx = data.map((d, i) => (d.scored ? i : -1)).filter((i) => i >= 0);
    const tick = (window.__cycleTick = (window.__cycleTick || 0) + 1);
    if (tick % 4 === 0) {
      // show a high-view queued card for density (also diversify)
      const queuedIdx = data.map((d, i) => (!d.scored ? i : -1)).filter((i) => i >= 0);
      if (queuedIdx.length) {
        const qpos = queuedIdx.indexOf(selected);
        const from = qpos >= 0 ? qpos : tick % queuedIdx.length;
        return nextDiverseIndex(queuedIdx, from, 1);
      }
    }
    const pos = scoredIdx.indexOf(selected);
    const from = pos >= 0 ? pos : 0;
    return nextDiverseIndex(scoredIdx, from, 1);
  }

  function prevScoredDiverse() {
    const scoredIdx = data.map((d, i) => (d.scored ? i : -1)).filter((i) => i >= 0);
    const pos = scoredIdx.indexOf(selected);
    const from = pos >= 0 ? pos : 0;
    return nextDiverseIndex(scoredIdx, from, -1);
  }

  function startCycle() {
    stopCycle();
    timer = setInterval(() => {
      if (paused || userLocked || scanning) return;
      select(nextScoredOrAny(), true);
    }, CYCLE_MS);
  }

  function stopCycle() {
    if (timer) clearInterval(timer);
    timer = null;
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
        }, 1200);
      } else {
        resume();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        userLocked = true;
        pause();
        select(nextScoredOrAny(), true);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        userLocked = true;
        pause();
        select(prevScoredDiverse(), true);
      }
    });
  }

  load().catch((err) => {
    console.error(err);
    $("kpi-row").innerHTML = `<div class="kpi dark"><div class="label">Error</div><div class="value">load</div></div>`;
  });
})();
