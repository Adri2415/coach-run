// Jauge de la semaine — widget Scriptable
// Kilomètres courus face à l'objectif de la semaine, séances cochées,
// et comparaison avec la semaine précédente.
// Données : ton plan Coach Run sur GitHub, complété chaque matin avec Strava.

const PLAN_URL = "https://raw.githubusercontent.com/Adri2415/coach-run/main/plan.json";

// ---------- Couleurs (clair / sombre) ----------
const C = {
  bg: Color.dynamic(new Color("#F3F5F8"), new Color("#0F151D")),
  fg: Color.dynamic(new Color("#16202C"), new Color("#E6EBF1")),
  muted: Color.dynamic(new Color("#5A6878"), new Color("#9AA8B8")),
  track: Color.dynamic(new Color("#DCE3EC"), new Color("#25303C")),
  accent: Color.dynamic(new Color("#2C56C9"), new Color("#7D9CF0")),
  plan: Color.dynamic(new Color("#B9C7DD"), new Color("#3A4A63")),
  good: Color.dynamic(new Color("#2F8A5B"), new Color("#62C892")),
  warn: Color.dynamic(new Color("#C2611A"), new Color("#EE9A5A"))
};

// ---------- Données ----------
async function loadPlan() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), "coach-run-plan.json");
  try {
    const r = new Request(PLAN_URL + "?t=" + Date.now());
    r.timeoutInterval = 10;
    const j = await r.loadJSON();
    fm.writeString(path, JSON.stringify(j));
    return j;
  } catch (e) {
    return fm.fileExists(path) ? JSON.parse(fm.readString(path)) : null;
  }
}
const plan = await loadPlan();

const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const km = x => (Math.round(x * 10) / 10).toString().replace(".", ",");
const now = new Date();
const todayKey = iso(now);

// Lundi de la semaine en cours
const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
const weekKey = iso(monday);
const prevMonday = new Date(monday); prevMonday.setDate(monday.getDate() - 7);
const prevKey = iso(prevMonday);
const dates = [...Array(7)].map((_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
const sunday = dates[6];

const weeks = (plan && plan.weeks) || {};
const days = (plan && plan.days) || {};
const W = weeks[weekKey] || { target_km: null, done_km: 0, planned_km: {}, daily_km: {}, bike_km: 0, swim_m: 0 };
const P = weeks[prevKey];

const done = W.done_km || 0;
const target = W.target_km || 0;
const pct = target ? Math.round(done / target * 100) : null;

// Où tu devrais en être aujourd'hui, d'après les kilomètres prévus jusqu'à hier inclus
let attendu = 0;
for (const d of dates) { const k = iso(d); if (k < todayKey) attendu += (W.planned_km || {})[k] || 0; }

// Séances : jours prévus (hors repos et kiné), et ceux cochés « fait »
const EMOJI = { run: "🏃", hard: "⚡", muscu: "🏋️", swim: "🏊", bike: "🚴", kine: "🩺", rest: "😴" };
let prevues = 0, faites = 0;
for (const d of dates) {
  const s = days[iso(d)];
  if (!s || ["rest", "kine"].includes(s.kind)) continue;
  prevues++;
  if (/· fait$/.test(s.title)) faites++;
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const periode = monday.getDate() + "–" + sunday.getDate() + " " + MOIS[sunday.getMonth()];
const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

// ---------- Dessins ----------
function barre(largeur) {
  const h = 12;
  const dc = new DrawContext();
  dc.size = new Size(largeur, h + 6);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const fond = new Path();
  fond.addRoundedRect(new Rect(0, 3, largeur, h), h / 2, h / 2);
  dc.addPath(fond); dc.setFillColor(C.track); dc.fillPath();
  if (target) {
    const w = Math.max(h, Math.min(1, done / target) * largeur);
    if (done > 0) {
      const p = new Path();
      p.addRoundedRect(new Rect(0, 3, w, h), h / 2, h / 2);
      dc.addPath(p); dc.setFillColor(done >= target ? C.good : C.accent); dc.fillPath();
    }
    if (attendu > 0 && attendu < target) { // repère « où tu devrais en être »
      const x = attendu / target * largeur;
      dc.setFillColor(C.fg);
      dc.fillRect(new Rect(x - 1, 0, 2, h + 6));
    }
  }
  return dc.getImage();
}

function colonnes(largeur, hauteur) {
  const dc = new DrawContext();
  const labelH = 14;
  dc.size = new Size(largeur, hauteur + labelH);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const daily = W.daily_km || {}, planned = W.planned_km || {};
  const maxKm = Math.max(10, ...dates.map(d => Math.max(daily[iso(d)] || 0, planned[iso(d)] || 0)));
  const gap = 8, w = (largeur - gap * 6) / 7;
  dates.forEach((d, i) => {
    const k = iso(d), x = i * (w + gap);
    const pk = planned[k] || 0, dk = daily[k] || 0;
    if (pk > 0) { // prévu : barre claire
      const ph = Math.max(3, pk / maxKm * hauteur);
      const p = new Path(); p.addRoundedRect(new Rect(x, hauteur - ph, w, ph), 3, 3);
      dc.addPath(p); dc.setFillColor(C.plan); dc.fillPath();
    }
    if (dk > 0) { // couru : barre pleine
      const dh = Math.max(3, dk / maxKm * hauteur);
      const p = new Path(); p.addRoundedRect(new Rect(x + w * 0.2, hauteur - dh, w * 0.6, dh), 3, 3);
      dc.addPath(p); dc.setFillColor(C.accent); dc.fillPath();
    }
    if (pk === 0 && dk === 0) { // rien : petit trait
      dc.setFillColor(C.track); dc.fillRect(new Rect(x, hauteur - 2, w, 2));
    }
    dc.setFont(k === todayKey ? Font.boldSystemFont(10) : Font.systemFont(10));
    dc.setTextColor(k === todayKey ? C.fg : C.muted);
    dc.setTextAlignedCenter();
    dc.drawTextInRect(JOURS[i], new Rect(x, hauteur + 2, w, labelH));
  });
  return dc.getImage();
}

// ---------- Widget ----------
function txt(stack, s, font, color, lines) {
  const t = stack.addText(s);
  t.font = font; t.textColor = color;
  if (lines) t.lineLimit = lines;
  t.minimumScaleFactor = 0.8;
  return t;
}

function build(family) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 12, 14);
  if (plan && plan.page) w.url = plan.page;
  w.refreshAfterDate = new Date(Date.now() + 2 * 60 * 60 * 1000);

  if (!plan) {
    txt(w, "📈 Jauge de la semaine", Font.boldSystemFont(14), C.fg);
    w.addSpacer(6);
    txt(w, "Programme indisponible pour le moment.", Font.systemFont(12), C.muted, 3);
    return w;
  }

  const head = w.addStack();
  head.centerAlignContent();
  txt(head, family === "small" ? "SEMAINE" : "📈 Semaine du " + periode, Font.semiboldSystemFont(11), C.muted, 1);
  head.addSpacer();
  if (pct !== null && family !== "small") txt(head, pct + " %", Font.boldSystemFont(12), done >= target ? C.good : C.accent);
  w.addSpacer(6);

  const big = w.addStack();
  big.bottomAlignContent();
  txt(big, km(done), Font.boldRoundedSystemFont(family === "small" ? 30 : 34), C.fg);
  txt(big, target ? " / " + target + " km" : " km", Font.semiboldSystemFont(family === "small" ? 13 : 15), C.muted);
  w.addSpacer(6);

  const largeur = family === "small" ? 130 : family === "large" ? 300 : 290;
  const b = w.addImage(barre(largeur));
  b.imageSize = new Size(largeur, 18);
  w.addSpacer(6);

  // Message de situation
  let etat;
  if (!target) etat = "Pas d'objectif cette semaine";
  else if (done >= target) etat = "Objectif atteint 🎉";
  else if (attendu > 0 && done >= attendu) etat = "Dans les temps";
  else if (attendu > 0 && done < attendu - 3) etat = "En retard sur le plan : pas de rattrapage forcé";
  else etat = "Reste " + km(target - done) + " km";

  if (family === "small") {
    txt(w, etat, Font.systemFont(10), C.muted, 2);
    w.addSpacer();
    if (prevues) txt(w, "Séances " + faites + "/" + prevues, Font.semiboldSystemFont(11), C.fg);
    return w;
  }

  const ligne = w.addStack();
  txt(ligne, etat, Font.systemFont(11), done >= target && target ? C.good : C.muted, 1);
  ligne.addSpacer();
  if (prevues) txt(ligne, "Séances " + faites + "/" + prevues, Font.semiboldSystemFont(11), C.fg, 1);

  w.addSpacer();
  const cols = w.addImage(colonnes(largeur, family === "large" ? 70 : 34));
  cols.imageSize = new Size(largeur, (family === "large" ? 70 : 34) + 14);

  w.addSpacer(4);
  const autres = [];
  if (W.bike_km) autres.push("🚴 " + km(W.bike_km) + " km");
  if (W.swim_m) autres.push("🏊 " + km(W.swim_m / 1000) + " km");
  if (P && P.done_km) autres.push("sem. dernière " + km(P.done_km) + " km");
  if (autres.length) txt(w, autres.join("  ·  "), Font.systemFont(10), C.muted, 1);

  if (family === "large") {
    w.addSpacer(10);
    txt(w, "JOUR PAR JOUR", Font.semiboldSystemFont(10), C.muted);
    w.addSpacer(4);
    dates.forEach((d, i) => {
      const k = iso(d), s = days[k];
      const row = w.addStack();
      row.centerAlignContent();
      txt(row, ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][i] + " " + d.getDate(), k === todayKey ? Font.boldSystemFont(12) : Font.systemFont(12), k === todayKey ? C.fg : C.muted);
      row.addSpacer(8);
      txt(row, s ? (s.emoji || EMOJI[s.kind] || "🏃") + " " + s.title : "—", Font.systemFont(12), C.fg, 1);
      row.addSpacer();
      const dk = (W.daily_km || {})[k];
      if (dk) txt(row, km(dk) + " km", Font.semiboldSystemFont(12), C.accent);
      w.addSpacer(2);
    });
  }
  return w;
}

const family = config.widgetFamily || "medium";
const widget = build(family);
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
