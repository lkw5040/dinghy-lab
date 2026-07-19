/* ============================================================
   Dinghy Lab — right-of-way simulator
   Engine (pure functions) + interactive UI + quiz.
   Text comes from HubI18n (see simulator-i18n.js / i18n.js).
   ============================================================ */

"use strict";

/* ───────────────── engine (pure) ─────────────────
   Screen coords (x→right, y→down), compass headings (0=up, CW).
   Scenario: { windFrom, A: {x,y,heading,tacking}, B: {...} }   */

const WORLD_W = 900;
const WORLD_H = 600;
const BOAT_LEN = 92;
const BOW_OFF = BOAT_LEN * 0.52;
const STERN_OFF = BOAT_LEN * 0.48;
const ZONE_LENGTHS = 3;

function degToRad(deg) { return (deg * Math.PI) / 180; }
function normDeg(deg) { return ((Math.round(deg) % 360) + 360) % 360; }
function angleDiff(a, b) {
  const d = Math.abs(normDeg(a - b));
  return d > 180 ? 360 - d : d;
}
function signedDelta(target, from) {
  let d = (target - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}
function vecFromCompass(deg) {
  const r = degToRad(deg);
  return { x: Math.sin(r), y: -Math.cos(r) };
}
function dot(a, b) { return a.x * b.x + a.y * b.y; }

function tackOf(heading, windFrom) {
  const f = vecFromCompass(heading);
  const s = vecFromCompass(windFrom);
  const cross = f.x * s.y - f.y * s.x;
  return cross >= 0 ? "starboard" : "port";
}

function bowPoint(boat) {
  const f = vecFromCompass(boat.heading);
  return { x: boat.x + f.x * BOW_OFF, y: boat.y + f.y * BOW_OFF };
}
function sternPoint(boat) {
  const f = vecFromCompass(boat.heading);
  return { x: boat.x - f.x * STERN_OFF, y: boat.y - f.y * STERN_OFF };
}

/* RRS definition: X clear astern of Y when X's bow is behind
   the line abeam from Y's stern */
function isClearAstern(X, Y) {
  const fY = vecFromCompass(Y.heading);
  const bX = bowPoint(X);
  const sY = sternPoint(Y);
  return dot({ x: bX.x - sY.x, y: bX.y - sY.y }, fY) < 0;
}

function isOverlapped(A, B) {
  return !isClearAstern(A, B) && !isClearAstern(B, A);
}

function leewardSideVec(boat, windFrom) {
  const tack = tackOf(boat.heading, windFrom);
  return vecFromCompass(boat.heading + (tack === "starboard" ? -90 : 90));
}

function leewardBoat(sc) {
  const { A, B, windFrom } = sc;
  const rel = { x: B.x - A.x, y: B.y - A.y };
  const scoreFromA = dot(rel, leewardSideVec(A, windFrom));
  const scoreFromB = dot({ x: -rel.x, y: -rel.y }, leewardSideVec(B, windFrom));
  if (Math.abs(scoreFromA) < 1 && Math.abs(scoreFromB) < 1) {
    const down = vecFromCompass(windFrom + 180);
    return dot({ x: A.x, y: A.y }, down) > dot({ x: B.x, y: B.y }, down) ? "A" : "B";
  }
  return scoreFromA - scoreFromB > 0 ? "B" : "A";
}

function decide(sc) {
  const { A, B, windFrom } = sc;
  const tackA = tackOf(A.heading, windFrom);
  const tackB = tackOf(B.heading, windFrom);
  const overlap = isOverlapped(A, B);
  const base = { tackA, tackB, overlap, windFrom };

  if (A.tacking && B.tacking) {
    let loser;
    if (isClearAstern(A, B)) loser = "A";
    else if (isClearAstern(B, A)) loser = "B";
    else {
      const portOfB = vecFromCompass(B.heading - 90);
      loser = dot({ x: A.x - B.x, y: A.y - B.y }, portOfB) > 0 ? "A" : "B";
    }
    const winner = loser === "A" ? "B" : "A";
    return { ...base, winner, loser, rule: "RRS 13", code: "rule13both" };
  }
  if (A.tacking) return { ...base, winner: "B", loser: "A", rule: "RRS 13", code: "rule13" };
  if (B.tacking) return { ...base, winner: "A", loser: "B", rule: "RRS 13", code: "rule13" };

  if (tackA !== tackB) {
    const winner = tackA === "starboard" ? "A" : "B";
    return { ...base, winner, loser: winner === "A" ? "B" : "A", rule: "RRS 10", code: "rule10" };
  }
  if (overlap) {
    const winner = leewardBoat(sc);
    return { ...base, winner, loser: winner === "A" ? "B" : "A", rule: "RRS 11", code: "rule11" };
  }
  const winner = isClearAstern(A, B) ? "B" : "A";
  return { ...base, winner, loser: winner === "A" ? "B" : "A", rule: "RRS 12", code: "rule12" };
}

function analyzeMark(sc, mark) {
  if (!mark || !mark.enabled) return null;
  const zoneR = BOAT_LEN * ZONE_LENGTHS;
  const dA = Math.hypot(sc.A.x - mark.x, sc.A.y - mark.y);
  const dB = Math.hypot(sc.B.x - mark.x, sc.B.y - mark.y);
  return { dA, dB, inA: dA <= zoneR, inB: dB <= zoneR, overlap: isOverlapped(sc.A, sc.B), zoneR };
}

if (typeof module !== "undefined" && typeof window === "undefined") {
  module.exports = {
    tackOf, isClearAstern, isOverlapped, leewardBoat, decide, analyzeMark,
    normDeg, angleDiff, signedDelta, vecFromCompass,
    BOAT_LEN, WORLD_W, WORLD_H, ZONE_LENGTHS,
  };
}

/* ═══════════════ browser only ═══════════════ */
if (typeof window !== "undefined") {

const state = {
  windFrom: 0,
  boats: {
    A: { x: 330, y: 370, heading: 315, tacking: false },
    B: { x: 560, y: 280, heading: 45, tacking: false },
  },
  mark: { enabled: false, x: 700, y: 170 },
  drag: null,
  dialDrag: null,
  tackAnim: null,
  sailing: false,
  lastFrame: 0,
  collided: false,
  ruleContext: { initialized: false, lastWinner: null, acquiredBy: null, acquiredAt: 0, changingBoat: null, changingUntil: 0 },
};

const $ = (id) => document.getElementById(id);
const text = function (key) { return window.HubI18n.t.apply(null, arguments); };

function scenario() {
  return { windFrom: state.windFrom, A: state.boats.A, B: state.boats.B };
}

function angleLabel(deg) { return `${normDeg(deg)}°`; }
function tackText(tack) { return tack === "starboard" ? text("starboard") : text("port"); }

function sailingWarning(boat) {
  const diff = angleDiff(boat.heading, state.windFrom);
  if (diff < 32) return text("noGo");
  if (diff > 170) return text("deadRun");
  return "";
}

function shortReason(d) {
  switch (d.code) {
    case "rule10": return text("rule10Short", d.winner, d.loser);
    case "rule11": return text("rule11Short", d.winner, d.loser);
    case "rule12": return text("rule12Short", d.winner, d.loser);
    case "rule13": return text("rule13Short", d.winner, d.loser);
    case "rule13both": return text("rule13BothShort", d.winner, d.loser);
    default: return "";
  }
}

function longReason(d) {
  switch (d.code) {
    case "rule10": return text("rule10Reason", d.winner, d.loser,
      tackText(d.winner === "A" ? d.tackA : d.tackB), tackText(d.loser === "A" ? d.tackA : d.tackB));
    case "rule11": return text("rule11Reason", d.winner, d.loser, tackText(d.tackA));
    case "rule12": return text("rule12Reason", d.winner, d.loser, tackText(d.tackA));
    case "rule13": return text("rule13Reason", d.winner, d.loser);
    case "rule13both": return text("rule13BothReason", d.winner, d.loser);
    default: return "";
  }
}

function relationText(d) {
  switch (d.code) {
    case "rule10": return text("relationOpposite");
    case "rule11": return text("relationOverlap");
    case "rule12": return text("relationClear");
    case "rule13": return text("relationTacking", d.loser);
    case "rule13both": return text("relationBothTacking");
    default: return "";
  }
}

/* ───────── responsive canvas ───────── */

const canvas = $("seaCanvas");
const ctx = canvas.getContext("2d");
let viewScale = 1;

function resizeCanvas() {
  const wrap = canvas.parentElement;
  const cssW = wrap.clientWidth;
  const cssH = cssW * (WORLD_H / WORLD_W);
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  viewScale = canvas.width / WORLD_W;
  render();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD_W,
    y: ((event.clientY - rect.top) / rect.height) * WORLD_H,
  };
}

/* ───────── drawing ───────── */

function drawWater(c, w, h) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#e2f6fa");
  g.addColorStop(1, "#b7e7ee");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(255,255,255,.45)";
  c.lineWidth = 2;
  for (let y = 60; y < h; y += 64) {
    c.beginPath();
    for (let x = 0; x <= w; x += 16) {
      const yy = y + Math.sin((x + y) / 40) * 4.5;
      if (x === 0) c.moveTo(x, yy); else c.lineTo(x, yy);
    }
    c.stroke();
  }
}

function drawWindIndicator(c, windFrom, w) {
  const to = vecFromCompass(windFrom + 180);
  c.save();
  c.strokeStyle = "rgba(40,121,208,.5)";
  c.fillStyle = "rgba(40,121,208,.5)";
  c.lineWidth = 3;
  c.lineCap = "round";
  const anchors = [
    { x: w * 0.5, y: 60 },
    { x: w * 0.68, y: 100 },
    { x: w * 0.34, y: 100 },
  ];
  anchors.forEach((p) => {
    const s = { x: p.x - to.x * 34, y: p.y - to.y * 34 };
    const e = { x: p.x + to.x * 34, y: p.y + to.y * 34 };
    c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(e.x, e.y); c.stroke();
    const ang = Math.atan2(e.y - s.y, e.x - s.x);
    c.beginPath();
    c.moveTo(e.x, e.y);
    c.lineTo(e.x - Math.cos(ang - 0.5) * 12, e.y - Math.sin(ang - 0.5) * 12);
    c.lineTo(e.x - Math.cos(ang + 0.5) * 12, e.y - Math.sin(ang + 0.5) * 12);
    c.closePath(); c.fill();
  });
  c.restore();

  c.save();
  const cx = 74, cy = 84, R = 44;
  c.fillStyle = "rgba(255,255,255,.86)";
  c.strokeStyle = "rgba(11,71,81,.25)";
  c.lineWidth = 2;
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill(); c.stroke();
  const from = vecFromCompass(windFrom);
  c.strokeStyle = "#2879d0";
  c.fillStyle = "#2879d0";
  c.lineWidth = 5; c.lineCap = "round";
  const s = { x: cx + from.x * (R - 10), y: cy + from.y * (R - 10) };
  const e = { x: cx - from.x * (R - 10), y: cy - from.y * (R - 10) };
  c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(e.x, e.y); c.stroke();
  const ang = Math.atan2(e.y - s.y, e.x - s.x);
  c.beginPath();
  c.moveTo(e.x, e.y);
  c.lineTo(e.x - Math.cos(ang - 0.55) * 15, e.y - Math.sin(ang - 0.55) * 15);
  c.lineTo(e.x - Math.cos(ang + 0.55) * 15, e.y - Math.sin(ang + 0.55) * 15);
  c.closePath(); c.fill();
  c.fillStyle = "#0b4751";
  c.font = "900 15px sans-serif";
  c.textAlign = "left";
  c.fillText(text("wind"), cx + R + 12, cy - 6);
  c.font = "800 12px sans-serif";
  c.fillText(text("windFromCanvas", angleLabel(windFrom)), cx + R + 12, cy + 13);
  c.restore();
}

function drawMarkShape(c, mark) {
  if (!mark.enabled) return;
  const zoneR = BOAT_LEN * ZONE_LENGTHS;
  c.save();
  c.fillStyle = "rgba(240,184,78,.13)";
  c.strokeStyle = "rgba(216,158,44,.8)";
  c.lineWidth = 3;
  c.setLineDash([10, 7]);
  c.beginPath(); c.arc(mark.x, mark.y, zoneR, 0, Math.PI * 2); c.fill(); c.stroke();
  c.setLineDash([]);
  c.fillStyle = "#f0b84e";
  c.strokeStyle = "#6b4a00";
  c.lineWidth = 3;
  c.beginPath(); c.arc(mark.x, mark.y, 16, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = "#6b4a00";
  c.font = "950 12px sans-serif";
  c.textAlign = "center";
  c.fillText(text("mark"), mark.x, mark.y + 4);
  c.fillStyle = "rgba(11,71,81,.75)";
  c.font = "850 12px sans-serif";
  c.fillText(text("markZoneLabel"), mark.x, Math.min(WORLD_H - 12, mark.y + zoneR + 18));
  c.restore();
}

const BOAT_COLORS = {
  row: "#1f9d69",
  keep: "#d74f45",
  hold: "#f0b84e",
  neutralA: "#12617a",
  neutralB: "#7c5cbf",
};

function drawBoat(c, boat, name, role, opts = {}) {
  const color = BOAT_COLORS[role] || BOAT_COLORS.hold;
  const windFrom = opts.windFrom ?? state.windFrom;

  if (role === "row" || role === "keep") {
    c.save();
    c.strokeStyle = role === "row" ? "rgba(31,157,105,.4)" : "rgba(215,79,69,.4)";
    c.lineWidth = 4;
    c.setLineDash([6, 7]);
    c.beginPath(); c.arc(boat.x, boat.y, BOAT_LEN * 0.72, 0, Math.PI * 2); c.stroke();
    c.restore();
  }

  c.save();
  c.translate(boat.x, boat.y);
  c.rotate(degToRad(boat.heading));

  c.shadowColor = "rgba(0,0,0,.18)";
  c.shadowBlur = 10;
  c.shadowOffsetY = 5;
  c.fillStyle = color;
  c.strokeStyle = "#173238";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(0, -BOW_OFF);
  c.lineTo(27, 30);
  c.quadraticCurveTo(0, 44, -27, 30);
  c.closePath();
  c.fill(); c.stroke();
  c.shadowColor = "transparent";

  c.fillStyle = "rgba(255,255,255,.85)";
  c.beginPath();
  c.moveTo(0, -BOW_OFF + 10);
  c.lineTo(13, 20);
  c.lineTo(0, 27);
  c.lineTo(-13, 20);
  c.closePath();
  c.fill();

  const tk = tackOf(boat.heading, windFrom);
  const sailSide = tk === "starboard" ? -1 : 1;
  c.strokeStyle = "#173238";
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, -26); c.lineTo(0, 26); c.stroke();
  c.fillStyle = "rgba(255,255,255,.92)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, -22);
  c.quadraticCurveTo(26 * sailSide, 0, 38 * sailSide, 26);
  c.lineTo(0, 26);
  c.closePath();
  c.fill(); c.stroke();

  c.fillStyle = "#173238";
  c.font = "950 22px sans-serif";
  c.textAlign = "center";
  c.fillText(name, 0, 8);

  if (boat.tacking) {
    c.fillStyle = "#fff8e2";
    c.strokeStyle = "#f0b84e";
    c.lineWidth = 2;
    c.beginPath(); c.roundRect(-40, 50, 80, 24, 6); c.fill(); c.stroke();
    c.fillStyle = "#704f00";
    c.font = "900 12px sans-serif";
    c.fillText(text("tackingState"), 0, 66);
  }
  c.restore();

  if (opts.handles) {
    const bp = bowPoint(boat);
    c.save();
    c.strokeStyle = "rgba(23,50,56,.5)";
    c.lineWidth = 2;
    c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(boat.x, boat.y); c.lineTo(bp.x, bp.y); c.stroke();
    c.setLineDash([]);
    c.fillStyle = "#ffffff";
    c.strokeStyle = "#173238";
    c.lineWidth = 3;
    c.beginPath(); c.arc(bp.x, bp.y, 12, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = "#173238";
    c.font = "900 13px sans-serif";
    c.textAlign = "center";
    c.fillText("⟳", bp.x, bp.y + 4.5);
    c.restore();
  }
}

function drawVerdictChip(c, d, w) {
  c.save();
  c.fillStyle = "rgba(255,255,255,.92)";
  c.strokeStyle = "rgba(11,71,81,.22)";
  c.lineWidth = 1.5;
  c.beginPath(); c.roundRect(w - 258, 18, 240, 84, 10); c.fill(); c.stroke();
  c.fillStyle = "#0b4751";
  c.textAlign = "left";
  c.font = "950 16px sans-serif";
  c.fillText(d.rule, w - 240, 45);
  c.font = "800 13px sans-serif";
  c.fillText(relationText(d), w - 240, 67);
  c.fillStyle = d.winner ? "#1f9d69" : "#b8860b";
  c.font = "900 14px sans-serif";
  c.fillText(d.winner ? `${d.winner} ${text("rightOfWay")} · ${d.loser} ${text("keepClear")}` : text("undecided"), w - 240, 89);
  c.restore();
}

function drawProximityWarning(c, w) {
  const dist = Math.hypot(state.boats.A.x - state.boats.B.x, state.boats.A.y - state.boats.B.y);
  const contact = dist < BOAT_LEN * 0.95;
  const near = dist < BOAT_LEN * 1.7;
  if (!near) { state.collided = false; return; }
  const msg = contact ? text("collisionWarn") : text("nearWarn");
  c.save();
  c.font = "900 16px sans-serif";
  const tw = c.measureText(msg).width + 40;
  const x = (w - tw) / 2;
  c.fillStyle = contact ? "rgba(220,38,38,.95)" : "rgba(217,154,38,.95)";
  c.beginPath(); c.roundRect(x, 14, tw, 38, 10); c.fill();
  c.fillStyle = "#fff";
  c.textAlign = "center";
  c.fillText(msg, w / 2, 39);
  c.restore();
  if (contact && state.sailing && !state.collided) {
    state.collided = true;
    stopSailing();
  }
}

function render() {
  const d = decide(scenario());
  ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
  drawWater(ctx, WORLD_W, WORLD_H);
  drawMarkShape(ctx, state.mark);
  drawWindIndicator(ctx, state.windFrom, WORLD_W);

  ctx.save();
  ctx.strokeStyle = "rgba(11,71,81,.3)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(state.boats.A.x, state.boats.A.y);
  ctx.lineTo(state.boats.B.x, state.boats.B.y);
  ctx.stroke();
  ctx.restore();

  const roleOf = (n) => (d.winner === null ? "hold" : d.winner === n ? "row" : "keep");
  drawBoat(ctx, state.boats.A, "A", roleOf("A"), { handles: true });
  drawBoat(ctx, state.boats.B, "B", roleOf("B"), { handles: true });
  drawVerdictChip(ctx, d, WORLD_W);
  drawProximityWarning(ctx, WORLD_W);

  updatePanel(d);
  return d;
}

/* ───────── sail playback ───────── */

const SAIL_SPEED = BOAT_LEN * 0.85;

function boatSpeedFactor(boat) {
  const diff = angleDiff(boat.heading, state.windFrom);
  if (diff < 32) return 0;
  if (diff < 50) return 0.72;
  if (diff > 170) return 0.62;
  return 1;
}

function stepSail(dt) {
  ["A", "B"].forEach((name) => {
    const b = state.boats[name];
    const f = vecFromCompass(b.heading);
    const v = SAIL_SPEED * boatSpeedFactor(b) * dt;
    b.x = Math.max(52, Math.min(WORLD_W - 52, b.x + f.x * v));
    b.y = Math.max(60, Math.min(WORLD_H - 66, b.y + f.y * v));
  });
}

function sailLoop(now) {
  if (!state.sailing) return;
  const dt = Math.min(0.05, (now - state.lastFrame) / 1000 || 0);
  state.lastFrame = now;
  stepSail(dt);
  render();
  if (state.sailing) requestAnimationFrame(sailLoop);
}

function startSailing() {
  if (state.sailing) return;
  state.sailing = true;
  state.collided = false;
  state.lastFrame = performance.now();
  updateSailToggle();
  requestAnimationFrame(sailLoop);
}

function stopSailing() {
  state.sailing = false;
  updateSailToggle();
}

function updateSailToggle() {
  const btn = $("sailToggle");
  if (!btn) return;
  btn.setAttribute("aria-pressed", state.sailing ? "true" : "false");
  $("sailToggleIcon").textContent = state.sailing ? "⏸" : "▶";
  $("sailToggleLabel").textContent = text(state.sailing ? "sailStop" : "sailPlay");
}

$("sailToggle").addEventListener("click", () => {
  if (state.sailing) stopSailing();
  else startSailing();
});

/* ───────── panels ───────── */

function updateVerdictBanner(d) {
  const setSide = (el, wordEl, name) => {
    el.classList.remove("is-row", "is-keep", "is-hold");
    if (d.winner === null) { el.classList.add("is-hold"); wordEl.textContent = text("holdWord"); }
    else if (d.winner === name) { el.classList.add("is-row"); wordEl.textContent = text("rowWord"); }
    else { el.classList.add("is-keep"); wordEl.textContent = text("keepWord"); }
  };
  setSide($("verdictA"), $("verdictWordA"), "A");
  setSide($("verdictB"), $("verdictWordB"), "B");
  $("verdictRule").textContent = `${d.rule} · ${relationText(d)}`;
  $("verdictReason").textContent = shortReason(d);
}

function updateObligations(d) {
  const cx = state.ruleContext;
  const now = Date.now();
  if (!cx.initialized) cx.initialized = true;
  else if (d.winner && d.winner !== cx.lastWinner) { cx.acquiredBy = d.winner; cx.acquiredAt = now; }
  cx.lastWinner = d.winner;

  const items = [text("rule14Notice")];
  if (d.winner && cx.acquiredBy === d.winner && now - cx.acquiredAt < 5000) items.push(text("rule15Notice", d.winner));
  if (d.winner && cx.changingBoat === d.winner && now < cx.changingUntil) items.push(text("rule16Notice", d.winner));
  if (d.code === "rule11" && d.winner) items.push(text("rule17Notice", d.winner));
  return items;
}

function markNote() {
  const m = analyzeMark(scenario(), state.mark);
  if (!m) return "";
  if (m.inA && m.inB) return m.overlap ? text("markBothOverlap") : text("markBothClear");
  if (m.inA) return text("markOneBoat", "A");
  if (m.inB) return text("markOneBoat", "B");
  return text("markNoBoat");
}

function updatePanel(d) {
  updateVerdictBanner(d);
  $("windValue").textContent = angleLabel(state.windFrom);
  $("headingAValue").textContent = angleLabel(state.boats.A.heading);
  $("headingBValue").textContent = angleLabel(state.boats.B.heading);

  const stateLine = (boat) => {
    const warn = sailingWarning(boat);
    return `${tackText(tackOf(boat.heading, state.windFrom))}${boat.tacking ? ` · ${text("tackingState")}` : ""}${warn ? ` · ${warn}` : ""}`;
  };
  $("stateA").textContent = stateLine(state.boats.A);
  $("stateB").textContent = stateLine(state.boats.B);

  $("longReasonText").textContent = longReason(d);

  const factors = [
    text("factorTacks", tackText(d.tackA), tackText(d.tackB)),
    text("factorAngles", angleLabel(state.windFrom), angleLabel(state.boats.A.heading), angleLabel(state.boats.B.heading)),
    text("factorOverlap", d.overlap ? text("overlapYes") : text("overlapNo")),
  ];
  const m = analyzeMark(scenario(), state.mark);
  if (m) factors.push(text("factorMark", (m.dA / BOAT_LEN).toFixed(1), (m.dB / BOAT_LEN).toFixed(1)));
  $("reasonList").innerHTML = factors.map((f) => `<li>${f}</li>`).join("");
  $("obligationList").innerHTML = updateObligations(d).map((o) => `<li>${o}</li>`).join("");

  const note = markNote();
  $("markReason").textContent = note;
  $("markReason").hidden = !note;

  updateWindDial();
  updateTackButtons();
}

function updateWindDial() {
  const dial = $("windDial");
  dial.style.setProperty("--angle", `${normDeg(state.windFrom)}deg`);
  dial.setAttribute("aria-valuenow", String(normDeg(state.windFrom)));
}

function updateTackButtons() {
  ["A", "B"].forEach((name) => {
    const btn = $(`tackButton${name}`);
    if (!btn) return;
    const isTack = angleDiff(state.boats[name].heading, state.windFrom) <= 90;
    btn.textContent = text(isTack ? "doTack" : "doGybe");
    btn.disabled = !!(state.tackAnim && state.tackAnim.boat);
  });
}

/* ───────── canvas interaction ───────── */

function hitTest(p) {
  for (const name of ["A", "B"]) {
    const bp = bowPoint(state.boats[name]);
    if (Math.hypot(p.x - bp.x, p.y - bp.y) < 26) return { type: "rotate", boat: name };
  }
  let best = null, bestDist = Infinity;
  for (const name of ["A", "B"]) {
    const b = state.boats[name];
    const dist = Math.hypot(p.x - b.x, p.y - b.y);
    if (dist < 70 && dist < bestDist) { best = name; bestDist = dist; }
  }
  if (best) return { type: "move", boat: best };
  if (state.mark.enabled && Math.hypot(p.x - state.mark.x, p.y - state.mark.y) < 40) return { type: "mark" };
  return null;
}

function markCourseChange(name) {
  state.ruleContext.changingBoat = name;
  state.ruleContext.changingUntil = Date.now() + 1400;
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" && !e.isPrimary) return;
  if (state.drag) return;
  const hit = hitTest(canvasPoint(e));
  if (!hit) return;
  state.drag = { ...hit, pointerId: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = "grabbing";
  e.preventDefault();
});

canvas.addEventListener("pointermove", (e) => {
  if (!state.drag) {
    const hit = hitTest(canvasPoint(e));
    canvas.style.cursor = hit ? (hit.type === "rotate" ? "crosshair" : "grab") : "default";
    return;
  }
  if (e.pointerId !== state.drag.pointerId) return;
  const p = canvasPoint(e);
  if (state.drag.type === "mark") {
    state.mark.x = Math.max(26, Math.min(WORLD_W - 26, p.x));
    state.mark.y = Math.max(26, Math.min(WORLD_H - 26, p.y));
  } else if (state.drag.type === "move") {
    const b = state.boats[state.drag.boat];
    b.x = Math.max(52, Math.min(WORLD_W - 52, p.x));
    b.y = Math.max(60, Math.min(WORLD_H - 66, p.y));
  } else if (state.drag.type === "rotate") {
    const b = state.boats[state.drag.boat];
    b.heading = normDeg((Math.atan2(p.x - b.x, -(p.y - b.y)) * 180) / Math.PI);
    markCourseChange(state.drag.boat);
  }
  render();
});

function endCanvasDrag(e) {
  if (!state.drag) return;
  if (e && e.pointerId !== state.drag.pointerId) return;
  state.drag = null;
  canvas.style.cursor = "default";
}
canvas.addEventListener("pointerup", endCanvasDrag);
canvas.addEventListener("pointercancel", endCanvasDrag);
canvas.addEventListener("lostpointercapture", endCanvasDrag);

/* ───────── wind dial ───────── */

const windDial = $("windDial");

function dialAngle(e) {
  const rect = windDial.getBoundingClientRect();
  const x = e.clientX - (rect.left + rect.width / 2);
  const y = e.clientY - (rect.top + rect.height / 2);
  return normDeg((Math.atan2(x, -y) * 180) / Math.PI);
}

windDial.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" && !e.isPrimary) return;
  state.dialDrag = { pointerId: e.pointerId };
  windDial.setPointerCapture(e.pointerId);
  state.windFrom = dialAngle(e);
  render();
  e.preventDefault();
});
windDial.addEventListener("pointermove", (e) => {
  if (!state.dialDrag || e.pointerId !== state.dialDrag.pointerId) return;
  state.windFrom = dialAngle(e);
  render();
});
["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) =>
  windDial.addEventListener(ev, () => { state.dialDrag = null; })
);
windDial.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 15 : 5;
  if (e.key === "ArrowLeft" || e.key === "ArrowDown") { state.windFrom = normDeg(state.windFrom - step); render(); e.preventDefault(); }
  if (e.key === "ArrowRight" || e.key === "ArrowUp") { state.windFrom = normDeg(state.windFrom + step); render(); e.preventDefault(); }
});

/* ───────── buttons / checkboxes ───────── */

document.querySelectorAll("[data-adjust]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.adjust;
    const delta = Number(btn.dataset.delta);
    if (target === "wind") state.windFrom = normDeg(state.windFrom + delta);
    else {
      state.boats[target].heading = normDeg(state.boats[target].heading + delta);
      markCourseChange(target);
    }
    render();
  });
});

$("tackingA").addEventListener("change", (e) => { state.boats.A.tacking = e.target.checked; render(); });
$("tackingB").addEventListener("change", (e) => { state.boats.B.tacking = e.target.checked; render(); });
$("markEnabled").addEventListener("change", (e) => { state.mark.enabled = e.target.checked; render(); });

/* ───────── tack / gybe animation ───────── */

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function startTack(name) {
  if (state.tackAnim) return;
  const b = state.boats[name];
  const isTack = angleDiff(b.heading, state.windFrom) <= 90;
  const axis = isTack ? state.windFrom : state.windFrom + 180;
  const delta = 2 * signedDelta(axis, b.heading);
  if (Math.abs(delta) < 2) return;
  state.tackAnim = {
    boat: name,
    from: b.heading,
    delta,
    start: performance.now(),
    dur: 2400,
    initialTack: tackOf(b.heading, state.windFrom),
    isGybe: !isTack,
    holdBefore: b.tacking,
  };
  updateTackButtons();
  requestAnimationFrame(tickTack);
}

function tickTack(now) {
  const anim = state.tackAnim;
  if (!anim) return;
  const b = state.boats[anim.boat];
  const t = Math.min(1, (now - anim.start) / anim.dur);
  b.heading = normDeg(anim.from + anim.delta * easeInOut(t));

  if (!anim.isGybe) {
    const passed = tackOf(b.heading, state.windFrom) !== anim.initialTack;
    b.tacking = passed && t < 1;
  }

  markCourseChange(anim.boat);
  render();

  if (t >= 1) {
    b.heading = normDeg(anim.from + anim.delta);
    b.tacking = anim.holdBefore && $(`tacking${anim.boat}`).checked;
    state.tackAnim = null;
    $(`tacking${anim.boat}`).checked = b.tacking;
    render();
    return;
  }
  requestAnimationFrame(tickTack);
}

document.querySelectorAll("[data-tack]").forEach((btn) => {
  btn.addEventListener("click", () => startTack(btn.dataset.tack));
});

/* ───────── presets ───────── */

const presets = {
  opposite: () => {
    state.windFrom = 0;
    state.boats.A = { x: 330, y: 370, heading: 315, tacking: false };
    state.boats.B = { x: 560, y: 280, heading: 45, tacking: false };
    state.mark.enabled = false;
  },
  leeward: () => {
    state.windFrom = 0;
    state.boats.A = { x: 420, y: 380, heading: 40, tacking: false };
    state.boats.B = { x: 330, y: 300, heading: 40, tacking: false };
    state.mark.enabled = false;
  },
  clear: () => {
    state.windFrom = 0;
    state.boats.A = { x: 500, y: 250, heading: 40, tacking: false };
    state.boats.B = { x: 370, y: 410, heading: 40, tacking: false };
    state.mark.enabled = false;
  },
  tacking: () => {
    state.windFrom = 0;
    state.boats.A = { x: 420, y: 330, heading: 5, tacking: true };
    state.boats.B = { x: 610, y: 340, heading: 315, tacking: false };
    state.mark.enabled = false;
  },
  downwind: () => {
    state.windFrom = 0;
    state.boats.A = { x: 380, y: 260, heading: 200, tacking: false };
    state.boats.B = { x: 540, y: 300, heading: 160, tacking: false };
    state.mark.enabled = false;
  },
  mark: () => {
    state.windFrom = 0;
    state.boats.A = { x: 520, y: 400, heading: 30, tacking: false };
    state.boats.B = { x: 620, y: 330, heading: 20, tacking: false };
    state.mark.enabled = true;
    state.mark.x = 690;
    state.mark.y = 160;
  },
};

document.querySelectorAll("[data-preset]").forEach((btn) => {
  btn.addEventListener("click", () => {
    stopSailing();
    presets[btn.dataset.preset]();
    state.ruleContext.initialized = false;
    state.ruleContext.acquiredBy = null;
    $("tackingA").checked = state.boats.A.tacking;
    $("tackingB").checked = state.boats.B.tacking;
    $("markEnabled").checked = state.mark.enabled;
    document.querySelectorAll("[data-preset]").forEach((b) => b.classList.toggle("active", b === btn));
    render();
  });
});

/* ───────── quiz ───────── */

const QUIZ_POOL = [
  // RRS 10 opposite tacks
  { windFrom: 0, A: { x: 330, y: 380, heading: 315, tacking: false }, B: { x: 560, y: 290, heading: 45, tacking: false } },
  { windFrom: 0, A: { x: 560, y: 300, heading: 45, tacking: false }, B: { x: 330, y: 380, heading: 315, tacking: false } },
  { windFrom: 90, A: { x: 400, y: 350, heading: 135, tacking: false }, B: { x: 560, y: 250, heading: 45, tacking: false } },
  { windFrom: 180, A: { x: 420, y: 280, heading: 135, tacking: false }, B: { x: 520, y: 360, heading: 225, tacking: false } },
  { windFrom: 270, A: { x: 380, y: 300, heading: 225, tacking: false }, B: { x: 550, y: 350, heading: 315, tacking: false } },
  // RRS 11 same tack overlapped
  { windFrom: 0, A: { x: 420, y: 390, heading: 40, tacking: false }, B: { x: 330, y: 310, heading: 40, tacking: false } },
  { windFrom: 0, A: { x: 330, y: 300, heading: 320, tacking: false }, B: { x: 430, y: 380, heading: 320, tacking: false } },
  { windFrom: 0, A: { x: 380, y: 300, heading: 150, tacking: false }, B: { x: 520, y: 300, heading: 150, tacking: false } },
  { windFrom: 90, A: { x: 450, y: 250, heading: 170, tacking: false }, B: { x: 450, y: 400, heading: 170, tacking: false } },
  // RRS 12 same tack not overlapped
  { windFrom: 0, A: { x: 500, y: 250, heading: 40, tacking: false }, B: { x: 370, y: 410, heading: 40, tacking: false } },
  { windFrom: 0, A: { x: 380, y: 430, heading: 320, tacking: false }, B: { x: 480, y: 300, heading: 320, tacking: false } },
  { windFrom: 90, A: { x: 350, y: 300, heading: 135, tacking: false }, B: { x: 560, y: 320, heading: 135, tacking: false } },
  // RRS 13 tacking
  { windFrom: 0, A: { x: 430, y: 330, heading: 0, tacking: true }, B: { x: 620, y: 340, heading: 315, tacking: false } },
  { windFrom: 0, A: { x: 400, y: 340, heading: 45, tacking: false }, B: { x: 590, y: 330, heading: 355, tacking: true } },
  { windFrom: 0, A: { x: 430, y: 400, heading: 0, tacking: true }, B: { x: 450, y: 260, heading: 5, tacking: true } },
  // downwind
  { windFrom: 0, A: { x: 380, y: 260, heading: 200, tacking: false }, B: { x: 540, y: 300, heading: 160, tacking: false } },
  { windFrom: 0, A: { x: 540, y: 300, heading: 160, tacking: false }, B: { x: 380, y: 260, heading: 200, tacking: false } },
];

const quiz = { active: false, order: [], index: 0, score: 0, answered: false, total: 10, lastReveal: null };
const quizCanvas = $("quizCanvas");
const qctx = quizCanvas.getContext("2d");
const BEST_KEY = "row-quiz-best";

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function updateQuizBest() {
  const el = $("quizBest");
  if (!el) return;
  const best = Number(localStorage.getItem(BEST_KEY) || -1);
  el.hidden = best < 0;
  if (best >= 0) el.textContent = text("quizBestLabel", best, quiz.total);
}

function resizeQuizCanvas() {
  const wrap = quizCanvas.parentElement;
  if (!wrap || wrap.clientWidth === 0) return;
  const cssW = wrap.clientWidth;
  const cssH = cssW * (WORLD_H / WORLD_W);
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  quizCanvas.style.width = `${cssW}px`;
  quizCanvas.style.height = `${cssH}px`;
  quizCanvas.width = Math.round(cssW * dpr);
  quizCanvas.height = Math.round(cssH * dpr);
  if (quiz.active) drawQuizScene(quiz.lastReveal);
}

function currentQuizScenario() {
  return quiz.order[quiz.index];
}

function drawQuizScene(revealDecision) {
  const sc = currentQuizScenario();
  if (!sc) return;
  quiz.lastReveal = revealDecision || null;
  const scale = quizCanvas.width / WORLD_W;
  qctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawWater(qctx, WORLD_W, WORLD_H);
  drawWindIndicator(qctx, sc.windFrom, WORLD_W);

  let roleA = "neutralA", roleB = "neutralB";
  if (revealDecision) {
    roleA = revealDecision.winner === "A" ? "row" : "keep";
    roleB = revealDecision.winner === "B" ? "row" : "keep";
  }
  drawBoat(qctx, sc.A, "A", roleA, { windFrom: sc.windFrom });
  drawBoat(qctx, sc.B, "B", roleB, { windFrom: sc.windFrom });
  if (revealDecision) drawVerdictChip(qctx, revealDecision, WORLD_W);
}

function showQuizQuestion() {
  quiz.answered = false;
  quiz.lastReveal = null;
  $("quizProgress").textContent = text("quizProgressLabel", quiz.index + 1, quiz.total);
  $("quizScore").textContent = text("quizScoreLabel", quiz.score);
  $("quizFeedback").hidden = true;
  document.querySelectorAll(".quiz-choice").forEach((b) => {
    b.disabled = false;
    b.classList.remove("correct", "wrong");
  });
  resizeQuizCanvas();
  drawQuizScene();
}

function startQuiz() {
  quiz.active = true;
  quiz.order = shuffle(QUIZ_POOL).slice(0, quiz.total);
  quiz.index = 0;
  quiz.score = 0;
  $("quizStart").hidden = true;
  $("quizResult").hidden = true;
  $("quizPlay").hidden = false;
  showQuizQuestion();
}

function quizExplain(d) {
  switch (d.code) {
    case "rule10": return text("rule10Reason", d.winner, d.loser, tackText(d.winner === "A" ? d.tackA : d.tackB), tackText(d.loser === "A" ? d.tackA : d.tackB));
    case "rule11": return text("rule11Reason", d.winner, d.loser, tackText(d.tackA));
    case "rule12": return text("rule12Reason", d.winner, d.loser, tackText(d.tackA));
    case "rule13": return text("rule13Reason", d.winner, d.loser);
    case "rule13both": return text("rule13BothReason", d.winner, d.loser);
    default: return "";
  }
}

function answerQuiz(choice) {
  if (quiz.answered) return;
  quiz.answered = true;
  const sc = currentQuizScenario();
  const d = decide(sc);
  const correct = choice === d.loser;
  if (correct) quiz.score += 1;

  document.querySelectorAll(".quiz-choice").forEach((b) => {
    b.disabled = true;
    if (b.dataset.choice === d.loser) b.classList.add("correct");
    else if (b.dataset.choice === choice && !correct) b.classList.add("wrong");
  });

  drawQuizScene(d);

  $("quizFeedbackTitle").textContent = correct ? text("quizCorrect") : text("quizWrong");
  $("quizFeedbackText").textContent = quizExplain(d);
  $("quizFeedback").hidden = false;
  $("quizScore").textContent = text("quizScoreLabel", quiz.score);
}

function nextQuiz() {
  quiz.index += 1;
  if (quiz.index >= quiz.total) {
    $("quizPlay").hidden = true;
    $("quizResult").hidden = false;
    $("quizResultScore").textContent = text("quizResultScore", quiz.score, quiz.total);
    const msg = quiz.score >= 9 ? "quizResultGreat" : quiz.score >= 6 ? "quizResultGood" : "quizResultTry";
    $("quizResultMessage").textContent = text(msg);
    const best = Number(localStorage.getItem(BEST_KEY) || -1);
    if (quiz.score > best) localStorage.setItem(BEST_KEY, String(quiz.score));
    updateQuizBest();
    quiz.active = false;
    return;
  }
  showQuizQuestion();
}

$("quizStartButton").addEventListener("click", startQuiz);
$("quizRetryButton").addEventListener("click", startQuiz);
$("quizNextButton").addEventListener("click", nextQuiz);
document.querySelectorAll(".quiz-choice").forEach((b) => {
  b.addEventListener("click", () => answerQuiz(b.dataset.choice));
});

/* ───────── language change ───────── */

window.HubI18n.onChange(() => {
  updateSailToggle();
  updateTackButtons();
  updateQuizBest();
  render();
  if (quiz.active) {
    showQuizQuestionTexts();
    drawQuizScene(quiz.lastReveal);
  }
});

function showQuizQuestionTexts() {
  $("quizProgress").textContent = text("quizProgressLabel", quiz.index + 1, quiz.total);
  $("quizScore").textContent = text("quizScoreLabel", quiz.score);
  if (quiz.lastReveal) {
    $("quizFeedbackText").textContent = quizExplain(quiz.lastReveal);
  }
}

/* ───────── init ───────── */

window.addEventListener("resize", () => { resizeCanvas(); resizeQuizCanvas(); });
window.addEventListener("load", () => { resizeCanvas(); resizeQuizCanvas(); });
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => resizeCanvas()).observe(canvas.parentElement);
  new ResizeObserver(() => resizeQuizCanvas()).observe(quizCanvas.parentElement);
}

updateSailToggle();
updateQuizBest();
resizeCanvas();
resizeQuizCanvas();
render();

}
