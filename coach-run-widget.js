// Coach Run — widget Scriptable
// Affiche la séance du jour, la nutrition associée, la semaine et le compte à rebours du semi.
// Le programme est lu depuis GitHub (plan.json), mis à jour chaque matin puis après chaque séance
// (stats Strava de la séance + nutrition de récupération, champ « session » du jour).
// Tailles : petit, moyen, grand. Clair ou sombre selon le réglage de l'iPhone.
// Toucher le widget ouvre la page complète du programme.

const PAGE_URL = "https://claude.ai/artifact/CeMCEbcdUuo3chzsc7Y2ey";

// Adresse du programme publié chaque matin sur GitHub.
const DATA_URL = "https://raw.githubusercontent.com/Adri2415/coach-run/main/plan.json";

// Date du semi de Paris (compte à rebours).
const RACE = new Date(2027, 2, 7);

// Charge le programme en ligne, garde une copie sur le téléphone en cas de coupure réseau.
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), "coach-run-plan.json");
let data = null;
try {
  const req = new Request(DATA_URL + "?t=" + Date.now());
  req.timeoutInterval = 10;
  data = await req.loadJSON();
  fm.writeString(cachePath, JSON.stringify(data));
} catch (e) {
  if (fm.fileExists(cachePath)) data = JSON.parse(fm.readString(cachePath));
}
const PLAN = (data && data.days) || {};
const PAGE = (data && data.page) || PAGE_URL;
const QUOTES = (data && data.quotes) || [];

const DEFAULT_DAY = {
  tag: "Repos", kind: "rest",
  title: "Repos ou vélo facile",
  detail: "",
  food: "Protéines à chaque repas, féculents modérés."
};

// ---------- Couleurs (clair / sombre) ----------
const dyn = (light, dark) => Color.dynamic(new Color(light), new Color(dark));
const C = {
  bg: dyn("#FFFFFF", "#1C1E22"),
  fg: dyn("#16202C", "#F2F4F7"),
  sub: dyn("#3E4C5B", "#C3CCD6"),
  muted: dyn("#5A6878", "#9AA6B4"),
  chip: dyn("#F0F2F5", "#2A2E34"),
  line: dyn("#E6E9EE", "#2E3238"),
  race: dyn("#2C56C9", "#7FA2FF"),
  good: dyn("#2F7D55", "#5CC98D"),
  goodTint: dyn("#E4F2EA", "#17301F"),
  doneFill: dyn("#2F7D55", "#2E9A62")
};

// Couleur, fond et symbole par type de séance
const KIND = {
  hard:  { fg: dyn("#B4560F", "#F29A55"), tint: dyn("#FBEBDD", "#3A2616"), sym: "bolt.fill", emoji: "⚡" },
  run:   { fg: dyn("#2C56C9", "#7FA2FF"), tint: dyn("#E6ECFA", "#1D2740"), sym: "figure.run", emoji: "🏃" },
  muscu: { fg: dyn("#2C56C9", "#7FA2FF"), tint: dyn("#E6ECFA", "#1D2740"), sym: "dumbbell.fill", emoji: "🏋️" },
  swim:  { fg: dyn("#0B7480", "#4FC3CF"), tint: dyn("#E0F2F4", "#13302F"), sym: "figure.pool.swim", emoji: "🏊" },
  bike:  { fg: dyn("#2F7D55", "#5CC98D"), tint: dyn("#E4F2EA", "#17301F"), sym: "bicycle", emoji: "🚴" },
  kine:  { fg: dyn("#6B4BA6", "#B99BEA"), tint: dyn("#EEE8F7", "#2A2238"), sym: "stethoscope", emoji: "🩺" },
  rest:  { fg: dyn("#5A6878", "#9AA6B4"), tint: dyn("#F0F2F5", "#2A2E34"), sym: "moon.fill", emoji: "😴" }
};
const kindOf = d => KIND[(d && d.kind)] || KIND.run;

const isDone = d => !!d && (d.done === true || /\s*·\s*fait\s*$/.test(d.title || ""));
const label = d => (d.title || "").replace(/\s*·\s*fait\s*$/, "");

// ---------- Dates ----------
function iso(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${j}`;
}
const now = new Date();
const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
const keys = Object.keys(PLAN).sort();
const lastKey = keys.length ? keys[keys.length - 1] : "0000-00-00";

function dayFor(d) {
  const k = iso(d);
  if (PLAN[k]) return PLAN[k];
  if (k > lastKey) return {
    tag: "À jour ?", kind: "rest",
    title: "Semaine terminée",
    detail: "Ouvre la page pour le nouveau programme.",
    food: ""
  };
  return DEFAULT_DAY;
}

const today = dayFor(now);
// Phrase de motivation : celle du jour si la mise à jour du matin l'a écrite, sinon une phrase de la liste qui change chaque jour
const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const dayIndex = Math.floor((midnight - new Date(now.getFullYear(), 0, 1)) / 86400000);
const motivation = today.motivation || (QUOTES.length ? QUOTES[dayIndex % QUOTES.length] : "");
const daysToRace = Math.round((RACE - midnight) / 86400000);
const raceLabel = daysToRace > 0 ? "J-" + daysToRace : (daysToRace === 0 ? "Jour J" : "");

// Séance réalisée aujourd'hui (écrite après la séance à partir de Strava)
const S = today.session || null;
const fmtKm = v => String(Math.round(v * 10) / 10).replace(".", ",");
function sessionLine(s) {
  const parts = [];
  if (s.km) parts.push(fmtKm(s.km) + " km");
  if (s.m) parts.push(s.m + " m");
  if (s.time) parts.push(s.time);
  if (s.pace) parts.push(s.pace);
  if (s.hr) parts.push("FC " + s.hr);
  if (s.cadence) parts.push(s.cadence + " ppm");
  if (s.dplus) parts.push(s.dplus + " m D+");
  return parts.join(" · ");
}
const statsLine = S ? sessionLine(S) : "";
const next = dayFor(tomorrow);
const fmt = opts => new Intl.DateTimeFormat("fr-FR", opts);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const dateLong = cap(fmt({ weekday: "long", day: "numeric", month: "long" }).format(now));
const dateShort = (fmt({ weekday: "short" }).format(now).replace(".", "") + " " + now.getDate()).toUpperCase();
const weekdayDay = fmt({ weekday: "long" }).format(now) + " " + now.getDate();
const detailLine = today.detail ? today.detail.split(/(?<=\.)\s/)[0].replace(/\.$/, "") : "";

// ---------- Briques ----------
function addText(stack, txt, font, color, lines, scale) {
  const t = stack.addText(txt || "");
  t.font = font;
  t.textColor = color;
  if (lines) t.lineLimit = lines;
  if (scale) t.minimumScaleFactor = scale;
  return t;
}

// Symbole SF (ou émoji si le symbole n'existe pas sur cette version d'iOS)
function addSymbol(stack, name, size, color, fallback) {
  const s = SFSymbol.named(name);
  if (s) {
    s.applyFont(Font.semiboldSystemFont(size));
    const img = stack.addImage(s.image);
    img.imageSize = new Size(size, size);
    img.tintColor = color;
    return img;
  }
  return addText(stack, fallback || "•", Font.systemFont(size * 0.8), color);
}

// Pastille ronde avec le symbole de la séance
function addBadge(stack, day, diameter, opts) {
  opts = opts || {};
  const k = kindOf(day);
  const b = stack.addStack();
  b.size = new Size(diameter, diameter);
  b.cornerRadius = diameter / 2;
  b.backgroundColor = opts.fill || (opts.neutral ? C.chip : k.tint);
  b.centerAlignContent();
  if (opts.ring) { b.borderWidth = 2; b.borderColor = k.fg; }
  if (opts.check) addSymbol(b, "checkmark", diameter * 0.45, Color.white(), "✓");
  else addSymbol(b, k.sym, diameter * 0.5, k.fg, day.emoji || k.emoji);
  return b;
}

// Ligne « icône ronde verte + étiquette + texte » (grand widget)
function addInfoRow(parent, sym, title, text, lines) {
  const row = parent.addStack();
  row.centerAlignContent();
  const dot = row.addStack();
  dot.size = new Size(24, 24);
  dot.cornerRadius = 12;
  dot.backgroundColor = C.goodTint;
  dot.centerAlignContent();
  addSymbol(dot, sym, 12, C.good, "•");
  row.addSpacer(8);
  const t = row.addStack();
  t.size = new Size(54, 0);
  addText(t, title, Font.boldSystemFont(12), C.fg, 1);
  addText(row, text, Font.systemFont(12), C.sub, lines || 2, 0.85);
  row.addSpacer();
  return row;
}

function addDivider(w, before, after) {
  w.addSpacer(before);
  const sep = w.addStack();
  sep.backgroundColor = C.line;
  sep.size = new Size(0, 1);
  sep.addSpacer();
  w.addSpacer(after);
}

// ---------- Petit ----------
function buildSmall(w) {
  const head = w.addStack();
  head.centerAlignContent();
  addBadge(head, today, 36, isDone(today) ? { fill: C.doneFill, check: true } : {});
  head.addSpacer();
  addText(head, dateShort, Font.semiboldSystemFont(12), C.muted, 1);

  w.addSpacer();
  addText(w, label(today), Font.boldSystemFont(18), C.fg, 2, 0.7);
  w.addSpacer(2);
  addText(w, S ? statsLine : detailLine, Font.systemFont(11), C.muted, 2, 0.8);

  const food = S ? (S.recovery || today.food) : today.food;
  if (food) {
    w.addSpacer(8);
    const r = w.addStack();
    r.centerAlignContent();
    addSymbol(r, "fork.knife", 11, C.good, "🍽");
    r.addSpacer(5);
    addText(r, food, Font.semiboldSystemFont(11), C.good, 1, 0.8);
  }
}

// ---------- Moyen ----------
function buildMedium(w) {
  const head = w.addStack();
  head.centerAlignContent();
  addBadge(head, today, 40, isDone(today) ? { fill: C.doneFill, check: true } : {});
  head.addSpacer(12);
  const col = head.addStack();
  col.layoutVertically();
  addText(col, (today.tag || "") + " · " + weekdayDay, Font.semiboldSystemFont(12), C.muted, 1);
  addText(col, label(today), Font.boldSystemFont(17), C.fg, 1, 0.7);
  head.addSpacer(8);
  if (raceLabel) {
    const r = head.addStack();
    r.layoutVertically();
    const r1 = r.addStack(); r1.addSpacer();
    addText(r1, raceLabel, Font.boldSystemFont(17), C.race, 1);
    const r2 = r.addStack(); r2.addSpacer();
    addText(r2, "SEMI DE PARIS", Font.semiboldSystemFont(9), C.muted, 1);
  }

  w.addSpacer(4);
  const sub = w.addStack();
  sub.addSpacer(52);
  addText(sub, S ? statsLine : detailLine, Font.systemFont(12), S ? C.good : C.muted, 1, 0.75);

  w.addSpacer();

  // Nutrition : récupération si la séance est faite, sinon conseil du jour
  const food = S ? (S.recovery || today.food) : today.food;
  if (food) {
    const lbl = w.addStack();
    lbl.centerAlignContent();
    addSymbol(lbl, S ? "arrow.counterclockwise" : "fork.knife", 10, C.good, "🍽");
    lbl.addSpacer(4);
    addText(lbl, S ? "RÉCUP" : "NUTRITION", Font.boldSystemFont(10), C.good, 1);
    w.addSpacer(2);
    addText(w, food, Font.systemFont(12), C.fg, 2, 0.8);
  }

  addDivider(w, 6, 5);
  const row = w.addStack();
  row.centerAlignContent();
  addText(row, "Demain", Font.semiboldSystemFont(12), C.muted, 1);
  row.addSpacer(6);
  addSymbol(row, kindOf(next).sym, 12, kindOf(next).fg, next.emoji || kindOf(next).emoji);
  row.addSpacer(5);
  addText(row, label(next), Font.systemFont(12), C.fg, 1, 0.8);
  row.addSpacer();
}

// ---------- Grand ----------
function buildLarge(w) {
  const top = w.addStack();
  top.centerAlignContent();
  addText(top, dateLong, Font.semiboldSystemFont(12), C.muted, 1);
  top.addSpacer();
  if (raceLabel) addText(top, "Semi · " + raceLabel, Font.semiboldSystemFont(12), C.race, 1);

  w.addSpacer(12);
  const head = w.addStack();
  head.centerAlignContent();
  addBadge(head, today, 44, isDone(today) ? { fill: C.doneFill, check: true } : {});
  head.addSpacer(12);
  const col = head.addStack();
  col.layoutVertically();
  addText(col, label(today), Font.boldSystemFont(19), C.fg, 1, 0.7);
  addText(col, S ? statsLine : detailLine, Font.systemFont(13), S ? C.good : C.muted, 1, 0.75);
  head.addSpacer();

  if (today.care) {
    w.addSpacer(10);
    const pill = w.addStack();
    pill.backgroundColor = C.chip;
    pill.cornerRadius = 10;
    pill.setPadding(3, 9, 3, 9);
    pill.centerAlignContent();
    addSymbol(pill, "arrow.triangle.2.circlepath", 11, C.sub, "🩹");
    pill.addSpacer(5);
    addText(pill, today.care.replace(/^🩹\s*/, ""), Font.semiboldSystemFont(11), C.sub, 1, 0.75);
  }

  w.addSpacer(12);
  if (S) {
    if (S.summary) { addInfoRow(w, "chart.bar.fill", "Bilan", S.summary, 2); w.addSpacer(7); }
    addInfoRow(w, "fork.knife", "Récup", S.recovery || today.food || "", 2);
  } else {
    if (today.analysis) { addInfoRow(w, "chart.bar.fill", "Hier", today.analysis, 2); w.addSpacer(7); }
    if (today.food) addInfoRow(w, "fork.knife", "Repas", today.food, 2);
  }

  addDivider(w, 12, 10);

  // La semaine : L M M J V S D
  const mon = new Date(midnight); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const letters = ["L", "M", "M", "J", "V", "S", "D"];
  const week = w.addStack();
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    const k = iso(d);
    const day = PLAN[k] || DEFAULT_DAY;
    const isToday = k === iso(now);
    const c = week.addStack();
    c.layoutVertically();
    c.centerAlignContent();
    const l = c.addStack(); l.addSpacer();
    addText(l, letters[i], isToday ? Font.boldSystemFont(11) : Font.semiboldSystemFont(11), isToday ? kindOf(day).fg : C.muted, 1);
    l.addSpacer();
    c.addSpacer(5);
    const b = c.addStack(); b.addSpacer();
    if (isDone(day)) addBadge(b, day, 30, { fill: C.doneFill, check: true, ring: isToday });
    else if (isToday) addBadge(b, day, 30, { ring: true });
    else addBadge(b, day, 30, { neutral: true });
    b.addSpacer();
    if (i < 6) week.addSpacer();
  }

  w.addSpacer();
  if (motivation) addText(w, motivation, Font.italicSystemFont(12), C.race, 2, 0.8);
}

function build(family) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.url = PAGE;
  w.setPadding(16, 16, 16, 16);
  // Rafraîchir toutes les 20 min environ (iOS décide du moment exact) pour voir la séance dès qu'elle est enregistrée
  w.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000);

  if (family === "small") buildSmall(w);
  else if (family === "large") buildLarge(w);
  else buildMedium(w);
  return w;
}

// ---------- Lancement ----------
const family = config.widgetFamily || "medium";
const widget = build(family);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else if (family === "large") {
  await widget.presentLarge();
} else if (family === "small") {
  await widget.presentSmall();
} else {
  await widget.presentMedium();
}
Script.complete();
