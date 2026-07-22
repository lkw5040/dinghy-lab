/* ============================================================
   Dinghy Lab — 2-player race game
   All display text comes from HubI18n (see game-i18n.js).
   Internal identifiers (tacks, phases, course keys) are English.
   ============================================================ */

"use strict";

const canvas = document.getElementById("raceCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const START_Y = 720;
const START_LEFT = 460;
const START_RIGHT = 980;
const PIN_X = START_LEFT - 18;
const PIN_Y = START_Y;
const RC_X = START_RIGHT + 35;
const RC_Y = START_Y + 3;
const BOAT_RADIUS = 21;
const INTERACTION_RANGE = 270;
const MARK_RADIUS = 58;
const MARK_BODY_RADIUS = 18;
const MARK_ROUNDING_RADIUS = 108;
const REQUIRED_CCW_SWEEP = degToRad(105);
const RC_HIT_RADIUS = 42;
const PIN_HIT_RADIUS = 18;
const TEAM_COLORS = { A: "#ee715f", B: "#2879d0" };
const keys = new Set();

const t = function () { return window.HubI18n.t.apply(null, arguments); };

const ui = {
  setupOverlay: document.getElementById("setupOverlay"),
  setupForm: document.getElementById("setupForm"),
  pauseButton: document.getElementById("pauseButton"),
  newRaceButton: document.getElementById("newRaceButton"),
  clearLogButton: document.getElementById("clearLogButton"),
  eventLog: document.getElementById("eventLog"),
  courseLabel: document.getElementById("courseLabel"),
  raceTime: document.getElementById("raceTime"),
  windReadout: document.getElementById("windReadout"),
  raceStatus: document.getElementById("raceStatus"),
  signalCountdown: document.getElementById("signalCountdown"),
  signalTitle: document.getElementById("signalTitle"),
  signalDetail: document.getElementById("signalDetail"),
  classFlag: document.getElementById("classFlag"),
  prepFlag: document.getElementById("prepFlag"),
  centerMessage: document.getElementById("centerMessage"),
  centerEyebrow: document.getElementById("centerEyebrow"),
  centerTitle: document.getElementById("centerTitle"),
  centerDetail: document.getElementById("centerDetail"),
  decisionWinner: document.getElementById("decisionWinner"),
  decisionRule: document.getElementById("decisionRule"),
  decisionReason: document.getElementById("decisionReason"),
  aPlace: document.getElementById("aPlace"),
  bPlace: document.getElementById("bPlace"),
  aProgress: document.getElementById("aProgress"),
  bProgress: document.getElementById("bProgress"),
  aTarget: document.getElementById("aTarget"),
  bTarget: document.getElementById("bTarget"),
  aState: document.getElementById("aState"),
  bState: document.getElementById("bState"),
  aPenalty: document.getElementById("aPenalty"),
  bPenalty: document.getElementById("bPenalty"),
};

const courses = {
  windward: {
    nameKey: "gCourseNameWindward",
    marks: [
      { key: "gMarkWindward", x: 720, y: 145, color: "#f0b84e" },
      { key: "gMarkLeeward", x: 720, y: 590, color: "#f0b84e" },
    ],
  },
  triangle: {
    nameKey: "gCourseNameTriangle",
    marks: [
      { key: "gMarkWindward", x: 625, y: 145, color: "#f0b84e" },
      { key: "gMarkReach", x: 1160, y: 390, color: "#f0b84e" },
      { key: "gMarkLeeward", x: 700, y: 600, color: "#f0b84e" },
    ],
  },
};

function markName(mark) { return t(mark.key); }
function courseName(courseKey) { return t(courses[courseKey].nameKey); }
function tackLabel(tack) { return tack === "starboard" ? t("gStarboard") : t("gPort"); }

const SHORE_W = 58;            // visible beach band on the left (wild mode)

const game = {
  configured: false,
  paused: true,
  phase: "setup",
  courseKey: "windward",
  sequenceLength: 60,
  weatherMode: "standard",
  env: emptyEnv(),
  countdown: 60,
  elapsed: 0,
  simTime: 0,
  lastFrame: performance.now(),
  startSignalSent: false,
  signalEvents: new Set(),
  bannerUntil: 0,
  banner: null,
  collisionCooldown: 0,
  winner: null,
  finishOrder: [],
  wind: {
    base: 0,
    direction: 0,
    targetDirection: 0,
    speed: 10,
    targetSpeed: 10,
    nextShift: 4,
  },
  boats: {},
};

function emptyEnv() {
  return { gusts: [], gustTimer: 3, ship: null, shipTimer: 18, reefs: [] };
}

/* 암초 랜덤 배치: 마크·스타트 라인·다른 암초와 겹치지 않는 위치를 고른다 */
function generateReefs(courseKey) {
  const reefs = [];
  const marks = courses[courseKey].marks;
  let tries = 0;
  while (reefs.length < 2 && tries < 60) {
    tries += 1;
    const candidate = { x: 280 + Math.random() * 880, y: 240 + Math.random() * 360, r: 30 + Math.random() * 10 };
    const clearOfMarks = marks.every((m) => Math.hypot(m.x - candidate.x, m.y - candidate.y) > 190);
    const clearOfReefs = reefs.every((r) => Math.hypot(r.x - candidate.x, r.y - candidate.y) > 220);
    if (clearOfMarks && clearOfReefs) reefs.push(candidate);
  }
  return reefs;
}

function createBoat(name, x, heading) {
  return {
    name,
    x,
    y: 790,
    previousY: 790,
    heading,
    speed: 0,
    trim: 0.76,
    tacking: null,
    penalty: null,
    penaltyCount: 0,
    objectContactCooldown: 0,
    agroundCooldown: 0,
    collisionFlash: 0,
    started: false,
    ocs: false,
    markIndex: 0,
    rounding: {
      markIndex: -1,
      active: false,
      lastAngle: 0,
      ccwSweep: 0,
      clockwiseSweep: 0,
      wrongWayWarned: false,
    },
    finished: false,
    finishTime: null,
  };
}

function resetRace(courseKey, sequenceLength, weatherMode) {
  game.configured = true;
  game.paused = false;
  game.phase = "prestart";
  game.courseKey = courseKey;
  game.sequenceLength = sequenceLength;
  game.weatherMode = weatherMode === "wild" ? "wild" : "standard";
  game.env = emptyEnv();
  if (game.weatherMode === "wild") {
    game.env.reefs = generateReefs(courseKey);
    game.env.shipTimer = 12 + Math.random() * 15;
  }
  const envHelp = document.getElementById("envHelp");
  if (envHelp) envHelp.hidden = game.weatherMode !== "wild";
  game.countdown = sequenceLength;
  game.elapsed = 0;
  game.simTime = 0;
  game.lastFrame = performance.now();
  game.startSignalSent = false;
  game.signalEvents.clear();
  game.bannerUntil = 0;
  game.banner = null;
  game.collisionCooldown = 0;
  game.winner = null;
  game.finishOrder = [];
  game.wind = {
    base: 0,
    direction: 0,
    targetDirection: 0,
    speed: 10,
    targetSpeed: 10,
    nextShift: 3.5,
  };
  game.boats = {
    A: createBoat("A", 610, 350),
    B: createBoat("B", 850, 10),
  };
  ui.eventLog.innerHTML = "";
  ui.courseLabel.textContent = courseName(courseKey);
  ui.pauseButton.textContent = t("gPause");
  addLog(t("gLogSeqStart", courseName(courseKey), t(sequenceLength === 300 ? "gSeqLabel300" : "gSeqLabel60")), "good");
  announce("PRE-START", formatCountdown(sequenceLength), t("gPreStartDetail"), 2.6);
  updateSignals(true);
  ensureAudio();
  beep(0.08, 580);
}

function normDeg(value) {
  return ((value % 360) + 360) % 360;
}

function shortestAngle(from, to) {
  return ((to - from + 540) % 360) - 180;
}

function degToRad(value) {
  return value * Math.PI / 180;
}

function vecFromCompass(value) {
  const rad = degToRad(value);
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

function angleDiff(a, b) {
  return Math.abs(shortestAngle(a, b));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, tt) {
  return a + (b - a) * tt;
}

function formatCountdown(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatRaceTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  const tenth = Math.floor((seconds % 1) * 10);
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}.${tenth}`;
}

function tackOf(boat) {
  const forward = vecFromCompass(boat.heading);
  const windSource = vecFromCompass(game.wind.direction);
  const cross = forward.x * windSource.y - forward.y * windSource.x;
  return cross > 0 ? "starboard" : "port";
}

function polarFactor(boat) {
  const angle = angleDiff(boat.heading, game.wind.direction);
  if (angle < 34) return 0.04;
  if (angle < 48) return lerp(0.18, 0.58, (angle - 34) / 14);
  if (angle < 90) return lerp(0.62, 0.96, (angle - 48) / 42);
  if (angle < 135) return 1;
  if (angle < 168) return lerp(1, 0.78, (angle - 135) / 33);
  return 0.68;
}

function classifyRightOfWay() {
  const a = game.boats.A;
  const b = game.boats.B;
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  const tackA = tackOf(a);
  const tackB = tackOf(b);

  if (a.penalty || b.penalty) {
    if (a.penalty && !b.penalty) {
      return {
        winner: "B", loser: "A", rule: "RRS 44",
        relation: t("gRelPenalty", "A"),
        reason: t("gReasonPenalty", "A"),
        distance,
      };
    }
    if (b.penalty && !a.penalty) {
      return {
        winner: "A", loser: "B", rule: "RRS 44",
        relation: t("gRelPenalty", "B"),
        reason: t("gReasonPenalty", "B"),
        distance,
      };
    }
  }

  if (a.tacking && b.tacking) {
    return {
      winner: null, loser: null, rule: "RRS 13",
      relation: t("gRelBothTacking"),
      reason: t("gReasonBothTacking"),
      distance,
    };
  }
  if (a.tacking) {
    return {
      winner: "B", loser: "A", rule: "RRS 13",
      relation: t("gRelTacking", "A"),
      reason: t("gReasonTacking", "A", "B"),
      distance,
    };
  }
  if (b.tacking) {
    return {
      winner: "A", loser: "B", rule: "RRS 13",
      relation: t("gRelTacking", "B"),
      reason: t("gReasonTacking", "B", "A"),
      distance,
    };
  }

  if (tackA !== tackB) {
    const winner = tackA === "starboard" ? "A" : "B";
    const loser = winner === "A" ? "B" : "A";
    return {
      winner, loser, rule: "RRS 10",
      relation: `${tackLabel(tackA)} / ${tackLabel(tackB)}`,
      reason: t("gReasonRule10", winner, loser),
      distance,
    };
  }

  const forwardA = vecFromCompass(a.heading);
  const forwardB = vecFromCompass(b.heading);
  let avg = { x: forwardA.x + forwardB.x, y: forwardA.y + forwardB.y };
  const avgLength = Math.hypot(avg.x, avg.y) || 1;
  avg = { x: avg.x / avgLength, y: avg.y / avgLength };
  const relative = { x: b.x - a.x, y: b.y - a.y };
  const along = relative.x * avg.x + relative.y * avg.y;
  const overlap = Math.abs(along) < 78;

  if (overlap) {
    const windSource = vecFromCompass(game.wind.direction);
    const downwind = { x: -windSource.x, y: -windSource.y };
    const scoreA = a.x * downwind.x + a.y * downwind.y;
    const scoreB = b.x * downwind.x + b.y * downwind.y;
    const winner = scoreA > scoreB ? "A" : "B";
    const loser = winner === "A" ? "B" : "A";
    return {
      winner, loser, rule: "RRS 11",
      relation: t("gRelOverlap", tackLabel(tackA)),
      reason: t("gReasonRule11", winner, loser),
      distance,
    };
  }

  const winner = along > 0 ? "B" : "A";
  const loser = winner === "A" ? "B" : "A";
  return {
    winner, loser, rule: "RRS 12",
    relation: t("gRelClearAstern", tackLabel(tackA)),
    reason: t("gReasonRule12", winner, loser),
    distance,
  };
}

function startTack(boat, direction) {
  if (!game.configured || game.paused || boat.finished || boat.tacking || boat.penalty) return;
  boat.tacking = {
    elapsed: 0,
    duration: 1.25,
    startHeading: boat.heading,
    targetHeading: boat.heading + direction * 92,
  };
  addLog(t("gLogTackStart", boat.name, t(direction < 0 ? "gLeft" : "gRight")));
}

function applyPenalty(boat, reason, turns = 2) {
  if (boat.penalty || boat.finished) return;
  boat.tacking = null;
  boat.penaltyCount += 1;
  boat.penalty = {
    elapsed: 0,
    duration: turns === 1 ? 3.2 : 5.2,
    startHeading: boat.heading,
    direction: boat.name === "A" ? 1 : -1,
    turns,
  };
  const label = turns === 1 ? "ONE TURN" : "TWO TURNS";
  announce("PENALTY", `${boat.name} · ${label}`, reason, 2.8);
  addLog(t("gLogPenaltyStart", boat.name, reason, turns), "warn");
  beep(0.18, 210);
}

function updateBoat(boat, controls, dt) {
  boat.previousY = boat.y;
  boat.collisionFlash = Math.max(0, boat.collisionFlash - dt);
  boat.objectContactCooldown = Math.max(0, boat.objectContactCooldown - dt);
  boat.agroundCooldown = Math.max(0, boat.agroundCooldown - dt);

  if (boat.finished) {
    boat.speed *= Math.pow(0.12, dt);
    return;
  }

  if (boat.penalty) {
    boat.penalty.elapsed += dt;
    const progress = clamp(boat.penalty.elapsed / boat.penalty.duration, 0, 1);
    boat.heading = boat.penalty.startHeading + boat.penalty.direction * 360 * boat.penalty.turns * progress;
    boat.speed += (34 - boat.speed) * Math.min(1, dt * 2.4);
    if (progress >= 1) {
      const completedTurns = boat.penalty.turns;
      boat.heading = normDeg(boat.heading);
      boat.penalty = null;
      addLog(t("gLogPenaltyDone", boat.name, completedTurns), "good");
    }
  } else if (boat.tacking) {
    boat.tacking.elapsed += dt;
    const progress = clamp(boat.tacking.elapsed / boat.tacking.duration, 0, 1);
    const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    boat.heading = lerp(boat.tacking.startHeading, boat.tacking.targetHeading, eased);
    boat.speed *= Math.pow(0.6, dt);
    if (progress >= 1) {
      boat.heading = normDeg(boat.tacking.targetHeading);
      boat.tacking = null;
      addLog(t("gLogTackDone", boat.name, tackLabel(tackOf(boat))));
    }
  } else {
    if (keys.has(controls.trimIn)) boat.trim = clamp(boat.trim + dt * .42, 0.18, 1);
    if (keys.has(controls.trimOut)) boat.trim = clamp(boat.trim - dt * .5, 0.18, 1);

    const steeringPower = .28 + clamp(boat.speed / 75, 0, 1) * .72;
    const steeringRate = 76 * steeringPower;
    if (keys.has(controls.left)) boat.heading -= steeringRate * dt;
    if (keys.has(controls.right)) boat.heading += steeringRate * dt;
  }

  const sailFactor = polarFactor(boat);
  const penaltyFactor = boat.penalty ? .34 : 1;
  const trimFactor = .16 + boat.trim * .84;
  const targetSpeed = game.wind.speed * 11.4 * sailFactor * trimFactor * penaltyFactor * envSpeedFactor(boat);
  const response = targetSpeed > boat.speed ? 1.3 : 2.1;
  boat.speed += (targetSpeed - boat.speed) * Math.min(1, dt * response);

  const forward = vecFromCompass(boat.heading);
  boat.x += forward.x * boat.speed * dt;
  boat.y += forward.y * boat.speed * dt;

  if (boat.x < 30 || boat.x > WIDTH - 30) {
    boat.x = clamp(boat.x, 30, WIDTH - 30);
    boat.heading = normDeg(360 - boat.heading);
    boat.speed *= .55;
  }
  if (boat.y < 30 || boat.y > HEIGHT - 30) {
    boat.y = clamp(boat.y, 30, HEIGHT - 30);
    boat.heading = normDeg(180 - boat.heading);
    boat.speed *= .55;
  }

  updateCourseProgress(boat);
}

function resetRounding(boat) {
  boat.rounding = {
    markIndex: boat.markIndex,
    active: false,
    lastAngle: 0,
    ccwSweep: 0,
    clockwiseSweep: 0,
    wrongWayWarned: false,
  };
}

function signedRadianDelta(next, previous) {
  let delta = next - previous;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function updateMarkRounding(boat, mark) {
  const dx = boat.x - mark.x;
  const dy = boat.y - mark.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  if (boat.rounding.markIndex !== boat.markIndex) resetRounding(boat);
  const rounding = boat.rounding;

  if (!rounding.active && distance <= MARK_ROUNDING_RADIUS) {
    rounding.active = true;
    rounding.lastAngle = angle;
    rounding.ccwSweep = 0;
    rounding.clockwiseSweep = 0;
    rounding.wrongWayWarned = false;
    addLog(t("gLogRoundStart", boat.name, markName(mark)));
    return false;
  }

  if (!rounding.active) return false;

  const delta = signedRadianDelta(angle, rounding.lastAngle);
  rounding.lastAngle = angle;

  // Canvas Y grows downward, so a negative angle delta is CCW on screen.
  if (delta < 0) rounding.ccwSweep += -delta;
  else rounding.clockwiseSweep += delta;

  if (
    rounding.clockwiseSweep > degToRad(38) &&
    rounding.clockwiseSweep > rounding.ccwSweep &&
    !rounding.wrongWayWarned
  ) {
    rounding.wrongWayWarned = true;
    announce("WRONG WAY", t("gWrongWayBanner", boat.name), t("gWrongWayDetail", markName(mark)), 2.2);
    addLog(t("gLogWrongWay", boat.name, markName(mark)), "warn");
  }

  if (distance > MARK_ROUNDING_RADIUS + 16) {
    const valid =
      rounding.ccwSweep >= REQUIRED_CCW_SWEEP &&
      rounding.ccwSweep > rounding.clockwiseSweep * 1.2;

    if (valid) {
      boat.markIndex += 1;
      resetRounding(boat);
      addLog(t("gLogRoundDone", boat.name, markName(mark)), "good");
      announce("MARK", `${boat.name} · ${markName(mark)} ↺`, nextTargetLabel(boat), 1.7);
      beep(0.06, 820);
      return true;
    }

    addLog(t("gLogRoundRetry", boat.name, markName(mark)), "warn");
    resetRounding(boat);
  }

  return false;
}

function updateCourseProgress(boat) {
  if (game.phase === "prestart") return;

  const crossedNorth = boat.previousY >= START_Y && boat.y < START_Y;
  const crossedSouth = boat.previousY <= START_Y && boat.y > START_Y;
  const insideLine = boat.x >= START_LEFT && boat.x <= START_RIGHT;

  if (!boat.started) {
    if (boat.ocs) {
      if (boat.y > START_Y + 20) {
        boat.ocs = false;
        addLog(t("gLogOcsBack", boat.name), "good");
      }
      return;
    }
    if (crossedNorth && insideLine) {
      boat.started = true;
      addLog(t("gLogStarted", boat.name), "good");
      beep(0.06, boat.name === "A" ? 650 : 760);
    }
    return;
  }

  const marks = courses[game.courseKey].marks;
  if (boat.markIndex < marks.length) {
    const mark = marks[boat.markIndex];
    updateMarkRounding(boat, mark);
    return;
  }

  if (crossedSouth && insideLine) {
    boat.finished = true;
    boat.finishTime = game.elapsed;
    game.finishOrder.push(boat.name);
    if (!game.winner) game.winner = boat.name;
    addLog(t("gLogFinish", boat.name, formatRaceTime(boat.finishTime)), "good");
    window.dispatchEvent(new CustomEvent("dinghy:race-finish", {
      detail: {
        player: boat.name,
        place: game.finishOrder.length,
        course: game.courseKey,
        finish_seconds: Number(boat.finishTime.toFixed(1)),
      },
    }));
    announce(
      game.finishOrder.length === 1 ? "WINNER" : "FINISH",
      `PLAYER ${boat.name}`,
      formatRaceTime(boat.finishTime),
      4
    );
    beep(0.12, 920);
    setTimeout(() => beep(0.12, 1120), 150);
    if (game.finishOrder.length === 2) game.phase = "finished";
  }
}

function updateWind(dt) {
  const wind = game.wind;
  const wild = game.weatherMode === "wild";
  wind.nextShift -= dt;
  if (wild) wind.base += (Math.random() - 0.5) * dt * 6; // 기준 풍향 자체가 서서히 흘러간다
  if (wind.nextShift <= 0) {
    const swing = wild ? 45 : 20;
    wind.targetDirection = wind.base + (Math.random() * swing * 2 - swing);
    wind.targetSpeed = wild ? 7 + Math.random() * 10 : 8 + Math.random() * 6;
    wind.nextShift = wild ? 2 + Math.random() * 2.5 : 3.5 + Math.random() * 4.5;
  }
  wind.direction += shortestAngle(wind.direction, wind.targetDirection) * Math.min(1, dt * (wild ? .22 : .16));
  wind.speed += (wind.targetSpeed - wind.speed) * Math.min(1, dt * .11);
}

/* ───────── 변화무쌍 모드: 거스트·대형선·암초·해안 바람 ───────── */

function updateEnvironment(dt) {
  if (game.weatherMode !== "wild") return;
  const env = game.env;

  // 거스트(가속)와 럴(감속) 패치 — 랜덤 생성 후 바람 방향으로 흘러간다
  env.gustTimer -= dt;
  if (env.gustTimer <= 0 && env.gusts.length < 6) {
    const isLull = Math.random() < 0.35;
    env.gusts.push({
      x: 80 + Math.random() * (WIDTH - 160),
      y: 60 + Math.random() * (HEIGHT - 220),
      r: 90 + Math.random() * 80,
      strength: isLull ? 0.55 + Math.random() * 0.15 : 1.35 + Math.random() * 0.35,
      age: 0,
      life: 7 + Math.random() * 6,
    });
    env.gustTimer = 2.5 + Math.random() * 3.5;
  }
  const downwind = vecFromCompass(game.wind.direction + 180);
  for (const g of env.gusts) {
    g.age += dt;
    g.x += downwind.x * dt * (20 + game.wind.speed * 2);
    g.y += downwind.y * dt * (20 + game.wind.speed * 2);
  }
  env.gusts = env.gusts.filter((g) => g.age < g.life && g.x > -220 && g.x < WIDTH + 220 && g.y > -220 && g.y < HEIGHT + 220);

  // 대형선이 코스를 가로지른다
  env.shipTimer -= dt;
  if (!env.ship && env.shipTimer <= 0) {
    const fromLeft = Math.random() < 0.5;
    env.ship = {
      x: fromLeft ? -160 : WIDTH + 160,
      y: 200 + Math.random() * 380,
      dir: fromLeft ? 1 : -1,
      speed: 95 + Math.random() * 45,
      len: 190,
      beam: 46,
    };
    announce("BIG SHIP", t("gShipBanner"), t("gShipDetail"), 3);
    addLog(t("gLogShipSpawn"), "warn");
    beep(0.3, 180);
  }
  if (env.ship) {
    env.ship.x += env.ship.dir * env.ship.speed * dt;
    if (env.ship.x < -240 || env.ship.x > WIDTH + 240) {
      env.ship = null;
      env.shipTimer = 22 + Math.random() * 26;
    }
  }

  resolveEnvCollisions();
}

function resolveEnvCollisions() {
  const env = game.env;
  for (const boat of Object.values(game.boats)) {
    if (boat.finished) continue;

    if (env.ship && boat.objectContactCooldown <= 0) {
      const s = env.ship;
      const cx = clamp(boat.x, s.x - s.len / 2, s.x + s.len / 2);
      const dx = boat.x - cx;
      const dy = boat.y - s.y;
      const dist = Math.hypot(dx, dy);
      const min = BOAT_RADIUS + s.beam / 2;
      if (dist < min) {
        const nx = dist ? dx / dist : 0;
        const ny = dist ? dy / dist : -1;
        boat.x += nx * (min - dist + 8);
        boat.y += ny * (min - dist + 8);
        boat.speed *= 0.2;
        boat.collisionFlash = 1;
        boat.objectContactCooldown = 2.4;
        applyPenalty(boat, t("gLogShipHit"), 1);
      }
    }

    if (boat.agroundCooldown <= 0) {
      for (const reef of env.reefs) {
        const d = Math.hypot(boat.x - reef.x, boat.y - reef.y);
        if (d < BOAT_RADIUS + reef.r) {
          const nx = (boat.x - reef.x) / (d || 1);
          const ny = (boat.y - reef.y) / (d || 1);
          boat.x = reef.x + nx * (BOAT_RADIUS + reef.r + 6);
          boat.y = reef.y + ny * (BOAT_RADIUS + reef.r + 6);
          boat.speed *= 0.12;
          boat.collisionFlash = 1;
          boat.agroundCooldown = 2.5;
          addLog(t("gLogAground", boat.name), "warn");
          beep(0.22, 140);
          break;
        }
      }
    }
  }
}

/* 보트 위치에 따른 국소 바람 배율: 거스트/럴 × 해안 바람 그늘 × 대형선 바람 그늘 */
function envSpeedFactor(boat) {
  if (game.weatherMode !== "wild") return 1;
  let factor = 1;

  let gustEffect = 1;
  for (const g of game.env.gusts) {
    if (Math.hypot(boat.x - g.x, boat.y - g.y) < g.r) {
      if (Math.abs(g.strength - 1) > Math.abs(gustEffect - 1)) gustEffect = g.strength;
    }
  }
  factor *= gustEffect;

  // 해안(왼쪽) 근처는 육지에 깨진 바람, 먼바다(오른쪽)는 해풍 이득
  if (boat.x < SHORE_W + 140) {
    factor *= 0.62 + 0.33 * clamp((boat.x - SHORE_W) / 140, 0, 1);
  } else if (boat.x > WIDTH * 0.72) {
    factor *= 1.1;
  }

  const ship = game.env.ship;
  if (ship) {
    const down = vecFromCompass(game.wind.direction + 180);
    const rx = boat.x - ship.x;
    const ry = boat.y - ship.y;
    const along = rx * down.x + ry * down.y;
    const perp = Math.abs(rx * -down.y + ry * down.x);
    if (along > 0 && along < 300 && perp < ship.len * 0.45) factor *= 0.45;
  }

  return clamp(factor, 0.25, 1.9);
}

function updateStartSequence(dt) {
  if (game.phase !== "prestart") return;
  const previous = game.countdown;
  game.countdown = Math.max(0, game.countdown - dt);
  updateSignalCrossings(previous, game.countdown);
  if (game.countdown <= 0 && !game.startSignalSent) startRace();
}

function updateSignalCrossings(previous, current) {
  const sequence = game.sequenceLength;
  const thresholds = sequence === 300
    ? [
        { at: 300, key: "warning", title: "WARNING", detail: t("gSig300Warning") },
        { at: 240, key: "prep", title: "PREPARATORY", detail: t("gSig300Prep") },
        { at: 60, key: "one", title: "ONE MINUTE", detail: t("gSig300One") },
      ]
    : [
        { at: 60, key: "warning", title: "WARNING", detail: t("gSig60Warning") },
        { at: 45, key: "prep", title: "PREPARATORY", detail: t("gSig60Prep") },
        { at: 15, key: "one", title: "FINAL", detail: t("gSig60Final") },
      ];

  for (const signal of thresholds) {
    if (!game.signalEvents.has(signal.key) && previous >= signal.at && current <= signal.at) {
      game.signalEvents.add(signal.key);
      announce("RACE SIGNAL", signal.title, signal.detail, 2);
      addLog(signal.detail);
      beep(signal.key === "one" ? .2 : .09, signal.key === "one" ? 430 : 610);
    }
  }
}

function startRace() {
  game.startSignalSent = true;
  game.phase = "racing";
  game.elapsed = 0;
  for (const boat of Object.values(game.boats)) {
    if (boat.y < START_Y - 2 && boat.x > START_LEFT - 100 && boat.x < START_RIGHT + 100) {
      boat.ocs = true;
      addLog(t("gLogOcs", boat.name), "warn");
    }
  }
  announce("RACE SIGNAL", "START", t("gStartDetail"), 2.6);
  addLog(t("gLogStartSignal"), "good");
  window.dispatchEvent(new CustomEvent("dinghy:race-start", {
    detail: {
      course: game.courseKey,
      sequence_seconds: game.sequenceLength,
    },
  }));
  beep(.12, 760);
  setTimeout(() => beep(.16, 760), 160);
}

function detectCollision(dt) {
  game.collisionCooldown = Math.max(0, game.collisionCooldown - dt);
  if (game.collisionCooldown > 0 || !game.configured) return;

  const a = game.boats.A;
  const b = game.boats.B;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= BOAT_RADIUS * 1.65) return;

  const decision = classifyRightOfWay();
  const nx = distance ? dx / distance : 1;
  const ny = distance ? dy / distance : 0;
  const push = BOAT_RADIUS * 1.7 - distance;
  a.x -= nx * push * .5;
  a.y -= ny * push * .5;
  b.x += nx * push * .5;
  b.y += ny * push * .5;
  a.speed *= .45;
  b.speed *= .45;
  a.collisionFlash = 1;
  b.collisionFlash = 1;
  game.collisionCooldown = 2.2;

  if (decision.loser) {
    applyPenalty(game.boats[decision.loser], `${decision.rule}: ${decision.relation}`);
  } else {
    applyPenalty(a, t("gCollisionNoRow"));
    applyPenalty(b, t("gCollisionNoRow"));
  }
}

function resolveCourseObjectContact(boat, object, radius, label) {
  if (boat.finished || boat.objectContactCooldown > 0) return false;

  const dx = boat.x - object.x;
  const dy = boat.y - object.y;
  const distance = Math.hypot(dx, dy);
  const minimumDistance = BOAT_RADIUS + radius;
  if (distance >= minimumDistance) return false;

  const nx = distance ? dx / distance : 0;
  const ny = distance ? dy / distance : 1;
  const push = minimumDistance - distance + 5;
  boat.x += nx * push;
  boat.y += ny * push;
  boat.speed *= .28;
  boat.collisionFlash = 1;
  boat.objectContactCooldown = 2.1;
  applyPenalty(boat, t("gContactPenalty", label), 1);
  return true;
}

function detectCourseObjectCollisions() {
  const marks = courses[game.courseKey].marks;
  for (const boat of Object.values(game.boats)) {
    if (resolveCourseObjectContact(boat, { x: RC_X, y: RC_Y }, RC_HIT_RADIUS, t("gRcBoat"))) continue;
    if (resolveCourseObjectContact(boat, { x: PIN_X, y: PIN_Y }, PIN_HIT_RADIUS, t("gStartPin"))) continue;

    for (const mark of marks) {
      if (resolveCourseObjectContact(boat, mark, MARK_BODY_RADIUS, markName(mark))) break;
    }
  }
}

function nextTargetLabel(boat) {
  if (boat.finished) return "FINISHED";
  if (!boat.started) return boat.ocs ? t("gTargetOcs") : "START";
  const marks = courses[game.courseKey].marks;
  if (boat.markIndex < marks.length && boat.rounding.active) {
    const progress = clamp(boat.rounding.ccwSweep / REQUIRED_CCW_SWEEP, 0, 1);
    return `${markName(marks[boat.markIndex])} ↺ ${Math.round(progress * 100)}%`;
  }
  return boat.markIndex < marks.length ? markName(marks[boat.markIndex]) : "FINISH";
}

function progressValue(boat) {
  const marks = courses[game.courseKey].marks;
  if (boat.finished) return 1;
  if (!boat.started) return 0;
  const totalLegs = marks.length + 1;
  if (boat.markIndex >= marks.length) {
    const distance = Math.abs(boat.y - START_Y);
    return clamp((marks.length + 1 - distance / 520) / totalLegs, marks.length / totalLegs, .99);
  }
  const previous = boat.markIndex === 0
    ? { x: (START_LEFT + START_RIGHT) / 2, y: START_Y }
    : marks[boat.markIndex - 1];
  const target = marks[boat.markIndex];
  const fullDistance = Math.hypot(target.x - previous.x, target.y - previous.y) || 1;
  const remaining = Math.hypot(target.x - boat.x, target.y - boat.y);
  const legProgress = clamp(1 - remaining / fullDistance, 0, .98);
  return (boat.markIndex + legProgress) / totalLegs;
}

function update(dt) {
  if (!game.configured || game.paused) return;
  game.simTime += dt;
  updateWind(dt);
  updateEnvironment(dt);
  updateStartSequence(dt);
  if (game.phase === "racing" || game.phase === "finished") game.elapsed += dt;

  updateBoat(game.boats.A, {
    trimIn: "KeyW", trimOut: "KeyS", left: "KeyA", right: "KeyD",
  }, dt);
  updateBoat(game.boats.B, {
    trimIn: "ArrowUp", trimOut: "ArrowDown", left: "ArrowLeft", right: "ArrowRight",
  }, dt);
  detectCourseObjectCollisions();
  detectCollision(dt);
}

function drawWater() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#dff7fb");
  gradient.addColorStop(1, "#acdfe8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.lineWidth = 2;
  for (let y = 45; y < HEIGHT; y += 56) {
    ctx.strokeStyle = `rgba(255,255,255,${.3 + (y % 3) * .02})`;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 16) {
      const wave = y + Math.sin((x + y + game.simTime * 24) / 39) * 4;
      if (x === 0) ctx.moveTo(x, wave);
      else ctx.lineTo(x, wave);
    }
    ctx.stroke();
  }

  const windVector = vecFromCompass(game.wind.direction);
  ctx.strokeStyle = "rgba(40,121,208,.16)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i += 1) {
    const seedX = (i * 83 + game.simTime * game.wind.speed * 5) % (WIDTH + 160) - 80;
    const seedY = 50 + ((i * 117) % (HEIGHT - 100));
    ctx.beginPath();
    ctx.moveTo(seedX + windVector.x * 30, seedY + windVector.y * 30);
    ctx.lineTo(seedX - windVector.x * 30, seedY - windVector.y * 30);
    ctx.stroke();
  }
}

function drawCourse() {
  const marks = courses[game.courseKey].marks;
  ctx.save();
  ctx.strokeStyle = "rgba(11,71,81,.22)";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 12]);
  ctx.beginPath();
  ctx.moveTo((START_LEFT + START_RIGHT) / 2, START_Y);
  marks.forEach((mark) => ctx.lineTo(mark.x, mark.y));
  ctx.lineTo((START_LEFT + START_RIGHT) / 2, START_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  drawStartLine();
  marks.forEach((mark, index) => drawMark(mark, index + 1));
  ctx.restore();
}

function drawStartLine() {
  const segment = 20;
  for (let x = START_LEFT; x < START_RIGHT; x += segment) {
    ctx.fillStyle = ((x - START_LEFT) / segment) % 2 === 0 ? "#ffffff" : "#173238";
    ctx.fillRect(x, START_Y - 4, segment, 8);
  }
  ctx.strokeStyle = "rgba(23,50,56,.45)";
  ctx.strokeRect(START_LEFT, START_Y - 4, START_RIGHT - START_LEFT, 8);

  drawPin(PIN_X, PIN_Y, "PIN");
  drawCommitteeBoat(RC_X, RC_Y);

  ctx.fillStyle = "rgba(11,71,81,.82)";
  ctx.font = "900 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(game.phase === "prestart" ? "START LINE · PRE-START" : "START / FINISH", (START_LEFT + START_RIGHT) / 2, START_Y + 23);
}

function drawPin(x, y, label) {
  ctx.fillStyle = "#f0b84e";
  ctx.strokeStyle = "#6b4a00";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6b4a00";
  ctx.font = "900 10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y + 28);
}

function drawCommitteeBoat(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#173238";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-28, -9);
  ctx.lineTo(29, -9);
  ctx.lineTo(19, 13);
  ctx.lineTo(-18, 13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(0, -47);
  ctx.stroke();
  ctx.fillStyle = "#2879d0";
  ctx.fillRect(2, -44, 24, 15);
  ctx.fillStyle = "#173238";
  ctx.font = "950 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RC", 0, 5);
  ctx.restore();
}

function drawMark(mark, number) {
  ctx.save();
  ctx.translate(mark.x, mark.y);
  ctx.fillStyle = "rgba(240,184,78,.13)";
  ctx.strokeStyle = "rgba(240,184,78,.48)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.arc(0, 0, MARK_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = mark.color;
  ctx.strokeStyle = "#6b4a00";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(15, 18);
  ctx.lineTo(-15, 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6b4a00";
  ctx.font = "950 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(number), 0, 7);
  ctx.fillStyle = "#0b4751";
  ctx.font = "850 11px sans-serif";
  ctx.fillText(markName(mark), 0, 38);

  ctx.strokeStyle = "rgba(11,111,127,.82)";
  ctx.fillStyle = "rgba(11,111,127,.82)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, MARK_ROUNDING_RADIUS - 8, degToRad(25), degToRad(300), true);
  ctx.stroke();
  const arrowAngle = degToRad(300);
  const arrowX = Math.cos(arrowAngle) * (MARK_ROUNDING_RADIUS - 8);
  const arrowY = Math.sin(arrowAngle) * (MARK_ROUNDING_RADIUS - 8);
  ctx.save();
  ctx.translate(arrowX, arrowY);
  ctx.rotate(arrowAngle - Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, -12);
  ctx.lineTo(8, -12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#0b6f7f";
  ctx.font = "950 11px sans-serif";
  ctx.fillText("↺ CCW", 0, -MARK_ROUNDING_RADIUS + 18);
  ctx.restore();
}

function drawShore() {
  if (game.weatherMode !== "wild") return;
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, SHORE_W + 70, 0);
  grad.addColorStop(0, "#e8d9a8");
  grad.addColorStop(0.55, "#dfe9c9");
  grad.addColorStop(1, "rgba(223,233,201,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SHORE_W + 70, HEIGHT);
  ctx.fillStyle = "rgba(255,255,255,.5)";
  for (let y = 12; y < HEIGHT; y += 34) {
    ctx.beginPath();
    ctx.arc(SHORE_W + Math.sin(y / 30 + game.simTime) * 6, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(11,71,81,.6)";
  ctx.font = "950 11px sans-serif";
  ctx.save();
  ctx.translate(16, HEIGHT / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("SHORE · LIGHT AIR", 0, 0);
  ctx.restore();
  ctx.restore();
}

function drawGusts() {
  if (game.weatherMode !== "wild") return;
  for (const g of game.env.gusts) {
    const fade = Math.max(0, Math.min(1, g.age / 1.2, (g.life - g.age) / 1.5));
    const dark = g.strength > 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = dark ? "rgba(23,94,138,.22)" : "rgba(255,255,255,.34)";
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, g.r, g.r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark ? "rgba(23,94,138,.32)" : "rgba(255,255,255,.42)";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = dark ? "rgba(9,60,92,.8)" : "rgba(90,130,140,.85)";
    ctx.font = "950 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(dark ? "GUST +" : "LULL −", g.x, g.y + 4);
    ctx.restore();
  }
}

function drawReefs() {
  for (const reef of game.env.reefs) {
    ctx.save();
    ctx.translate(reef.x, reef.y);
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = "rgba(90,110,120,.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, reef.r + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#7d8a90";
    ctx.strokeStyle = "#4c585e";
    [[-12, 2, 13], [8, -6, 10], [10, 10, 9], [-2, -12, 8]].forEach(([ox, oy, r]) => {
      ctx.beginPath();
      ctx.moveTo(ox - r, oy + r * 0.6);
      ctx.lineTo(ox, oy - r);
      ctx.lineTo(ox + r, oy + r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    ctx.fillStyle = "rgba(255,255,255,.7)";
    for (let i = 0; i < 3; i += 1) {
      const a = game.simTime * 1.4 + i * 2.1;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (reef.r + 4), Math.sin(a) * (reef.r + 4) * 0.8, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#3f4c52";
    ctx.font = "950 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t("gReefLabel"), 0, reef.r + 24);
    ctx.restore();
  }
}

function drawShip() {
  const s = game.env.ship;
  if (!s) return;

  // 배 뒤로 드리우는 바람 그늘
  const down = vecFromCompass(game.wind.direction + 180);
  const px = -down.y;
  const py = down.x;
  const hw = s.len * 0.45;
  ctx.save();
  ctx.fillStyle = "rgba(60,90,110,.12)";
  ctx.beginPath();
  ctx.moveTo(s.x + px * hw, s.y + py * hw);
  ctx.lineTo(s.x - px * hw, s.y - py * hw);
  ctx.lineTo(s.x - px * hw * 0.7 + down.x * 300, s.y - py * hw * 0.7 + down.y * 300);
  ctx.lineTo(s.x + px * hw * 0.7 + down.x * 300, s.y + py * hw * 0.7 + down.y * 300);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(s.dir, 1);
  ctx.shadowColor = "rgba(0,0,0,.25)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 7;
  ctx.fillStyle = "#5f6d76";
  ctx.strokeStyle = "#2f3b42";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-s.len / 2, -s.beam / 2);
  ctx.lineTo(s.len / 2 - 34, -s.beam / 2);
  ctx.lineTo(s.len / 2, 0);
  ctx.lineTo(s.len / 2 - 34, s.beam / 2);
  ctx.lineTo(-s.len / 2, s.beam / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#d8dee2";
  ctx.fillRect(-s.len / 2 + 12, -s.beam / 2 + 8, 34, s.beam - 16);
  ctx.fillStyle = "#c25b4e";
  ctx.fillRect(-s.len / 2 + 54, -s.beam / 2 + 7, 26, 14);
  ctx.fillStyle = "#3d6e9e";
  ctx.fillRect(-s.len / 2 + 84, -s.beam / 2 + 7, 26, 14);
  ctx.scale(s.dir, 1);
  ctx.fillStyle = "#ffffff";
  ctx.font = "950 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SHIP", 0, s.beam / 2 - 6);
  ctx.restore();
}

function drawWindIndicator() {
  const source = vecFromCompass(game.wind.direction);
  const x = 85;
  const y = 88;
  const start = { x: x + source.x * 42, y: y + source.y * 42 };
  const end = { x: x - source.x * 42, y: y - source.y * 42 };
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.88)";
  ctx.strokeStyle = "rgba(11,71,81,.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(18, 18, 168, 140, 10);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#2879d0";
  ctx.fillStyle = "#2879d0";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - Math.cos(angle - .55) * 18, end.y - Math.sin(angle - .55) * 18);
  ctx.lineTo(end.x - Math.cos(angle + .55) * 18, end.y - Math.sin(angle + .55) * 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0b4751";
  ctx.textAlign = "center";
  ctx.font = "950 12px sans-serif";
  ctx.fillText("WIND FROM", 102, 40);
  ctx.font = "950 15px sans-serif";
  ctx.fillText(`${String(Math.round(normDeg(game.wind.direction))).padStart(3, "0")}° · ${game.wind.speed.toFixed(1)} kn`, 102, 137);
  ctx.restore();
}

function drawTargetLine(boat) {
  if (!boat.started || boat.finished) return;
  const marks = courses[game.courseKey].marks;
  const target = boat.markIndex < marks.length
    ? marks[boat.markIndex]
    : { x: (START_LEFT + START_RIGHT) / 2, y: START_Y };
  ctx.save();
  ctx.strokeStyle = boat.name === "A" ? "rgba(238,113,95,.48)" : "rgba(40,121,208,.48)";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 9]);
  ctx.beginPath();
  ctx.moveTo(boat.x, boat.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.restore();
}

function boatDisplayColor(name, decision) {
  const boat = game.boats[name];
  if (boat.penalty || boat.tacking) return "#f0b84e";
  if (decision.distance <= INTERACTION_RANGE) {
    if (decision.winner === name) return "#1f9d69";
    if (decision.loser === name) return "#d74f45";
  }
  return TEAM_COLORS[name];
}

function drawBoat(boat, decision) {
  const color = boatDisplayColor(boat.name, decision);
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate(degToRad(boat.heading));

  if (boat.collisionFlash > 0) {
    ctx.fillStyle = `rgba(215,79,69,${boat.collisionFlash * .25})`;
    ctx.beginPath();
    ctx.arc(0, 0, 38 + boat.collisionFlash * 12, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowColor = "rgba(0,0,0,.2)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = color;
  ctx.strokeStyle = "#173238";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(17, 18);
  ctx.quadraticCurveTo(0, 27, -17, 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = "transparent";

  ctx.fillStyle = TEAM_COLORS[boat.name];
  ctx.beginPath();
  ctx.moveTo(0, -21);
  ctx.lineTo(6, 14);
  ctx.lineTo(-6, 14);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#173238";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(0, 16);
  ctx.stroke();
  const sailSide = tackOf(boat) === "starboard" ? -1 : 1;
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.quadraticCurveTo(18 * sailSide, 0, 23 * sailSide, 16);
  ctx.lineTo(0, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.rotate(-degToRad(boat.heading));
  ctx.fillStyle = "#173238";
  ctx.font = "950 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(boat.name, 0, 5);
  ctx.restore();

  if (boat.ocs || boat.penalty || boat.tacking) {
    const status = boat.ocs ? "OCS" : boat.penalty ? `${boat.penalty.turns}-TURN${boat.penalty.turns > 1 ? "S" : ""}` : "TACKING";
    ctx.save();
    ctx.fillStyle = boat.ocs ? "#d74f45" : "#fff8e2";
    ctx.strokeStyle = boat.ocs ? "#8d231d" : "#f0b84e";
    ctx.lineWidth = 2;
    ctx.font = "950 11px sans-serif";
    const width = ctx.measureText(status).width + 18;
    ctx.beginPath();
    ctx.roundRect(boat.x - width / 2, boat.y + 34, width, 23, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = boat.ocs ? "#ffffff" : "#704f00";
    ctx.textAlign = "center";
    ctx.fillText(status, boat.x, boat.y + 49);
    ctx.restore();
  }
}

function drawRightOfWayLink(decision) {
  if (decision.distance > INTERACTION_RANGE) return;
  const a = game.boats.A;
  const b = game.boats.B;
  ctx.save();
  ctx.strokeStyle = "rgba(11,71,81,.42)";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.strokeStyle = "rgba(11,71,81,.24)";
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  ctx.beginPath();
  ctx.roundRect(midX - 52, midY - 15, 104, 30, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#0b4751";
  ctx.font = "950 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${decision.rule} · ${decision.winner ? `${decision.winner} ROW` : "CAUTION"}`, midX, midY + 4);
  ctx.restore();
}

function drawFinishSummary() {
  if (!game.winner) return;
  ctx.save();
  ctx.fillStyle = "rgba(5,39,46,.84)";
  ctx.beginPath();
  ctx.roundRect(25, HEIGHT - 106, 240, 78, 9);
  ctx.fill();
  ctx.fillStyle = "#f0b84e";
  ctx.font = "950 11px sans-serif";
  ctx.fillText("CURRENT WINNER", 42, HEIGHT - 79);
  ctx.fillStyle = "#ffffff";
  ctx.font = "950 24px sans-serif";
  ctx.fillText(`PLAYER ${game.winner}`, 42, HEIGHT - 48);
  ctx.restore();
}

function draw() {
  const decision = classifyRightOfWay();
  drawWater();
  drawShore();
  drawGusts();
  drawCourse();
  drawReefs();
  drawTargetLine(game.boats.A);
  drawTargetLine(game.boats.B);
  drawRightOfWayLink(decision);
  drawBoat(game.boats.A, decision);
  drawBoat(game.boats.B, decision);
  drawShip();
  drawWindIndicator();
  drawFinishSummary();
  updateDashboard(decision);
}

function updateDashboard(decision) {
  ui.windReadout.textContent = `${String(Math.round(normDeg(game.wind.direction))).padStart(3, "0")}° · ${game.wind.speed.toFixed(1)} kn`;
  ui.raceTime.textContent = formatRaceTime(game.elapsed);
  ui.raceStatus.textContent = game.paused
    ? (game.configured ? t("gStatusPaused") : t("gStatusSetup"))
    : game.phase === "prestart"
      ? `START -${formatCountdown(game.countdown)}`
      : game.phase === "finished"
        ? t("gStatusFinished")
        : game.phase === "racing"
          ? t("gStatusRacing")
          : t("gStatusSetup");

  if (decision.distance > INTERACTION_RANGE) {
    ui.decisionWinner.textContent = t("gDecisionSafe");
    ui.decisionRule.textContent = t("gDecisionWatch");
    ui.decisionReason.textContent = t("gDecisionSafeReason");
  } else {
    ui.decisionWinner.textContent = decision.winner ? t("gDecisionWinner", decision.winner) : t("gDecisionCaution");
    ui.decisionRule.textContent = `${decision.rule} · ${decision.relation}`;
    ui.decisionReason.textContent = decision.reason;
  }

  const a = game.boats.A;
  const b = game.boats.B;
  const progressA = progressValue(a);
  const progressB = progressValue(b);
  ui.aProgress.style.width = `${progressA * 100}%`;
  ui.bProgress.style.width = `${progressB * 100}%`;
  ui.aTarget.textContent = nextTargetLabel(a);
  ui.bTarget.textContent = nextTargetLabel(b);
  ui.aState.textContent = `${(a.speed / 11.4).toFixed(1)} kn · ${tackLabel(tackOf(a))}`;
  ui.bState.textContent = `${(b.speed / 11.4).toFixed(1)} kn · ${tackLabel(tackOf(b))}`;
  ui.aPenalty.textContent = penaltyLabel(a);
  ui.bPenalty.textContent = penaltyLabel(b);

  const order = [a, b].sort((first, second) => {
    if (first.finished && second.finished) return first.finishTime - second.finishTime;
    if (first.finished) return -1;
    if (second.finished) return 1;
    return progressValue(second) - progressValue(first);
  });
  ui.aPlace.textContent = a.finished ? t("gPlace", game.finishOrder.indexOf("A") + 1) : t("gPlace", order.indexOf(a) + 1);
  ui.bPlace.textContent = b.finished ? t("gPlace", game.finishOrder.indexOf("B") + 1) : t("gPlace", order.indexOf(b) + 1);
  updateSignals(false);

  if (game.banner && game.simTime < game.bannerUntil) {
    ui.centerMessage.hidden = false;
    ui.centerEyebrow.textContent = game.banner.eyebrow;
    ui.centerTitle.textContent = game.banner.title;
    ui.centerDetail.textContent = game.banner.detail;
  } else {
    ui.centerMessage.hidden = true;
  }
}

function penaltyLabel(boat) {
  if (boat.penalty) {
    const turns = clamp(boat.penalty.elapsed / boat.penalty.duration * boat.penalty.turns, 0, boat.penalty.turns);
    return t("gPenaltyProgress", turns.toFixed(1), boat.penalty.turns);
  }
  return boat.penaltyCount ? t("gPenaltyDoneCount", boat.penaltyCount) : t("gPenaltyNone");
}

function updateSignals(force) {
  if (!game.configured) {
    ui.signalCountdown.textContent = "--:--";
    ui.signalTitle.textContent = t("gSetupTitle");
    ui.signalDetail.textContent = t("gSetupLead");
    return;
  }

  if (game.phase !== "prestart") {
    ui.signalCountdown.textContent = game.phase === "finished" ? "FINISH" : "START";
    ui.signalTitle.textContent = game.phase === "finished" ? t("gSignalOverTitle") : t("gSignalRacingTitle");
    ui.signalDetail.textContent = game.winner ? t("gSignalLeader", game.winner) : t("gSignalFollow");
    ui.classFlag.classList.remove("up");
    ui.prepFlag.classList.remove("up");
    return;
  }

  ui.signalCountdown.textContent = formatCountdown(game.countdown);
  const prepAt = game.sequenceLength === 300 ? 240 : 45;
  const downAt = game.sequenceLength === 300 ? 60 : 15;
  ui.classFlag.classList.add("up");
  ui.prepFlag.classList.toggle("up", game.countdown <= prepAt && game.countdown > downAt);

  if (game.countdown > prepAt) {
    ui.signalTitle.textContent = t("gSigWarnTitle");
    ui.signalDetail.textContent = t("gSigWarnDetail", formatCountdown(game.countdown));
  } else if (game.countdown > downAt) {
    ui.signalTitle.textContent = t("gSigPrepTitle");
    ui.signalDetail.textContent = t("gSigPrepDetail", formatCountdown(game.countdown));
  } else {
    ui.signalTitle.textContent = t("gSigFinalTitle");
    ui.signalDetail.textContent = t("gSigFinalDetail", formatCountdown(game.countdown));
  }

  if (force) {
    game.signalEvents.add("warning");
  }
}

function announce(eyebrow, title, detail, duration) {
  game.banner = { eyebrow, title, detail };
  game.bannerUntil = game.simTime + duration;
}

function addLog(message, tone = "") {
  const item = document.createElement("li");
  if (tone) item.className = tone;
  const time = document.createElement("time");
  const body = document.createElement("span");
  time.textContent = game.phase === "prestart"
    ? `START -${formatCountdown(game.countdown)}`
    : formatRaceTime(game.elapsed);
  body.textContent = message;
  item.append(time, body);
  ui.eventLog.prepend(item);
  while (ui.eventLog.children.length > 18) ui.eventLog.lastElementChild.remove();
}

let audioContext = null;
function ensureAudio() {
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
  } catch {
    audioContext = null;
  }
}

function beep(duration, frequency) {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function togglePause() {
  if (!game.configured || game.phase === "setup") return;
  game.paused = !game.paused;
  ui.pauseButton.textContent = game.paused ? t("gResume") : t("gPause");
  if (game.paused) {
    announce("PAUSED", t("gStatusPaused"), t("gPausedDetail"), 999);
  } else {
    game.bannerUntil = 0;
    game.lastFrame = performance.now();
  }
}

function frame(now) {
  const dt = Math.min(.035, Math.max(0, (now - game.lastFrame) / 1000));
  game.lastFrame = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  const controlled = [
    "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "KeyN", "KeyM", "Comma", "Period",
  ];
  if (game.configured && !ui.setupOverlay.hidden && controlled.includes(event.code)) return;
  if (game.configured && ui.setupOverlay.hidden && controlled.includes(event.code)) event.preventDefault();
  if (event.code === "Escape") {
    event.preventDefault();
    togglePause();
    return;
  }
  if (event.repeat) {
    keys.add(event.code);
    return;
  }
  keys.add(event.code);
  if (!game.configured || game.paused || !ui.setupOverlay.hidden) return;
  if (event.code === "KeyQ") startTack(game.boats.A, -1);
  if (event.code === "KeyE") startTack(game.boats.A, 1);
  if (event.code === "KeyN" || event.code === "Comma") startTack(game.boats.B, -1);
  if (event.code === "KeyM" || event.code === "Period") startTack(game.boats.B, 1);
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());

ui.setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(ui.setupForm);
  resetRace(data.get("course"), Number(data.get("sequence")), data.get("weather"));
  ui.setupOverlay.hidden = true;
  document.getElementById("raceArena").scrollIntoView({ behavior: "smooth", block: "start" });
});

ui.pauseButton.addEventListener("click", togglePause);
ui.newRaceButton.addEventListener("click", () => {
  game.paused = true;
  keys.clear();
  ui.setupOverlay.hidden = false;
});
ui.clearLogButton.addEventListener("click", () => {
  ui.eventLog.innerHTML = "";
  addLog(t("gLogCleared"));
});

/* re-render translated chrome on language change (dashboard refreshes each frame) */
window.HubI18n.onChange(() => {
  ui.pauseButton.textContent = game.paused ? (game.configured ? t("gResume") : t("gPause")) : t("gPause");
  if (game.configured) ui.courseLabel.textContent = courseName(game.courseKey);
});

game.boats = {
  A: createBoat("A", 610, 350),
  B: createBoat("B", 850, 10),
};
requestAnimationFrame(frame);
