// Lullo sitter page. Loaded from care.html. No inline scripts, so the page's security policy can block them.
"use strict";

// Don't run inside someone else's page (stops tap tricks through an invisible frame).
if (window.top !== window.self) {
  document.documentElement.className = "framed";
  try { window.top.location = window.self.location; } catch (e) { /* blocked: stay hidden */ }
  throw new Error("framed");
}

const URL_BASE = "https://ljsynbarpwvzniuejeyr.supabase.co/rest/v1/rpc/";
const KEY = "sb_publishable_leGqlH0m-8ANk6MrG_M2oA_XLi7f0VS";

// The link's code lives after the # so it never reaches a web server's logs.
// Older links used ?t=, which still work and get tidied into the # form.
function readToken() {
  const hash = new URLSearchParams(location.hash.slice(1)).get("t");
  if (hash) return hash;
  const query = new URLSearchParams(location.search).get("t");
  if (query) {
    try { history.replaceState(null, "", location.pathname + "#t=" + encodeURIComponent(query)); } catch (e) {}
    return query;
  }
  return "";
}
const rawToken = readToken();
const token = /^[0-9a-f]{20,64}$/i.test(rawToken) ? rawToken : "";
let state = null;
let busy = false;

async function rpc(name, body) {
  const r = await fetch(URL_BASE + name, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    referrerPolicy: "no-referrer",
    cache: "no-store",
  });
  if (!r.ok) throw new Error("server " + r.status);
  return r.json();
}

const t = d => new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const ago = d => {
  const m = Math.max(0, Math.round((Date.now() - new Date(d)) / 60000));
  return m < 60 ? m + "m" : Math.floor(m / 60) + "h " + String(m % 60).padStart(2, "0") + "m";
};
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; };

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2400);
}
function who() { try { return (localStorage.getItem("lullo-name") || "").slice(0, 40); } catch (e) { return ""; } }
function setWho(v) { try { localStorage.setItem("lullo-name", String(v).slice(0, 40)); } catch (e) {} }

function message(text) {
  document.getElementById("app").innerHTML = "<h1>Lullo</h1><p class='muted'>" + esc(text) + "</p>";
}

async function load() {
  if (!token) { message("This link is missing its code. Ask for a new one."); return; }
  // Don't redraw while someone is typing their name or a bottle amount.
  const active = document.activeElement;
  if (state && active && active.tagName === "INPUT") return;
  const box = document.getElementById("mlbox");
  if (state && box && box.style.display === "flex") return;
  try {
    state = await rpc("care_view", { t: token });
    render();
  } catch (e) {
    if (!state) message("Can't reach Lullo right now. Check the internet connection and try again.");
    else toast("Can't refresh right now");
  }
}

function label(e) {
  const d = e.data || {};
  if (e.kind === "sleep") return e.end_at ? "Sleep " + Math.round((new Date(e.end_at) - new Date(e.start_at)) / 60000) + "m" : "Asleep";
  if (e.kind === "feed") { const ml = num(d.amountMl); return ml ? "Bottle " + ml + " ml" : (d.feedType === "breast" ? "Breastfeed" : "Feed"); }
  if (e.kind === "nappy") return (d.nappy || "") + " nappy";
  if (e.kind === "medicine") return "Medicine" + (d.medicineName ? ": " + d.medicineName : "");
  return e.kind.charAt(0).toUpperCase() + e.kind.slice(1);
}

function render() {
  if (!state || !state.ok) { message("This link has expired or was turned off. Ask for a new one."); return; }
  const ev = Array.isArray(state.events) ? state.events : [];
  const sleeps = ev.filter(e => e.kind === "sleep");
  const asleep = sleeps.find(e => !e.end_at);
  const lastWake = sleeps.filter(e => e.end_at).map(e => e.end_at).sort().pop();
  const lastFeed = ev.find(e => e.kind === "feed");
  const lastNappy = ev.find(e => e.kind === "nappy");
  const lastMed = ev.find(e => e.kind === "medicine");
  const plan = state.plan || {};
  const feedMl = lastFeed ? num((lastFeed.data || {}).amountMl) : null;

  let hero;
  if (asleep) {
    hero = `<div class="label">ASLEEP</div><div class="big">${esc(ago(asleep.start_at))}</div>
      <div class="sub">since ${esc(t(asleep.start_at))}${plan.likelyWake ? " · usually wakes ~" + esc(t(plan.likelyWake)) : ""}</div>`;
  } else if (plan.nextNap && new Date(plan.nextNap) > Date.now() - 3600000) {
    hero = `<div class="label">${plan.isBedtime ? "BEDTIME" : "NEXT NAP"}</div><div class="big">${esc(t(plan.nextNap))}</div>
      <div class="sub">${lastWake ? "awake " + esc(ago(lastWake)) : ""}</div>`;
  } else {
    hero = `<div class="label">AWAKE</div><div class="big">${lastWake ? esc(ago(lastWake)) : "–"}</div>
      <div class="sub">${lastWake ? "since " + esc(t(lastWake)) : ""}</div>`;
  }
  const feedText = lastFeed ? `${t(lastFeed.start_at)}${feedMl ? " · " + feedMl + " ml" : ""} (${ago(lastFeed.start_at)} ago)` : "–";
  const recent = ev.slice(0, 8).map(e =>
    `<div class="row"><span>${esc(label(e))}</span><span class="muted">${esc(t(e.start_at))}${e.created_by_name ? " · " + esc(e.created_by_name) : ""}</span></div>`
  ).join("");
  const until = state.expires_at ? new Date(state.expires_at).toLocaleDateString([], { day: "numeric", month: "short" }) : "";

  document.getElementById("app").innerHTML = `
    <div class="muted">${esc(state.label || "Looking after")}</div>
    <h1>${esc(state.baby)}</h1>
    <div class="hero">${hero}</div>
    ${plan.notes ? `<div class="card"><b>Notes from Mum and Dad</b><div class="muted" style="margin-top:6px">${esc(plan.notes)}</div></div>` : ""}
    <div class="grid" style="margin-top:12px">
      <button class="sleep" data-act="sleep">${asleep ? "☀️ Woke up" : "🌙 Asleep"}</button>
      <button class="feed" data-act="feedbox">🍼 Feed</button>
      <button class="wet" data-act="wet">💧 Wet nappy</button>
      <button class="dirty" data-act="dirty">💩 Dirty nappy</button>
    </div>
    <div class="ml" id="mlbox" style="display:none">
      <input id="ml" type="number" inputmode="numeric" min="1" max="500" step="5" placeholder="Bottle ml (or leave empty)">
      <button data-act="feed">Save feed</button>
    </div>
    <div class="card">
      <div class="row"><span>Last feed</span><span class="muted">${esc(feedText)}</span></div>
      <div class="row"><span>Last nappy</span><span class="muted">${lastNappy ? esc(t(lastNappy.start_at) + " · " + ((lastNappy.data || {}).nappy || "")) : "–"}</span></div>
      ${lastMed ? `<div class="row"><span>Last medicine</span><span class="muted">${esc(t(lastMed.start_at) + " · " + ((lastMed.data || {}).medicineName || "given"))}</span></div>` : ""}
      ${plan.bedtime ? `<div class="row"><span>Bedtime</span><span class="muted">around ${esc(t(plan.bedtime))}</span></div>` : ""}
    </div>
    <div class="card"><b>Recent</b>${recent || "<div class='muted'>Nothing in the last day.</div>"}</div>
    <div class="card"><label class="muted" for="name">Your name (shows next to what you log)</label>
      <input id="name" maxlength="40" autocomplete="off" placeholder="e.g. Granny"></div>
    <p class="muted" style="margin-top:16px">Shared from the Lullo app. Everything you log shows up for the family straight away.${until ? " This link works until " + esc(until) + "." : ""}
      <a href="privacy.html" rel="noreferrer">Privacy</a></p>`;
  const nameBox = document.getElementById("name");
  nameBox.value = who();
  nameBox.addEventListener("change", () => setWho(nameBox.value));
}

async function log(kind, data) {
  if (busy) return;
  busy = true;
  try {
    const r = await rpc("care_log", { t: token, k: kind, d: data, who: who() });
    if (!r || !r.ok) { toast((r && r.error) || "Couldn't save that"); return; }
    toast(r.did === "woke" ? "Woke up logged" : kind === "sleep" ? "Sleep started" : "Saved");
    const box = document.getElementById("mlbox");
    if (box) box.style.display = "none";
    state = null;  // force a fresh redraw
    await load();
  } catch (e) {
    toast("Couldn't save. Check the internet connection.");
  } finally {
    busy = false;
  }
}

function feed() {
  const raw = document.getElementById("ml").value.trim();
  if (!raw) { log("feed", { feedType: "bottle" }); return; }
  const ml = parseInt(raw, 10);
  if (!(ml >= 1 && ml <= 500)) { toast("Bottle amount should be 1 to 500 ml"); return; }
  log("feed", { feedType: "bottle", amountMl: ml });
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  switch (btn.dataset.act) {
    case "sleep": log("sleep", {}); break;
    case "feedbox": { const box = document.getElementById("mlbox"); box.style.display = box.style.display === "flex" ? "none" : "flex"; break; }
    case "feed": feed(); break;
    case "wet": log("nappy", { nappy: "wet" }); break;
    case "dirty": log("nappy", { nappy: "dirty" }); break;
  }
});

load();
setInterval(load, 30000);
