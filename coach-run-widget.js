// Coach Run — widget Scriptable
// Affiche la séance du jour, la nutrition associée et la séance du lendemain.
// Le programme est lu chaque jour depuis GitHub (plan.json), mis à jour automatiquement chaque matin.
// Tailles : petit, moyen, grand. Toucher le widget ouvre la page complète du programme.

const PAGE_URL = "https://claude.ai/artifact/CeMCEbcdUuo3chzsc7Y2ey";

// Adresse du programme publié chaque matin sur GitHub.
const DATA_URL = "https://raw.githubusercontent.com/Adri2415/coach-run/main/plan.json";

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
const C = {
  bg: Color.dynamic(new Color("#F3F5F8"), new Color("#0F151D")),
  fg: Color.dynamic(new Color("#16202C"), new Color("#E6EBF1")),
  muted: Color.dynamic(new Color("#5A6878"), new Color("#9AA8B8")),
  line: Color.dynamic(new Color("#D9DFE7"), new Color("#2A3542")),
  run: Color.dynamic(new Color("#2C56C9"), new Color("#7D9CF0")),
  muscu: Color.dynamic(new Color("#2C56C9"), new Color("#7D9CF0")),
  hard: Color.dynamic(new Color("#C2611A"), new Color("#EE9A5A")),
  rest: Color.dynamic(new Color("#5A6878"), new Color("#9AA8B8")),
  good: Color.dynamic(new Color("#2F7D55"), new Color("#6CC596")),
  swim: Color.dynamic(new Color("#0E8A9A"), new Color("#5CC8D6")),
  bike: Color.dynamic(new Color("#2F7D55"), new Color("#6CC596")),
  kine: Color.dynamic(new Color("#7A55B8"), new Color("#B39AE8"))
};

// Émoji par pratique (utilisé si le programme n'en précise pas)
const EMOJI = { run: "🏃", hard: "⚡", muscu: "🏋️", swim: "🏊", bike: "🚴", kine: "🩺", rest: "😴" };
const emojiOf = d => d.emoji || EMOJI[d.kind] || "🏃";
// Séance faite : champ done, ou titre terminé par « · fait »
const isDone = d => !!d && (d.done === true || /\s*·\s*fait\s*$/.test(d.title || ""));
const label = d => (d.title || "").replace(/\s*·\s*fait\s*$/, "");
const tick = d => isDone(d) ? " ✅" : "";

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
const dayIndex = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(now.getFullYear(), 0, 1)) / 86400000);
const motivation = today.motivation || (QUOTES.length ? QUOTES[dayIndex % QUOTES.length] : "");
const analysis = today.analysis || "";
const next = dayFor(tomorrow);
const dateLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(now);
const shortDay = d => new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(d).replace(".", "");

// ---------- Construction ----------
function addText(stack, txt, font, color, lines) {
  const t = stack.addText(txt);
  t.font = font;
  t.textColor = color;
  if (lines) t.lineLimit = lines;
  return t;
}

function addTag(stack, day) {
  const pill = stack.addStack();
  pill.backgroundColor = C[day.kind] || C.run;
  pill.cornerRadius = 8;
  pill.setPadding(2, 7, 2, 7);
  addText(pill, day.tag.toUpperCase(), Font.boldSystemFont(10), Color.white());
}

function build(family) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.url = PAGE;
  w.setPadding(14, 14, 14, 14);

  // Rafraîchir juste après minuit
  const midnight = new Date(now); midnight.setHours(24, 1, 0, 0);
  w.refreshAfterDate = midnight;

  const head = w.addStack();
  head.centerAlignContent();
  addText(head, family === "small" ? shortDay(now).toUpperCase() : dateLabel, Font.semiboldSystemFont(11), C.muted, 1);
  head.addSpacer();
  if (family !== "small") addTag(head, today);
  w.addSpacer(6);

  if (family === "small") {
    addTag(w, today);
    w.addSpacer(6);
    addText(w, emojiOf(today) + " " + label(today) + tick(today), Font.boldSystemFont(15), C.fg, 3);
    w.addSpacer();
    if (motivation) addText(w, motivation, Font.italicSystemFont(10), C.run, 3);
    else addText(w, "Demain : " + label(next), Font.systemFont(10), C.muted, 2);
    return w;
  }

  const big = family === "large";
  addText(w, emojiOf(today) + " " + label(today) + tick(today), Font.boldSystemFont(big ? 18 : 16), C.fg, big ? 2 : 1).minimumScaleFactor = 0.8;
  w.addSpacer(4);

  if (analysis) {
    addText(w, "📊 " + analysis, Font.systemFont(big ? 13 : 11), C.fg, big ? 3 : (today.care ? 1 : 2)).minimumScaleFactor = 0.85;
    w.addSpacer(3);
  }
  if (today.care) {
    addText(w, today.care, Font.semiboldSystemFont(big ? 13 : 11), C.hard, big ? 2 : 1).minimumScaleFactor = 0.85;
    w.addSpacer(3);
  }

  if (family === "large" && today.detail) {
    addText(w, today.detail, Font.systemFont(13), C.fg, 5);
    w.addSpacer(6);
  }
  if (today.food) {
    addText(w, "🍽 " + today.food, Font.systemFont(big ? 13 : 11), C.muted, big ? 3 : 1).minimumScaleFactor = 0.85;
  }

  w.addSpacer();

  if (motivation) {
    addText(w, motivation, Font.italicSystemFont(big ? 13 : 11), C.run, big ? 2 : 1).minimumScaleFactor = 0.8;
    w.addSpacer(big ? 10 : 4);
  }

  if (family === "large") {
    addText(w, "CETTE SEMAINE", Font.semiboldSystemFont(10), C.muted);
    w.addSpacer(4);
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate()); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    for (const k of keys.filter(k => k >= iso(mon) && k !== iso(now)).slice(0, 6)) {
      const d = new Date(k + "T12:00:00");
      const row = w.addStack();
      row.centerAlignContent();
      const day = addText(row, shortDay(d), Font.semiboldSystemFont(12), C.muted);
      row.addSpacer(8);
      addText(row, emojiOf(PLAN[k]), Font.systemFont(12), C.fg, 1);
      row.addSpacer(6);
      addText(row, label(PLAN[k]), Font.systemFont(12), k < iso(now) && !isDone(PLAN[k]) ? C.muted : C.fg, 1);
      row.addSpacer();
      if (isDone(PLAN[k])) addText(row, "✅", Font.systemFont(12), C.fg);
      w.addSpacer(3);
    }
  } else {
    const sep = w.addStack();
    sep.backgroundColor = C.line;
    sep.size = new Size(0, 1);
    w.addSpacer(6);
    const row = w.addStack();
    addText(row, "Demain  ", Font.semiboldSystemFont(11), C.muted);
    addText(row, emojiOf(next) + " " + label(next), Font.systemFont(11), C.fg, 1);
  }

  return w;
}

// ---------- Lancement ----------
const family = config.widgetFamily || "medium";
const widget = build(family);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
