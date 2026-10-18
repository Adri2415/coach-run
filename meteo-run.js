// Météo du run — widget Scriptable
// Trouve le meilleur créneau d'une heure pour courir aujourd'hui à Paris
// (pluie, vent, température, lumière du jour) et conseille la tenue.
// Prévisions : Open-Meteo (gratuit, sans compte). Séance du jour : ton plan Coach Run sur GitHub.

const LIEU = { nom: "Paris", lat: 48.8566, lon: 2.3522 };
const HEURE_MIN = 6;    // pas de créneau avant 6h
const HEURE_MAX = 21;   // dernier départ possible à 21h
const PLAN_URL = "https://raw.githubusercontent.com/Adri2415/coach-run/main/plan.json";

// ---------- Couleurs (clair / sombre) ----------
const C = {
  bg: Color.dynamic(new Color("#EEF4F8"), new Color("#0E161E")),
  fg: Color.dynamic(new Color("#14212C"), new Color("#E4ECF2")),
  muted: Color.dynamic(new Color("#566776"), new Color("#93A5B5")),
  accent: Color.dynamic(new Color("#1F6FB2"), new Color("#6FB2E8")),
  good: Color.dynamic(new Color("#2F8A5B"), new Color("#62C892")),
  ok: Color.dynamic(new Color("#D29A1E"), new Color("#E9B949")),
  bad: Color.dynamic(new Color("#C24E3A"), new Color("#EE7F6B")),
  none: Color.dynamic(new Color("#D5DEE6"), new Color("#24313D"))
};

// ---------- Données ----------
async function loadJSON(url, cacheName) {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), cacheName);
  try {
    const r = new Request(url);
    r.timeoutInterval = 12;
    const j = await r.loadJSON();
    fm.writeString(path, JSON.stringify(j));
    return j;
  } catch (e) {
    return fm.fileExists(path) ? JSON.parse(fm.readString(path)) : null;
  }
}

const meteoURL = "https://api.open-meteo.com/v1/forecast?latitude=" + LIEU.lat + "&longitude=" + LIEU.lon +
  "&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,weather_code,is_day" +
  "&timezone=Europe%2FParis&forecast_days=2";

const meteo = await loadJSON(meteoURL, "meteo-run.json");
const plan = await loadJSON(PLAN_URL + "?t=" + Date.now(), "coach-run-plan.json");

// ---------- Outils ----------
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const now = new Date();

function meteoEmoji(code, jour) {
  if (code === 0) return jour ? "☀️" : "🌙";
  if (code <= 2) return jour ? "🌤️" : "☁️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 85 && code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

// Note de 0 (à éviter) à 100 (idéal) pour courir pendant cette heure
function note(h) {
  let s = 100;
  s -= h.pluieProba * 0.5;                   // 60 % de risque = -30
  s -= Math.min(h.pluie, 4) * 12;            // pluie réelle prévue
  if (h.vent > 15) s -= (h.vent - 15) * 1.2; // vent gênant au-delà de 15 km/h
  const idealMin = 7, idealMax = 15;         // température ressentie idéale pour courir
  if (h.ressenti < idealMin) s -= (idealMin - h.ressenti) * 2.5;
  if (h.ressenti > idealMax) s -= (h.ressenti - idealMax) * 3;
  if (!h.jour) s -= 12;                      // nuit : moins agréable, lampe nécessaire
  if (h.code >= 95) s -= 40;                 // orage
  return Math.max(0, Math.min(100, Math.round(s)));
}

function heures(dateKey) {
  if (!meteo || !meteo.hourly) return [];
  const H = meteo.hourly;
  const out = [];
  for (let i = 0; i < H.time.length; i++) {
    const [d, t] = H.time[i].split("T");
    if (d !== dateKey) continue;
    const heure = parseInt(t.slice(0, 2), 10);
    const h = {
      heure, temp: H.temperature_2m[i], ressenti: H.apparent_temperature[i],
      pluieProba: H.precipitation_probability[i] ?? 0, pluie: H.precipitation[i] ?? 0,
      vent: H.wind_speed_10m[i], code: H.weather_code[i], jour: H.is_day[i] === 1
    };
    h.note = note(h);
    out.push(h);
  }
  return out;
}

// Meilleur départ : moyenne de l'heure de départ et de la suivante (séance ~1 h)
function meilleurCreneau(liste, depuis) {
  let best = null;
  for (let i = 0; i < liste.length - 1; i++) {
    const h = liste[i];
    if (h.heure < Math.max(HEURE_MIN, depuis) || h.heure > HEURE_MAX) continue;
    const s = Math.round((h.note + liste[i + 1].note) / 2);
    if (!best || s > best.score) best = { h, suivante: liste[i + 1], score: s };
  }
  return best;
}

function tenue(h) {
  const r = h.ressenti;
  let t;
  if (r >= 18) t = "Débardeur + short";
  else if (r >= 12) t = "T-shirt + short";
  else if (r >= 7) t = "Manches longues + short";
  else if (r >= 2) t = "Manches longues, collant, gants fins";
  else t = "2 couches, collant, gants, bonnet";
  const extras = [];
  if (h.pluieProba >= 50 || h.pluie > 0.3) extras.push("veste de pluie");
  else if (h.vent >= 25) extras.push("coupe-vent");
  if (!h.jour) extras.push("frontale + gilet réfléchissant");
  return t + (extras.length ? ", " + extras.join(", ") : "");
}

const verdict = s => s >= 75 ? { txt: "Conditions idéales", c: C.good }
  : s >= 50 ? { txt: "Conditions correctes", c: C.ok }
  : { txt: "Conditions difficiles", c: C.bad };

// ---------- Calcul ----------
const todayKey = iso(now);
const tm = new Date(now); tm.setDate(now.getDate() + 1);
let jourKey = todayKey, jourLabel = "Aujourd'hui";
let liste = heures(todayKey);
let best = meilleurCreneau(liste, now.getHours() + (now.getMinutes() > 30 ? 1 : 0));
if (!best) { // trop tard aujourd'hui : on regarde demain
  jourKey = iso(tm); jourLabel = "Demain";
  liste = heures(jourKey);
  best = meilleurCreneau(liste, 0);
}

const seance = plan && plan.days ? plan.days[jourKey] : null;
const EMOJI = { run: "🏃", hard: "⚡", muscu: "🏋️", swim: "🏊", bike: "🚴", kine: "🩺", rest: "😴" };
const pasDeCourse = seance && ["muscu", "swim", "kine", "rest"].includes(seance.kind);

// ---------- Widget ----------
function txt(stack, s, font, color, lines) {
  const t = stack.addText(s);
  t.font = font; t.textColor = color;
  if (lines) t.lineLimit = lines;
  t.minimumScaleFactor = 0.8;
  return t;
}

// Bande colorée des heures (vert = bon, jaune = moyen, rouge = à éviter)
function bande(liste, mis, largeur, hauteur) {
  const heuresAff = liste.filter(h => h.heure >= HEURE_MIN && h.heure <= HEURE_MAX);
  const dc = new DrawContext();
  dc.size = new Size(largeur, hauteur + 14);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const n = heuresAff.length || 1, gap = 2;
  const w = (largeur - gap * (n - 1)) / n;
  heuresAff.forEach((h, i) => {
    const x = i * (w + gap);
    const passe = jourKey === todayKey && h.heure < now.getHours();
    dc.setFillColor(passe ? C.none : h.note >= 75 ? C.good : h.note >= 50 ? C.ok : C.bad);
    const path = new Path();
    const haut = mis && (h.heure === mis.heure || h.heure === mis.heure + 1);
    path.addRoundedRect(new Rect(x, haut ? 0 : 3, w, haut ? hauteur : hauteur - 6), 2, 2);
    dc.addPath(path); dc.fillPath();
    if (h.heure % 3 === 0) {
      dc.setTextColor(C.muted);
      dc.setFont(Font.systemFont(9));
      dc.drawText(h.heure + "h", new Point(x, hauteur + 2));
    }
  });
  return dc.getImage();
}

function build(family) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 12, 14);
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000); // toutes les heures

  if (!best) {
    txt(w, "🌦️ Météo du run", Font.boldSystemFont(14), C.fg);
    w.addSpacer(6);
    txt(w, "Prévisions indisponibles pour le moment.", Font.systemFont(12), C.muted, 3);
    return w;
  }

  const h = best.h, v = verdict(best.score);
  const creneau = h.heure + "h – " + (h.heure + 1) + "h";

  const head = w.addStack();
  head.centerAlignContent();
  txt(head, family === "small" ? jourLabel.toUpperCase() : "Météo du run · " + jourLabel.toLowerCase(), Font.semiboldSystemFont(11), C.muted, 1);
  head.addSpacer();
  if (family !== "small" && seance) txt(head, (seance.emoji || EMOJI[seance.kind] || "🏃") + " " + seance.tag, Font.semiboldSystemFont(11), C.muted, 1);
  w.addSpacer(4);

  const main = w.addStack();
  main.centerAlignContent();
  txt(main, meteoEmoji(h.code, h.jour) + " ", Font.systemFont(family === "small" ? 22 : 26), C.fg);
  const col = main.addStack();
  col.layoutVertically();
  txt(col, creneau, Font.boldSystemFont(family === "small" ? 18 : 22), C.fg, 1);
  txt(col, v.txt, Font.semiboldSystemFont(11), v.c, 1);

  w.addSpacer(4);
  const infos = Math.round(h.temp) + "° (ressenti " + Math.round(h.ressenti) + "°) · 💧" + Math.round(h.pluieProba) + " % · 💨" + Math.round(h.vent) + " km/h";
  txt(w, infos, Font.systemFont(family === "small" ? 10 : 12), C.fg, family === "small" ? 2 : 1);
  w.addSpacer(3);
  txt(w, "👕 " + tenue(h), Font.systemFont(family === "small" ? 10 : 12), C.muted, 2);

  if (family !== "small") {
    w.addSpacer();
    if (pasDeCourse) {
      txt(w, "Pas de course au programme (" + seance.tag.toLowerCase() + ") : la météo reste utile pour sortir à vélo ou à pied.", Font.italicSystemFont(10), C.muted, 1);
      w.addSpacer(3);
    }
    const img = w.addImage(bande(liste, h, family === "large" ? 300 : 290, 14));
    img.imageSize = new Size(family === "large" ? 300 : 290, 28);
  }

  if (family === "large") {
    w.addSpacer(10);
    txt(w, "HEURE PAR HEURE", Font.semiboldSystemFont(10), C.muted);
    w.addSpacer(4);
    const depuis = jourKey === todayKey ? now.getHours() : HEURE_MIN;
    liste.filter(x => x.heure >= depuis && x.heure <= HEURE_MAX).slice(0, 8).forEach(x => {
      const row = w.addStack();
      row.centerAlignContent();
      txt(row, pad(x.heure) + "h", Font.semiboldSystemFont(12), C.muted);
      row.addSpacer(8);
      txt(row, meteoEmoji(x.code, x.jour) + " " + Math.round(x.temp) + "°  💧" + Math.round(x.pluieProba) + " %  💨" + Math.round(x.vent), Font.systemFont(12), C.fg, 1);
      row.addSpacer();
      const dot = row.addStack();
      dot.size = new Size(8, 8); dot.cornerRadius = 4;
      dot.backgroundColor = x.note >= 75 ? C.good : x.note >= 50 ? C.ok : C.bad;
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
