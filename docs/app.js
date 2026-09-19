(() => {
  const CYCLE_MS = 2800;
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
  let paused = false;
  let userLocked = false;

  const $ = (id) => document.getElementById(id);

  function scoreToPct(s) {
    if (s == null || Number.isNaN(s)) return 0;
    return Math.round(Math.max(0, Math.min(5, s)) / 5 * 100);
  }

  function barTone(pct, index) {
    // Roman pattern: black primary bars, orange accents on Story + Visual (or low scores)
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

  async function load() {
    const res = await fetch("data.json");
    data = await res.json();
    $("lede-scored").textContent = data.filter((d) => d.scored).length;
    $("lede-queued").textContent = data.filter((d) => !d.scored).length;
    renderKpis();
    renderGrid();
    renderBest();
    select(0, true);
    startCycle();
    wirePause();
  }

  function renderKpis() {
    const scored = data.filter((d) => d.scored);
    const avgHook = scored.reduce((a, d) => a + d.hook_score, 0) / scored.length;
    const avgCta = scored.reduce((a, d) => a + d.cta_score, 0) / scored.length;
    const cm = scored.filter((d) => d.cta_type === "comment_magnet").length;
    const cmPct = Math.round((cm / scored.length) * 100);
    const tiles = [
      { label: "Reels scored", value: String(scored.length), dark: true },
      { label: "In bank", value: String(data.length), dark: true },
      { label: "Avg hook", value: avgHook.toFixed(2) },
      { label: "Avg CTA", value: avgCta.toFixed(2) },
      { label: "Comment-magnet", value: cmPct + "%" },
      { label: "Cost / batch", value: "~$0.09", hint: "demo estimate" },
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
        const tag = d.scored
          ? `<span class="thumb-tag">JEV</span>`
          : `<span class="thumb-tag">DEMO</span>`;
        return `<button type="button" class="thumb ${d.scored ? "scored" : "queued"}${i === selected ? " selected" : ""}" data-i="${i}" aria-label="@${d.account} ${d.views_label}">
          <div class="thumb-face" style="background:${gradientStyle(d.gradient)}">${d.initial}</div>
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
    // Prefer unique accounts for the strip (Roman shows distinct faces)
    const scored = data
      .filter((d) => d.scored)
      .slice()
      .sort((a, b) => b.overall_pct - a.overall_pct);
    const top = [];
    const seen = new Set();
    for (const d of scored) {
      if (seen.has(d.account)) continue;
      seen.add(d.account);
      top.push(d);
      if (top.length >= 6) break;
    }
    // fill remaining slots if <6 unique accounts
    for (const d of scored) {
      if (top.length >= 6) break;
      if (top.includes(d)) continue;
      top.push(d);
    }
    $("best-row").innerHTML = top
      .map((d) => {
        const idx = data.indexOf(d);
        return `<div class="best-item" data-i="${idx}">
          <div class="mini" style="background:${gradientStyle(d.gradient)}">${d.initial}</div>
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
    document.querySelectorAll(".thumb").forEach((el) => {
      el.classList.toggle("selected", Number(el.dataset.i) === i);
    });
    document.querySelectorAll(".best-item").forEach((el) => {
      el.classList.toggle("active", Number(el.dataset.i) === i);
    });
    renderDetail(d, animateBars);
  }

  function renderDetail(d, animateBars) {
    const scoredBadge = d.scored
      ? `<div class="status-pill"><span class="dot"></span> Jev scored</div>`
      : `<div class="status-pill queued"><span class="dot"></span> Queued · DEMO</div>`;

    $("detail-profile").innerHTML = `
      <div class="avatar-lg" style="background:${gradientStyle(d.gradient)}">
        ${d.initial}${d.scored ? checkSvg() : ""}
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
      $("score-block").innerHTML = `<div class="queued-note">Not yet scored by Jev.<br/>Placeholder card for demo density — no invented scores.</div>`;
      $("chip-row").innerHTML = `<span class="chip accent">status · queued</span><span class="chip">label · DEMO</span>`;
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

  function nextScoredOrAny() {
    // Prefer cycling scored items for a livelier score-bar demo; occasionally show queued
    const scoredIdx = data.map((d, i) => (d.scored ? i : -1)).filter((i) => i >= 0);
    const tick = (window.__cycleTick = (window.__cycleTick || 0) + 1);
    if (tick % 5 === 0) {
      // every 5th: show a queued card
      const queuedIdx = data.map((d, i) => (!d.scored ? i : -1)).filter((i) => i >= 0);
      if (queuedIdx.length) return queuedIdx[tick % queuedIdx.length];
    }
    const pos = scoredIdx.indexOf(selected);
    return scoredIdx[(pos + 1) % scoredIdx.length];
  }

  function startCycle() {
    stopCycle();
    timer = setInterval(() => {
      if (paused || userLocked) return;
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
      // resume auto-cycle after leave unless user clicked
      if (userLocked) {
        // unlock after leave so recording can continue cycling
        setTimeout(() => {
          userLocked = false;
          paused = false;
        }, 1200);
      } else {
        resume();
      }
    });
    // keyboard
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
        const scoredIdx = data.map((d, i) => (d.scored ? i : -1)).filter((i) => i >= 0);
        const pos = scoredIdx.indexOf(selected);
        select(scoredIdx[(pos - 1 + scoredIdx.length) % scoredIdx.length], true);
      }
    });
  }

  load().catch((err) => {
    console.error(err);
    $("kpi-row").innerHTML = `<div class="kpi dark"><div class="label">Error</div><div class="value">load</div></div>`;
  });
})();
