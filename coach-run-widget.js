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
  rest: Color.dynamic(new Color("#5A6878"), new Color("#9AA8B8"))
};

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
    addText(w, today.title, Font.boldSystemFont(15), C.fg, 4);
    w.addSpacer();
    addText(w, "Demain : " + next.title, Font.systemFont(10), C.muted, 2);
    return w;
  }

  addText(w, today.title, Font.boldSystemFont(17), C.fg, 2);
  w.addSpacer(4);

  if (family === "large" && today.detail) {
    addText(w, today.detail, Font.systemFont(13), C.fg, 5);
    w.addSpacer(6);
  }
  if (today.food) {
    addText(w, "🍽 " + today.food, Font.systemFont(family === "large" ? 13 : 11), C.muted, family === "large" ? 3 : 2);
  }

  w.addSpacer();

  if (family === "large") {
    addText(w, "CETTE SEMAINE", Font.semiboldSystemFont(10), C.muted);
    w.addSpacer(4);
    for (const k of keys) {
      if (k <= iso(now)) continue;
      const d = new Date(k + "T12:00:00");
      const row = w.addStack();
      row.centerAlignContent();
      const day = addText(row, shortDay(d), Font.semiboldSystemFont(12), C.muted);
      row.addSpacer(8);
      const dot = row.addStack();
      dot.size = new Size(6, 6);
      dot.cornerRadius = 3;
      dot.backgroundColor = C[PLAN[k].kind] || C.run;
      row.addSpacer(6);
      addText(row, PLAN[k].title, Font.systemFont(12), C.fg, 1);
      w.addSpacer(3);
    }
  } else {
    const sep = w.addStack();
    sep.backgroundColor = C.line;
    sep.size = new Size(0, 1);
    w.addSpacer(6);
    const row = w.addStack();
    addText(row, "Demain  ", Font.semiboldSystemFont(11), C.muted);
    addText(row, next.title, Font.systemFont(11), C.fg, 1);
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
