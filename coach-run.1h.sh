#!/bin/bash
# Coach Run — barre des menus du Mac (SwiftBar ou xbar)
# Affiche la séance du jour dans la barre des menus, avec le détail,
# la nutrition, la séance de demain et le reste de la semaine dans le menu.
# Le programme est lu sur GitHub (plan.json), mis à jour chaque matin.
# Rafraîchissement : toutes les heures (le « 1h » dans le nom du fichier).

/usr/bin/osascript -l JavaScript <<'EOF'
function run() {
  ObjC.import('Foundation');

  const DATA_URL = 'https://raw.githubusercontent.com/Adri2415/coach-run/main/plan.json';
  const PAGE_URL = 'https://claude.ai/artifact/CeMCEbcdUuo3chzsc7Y2ey';
  const cachePath = $('~/Library/Caches/coach-run-plan.json').stringByExpandingTildeInPath.js;

  // Charge le programme en ligne, sinon la dernière copie enregistrée
  let raw = null;
  const data = $.NSData.dataWithContentsOfURL($.NSURL.URLWithString(DATA_URL + '?t=' + Date.now()));
  if (data && !data.isNil()) {
    raw = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;
    $(raw).writeToFileAtomicallyEncodingError(cachePath, true, $.NSUTF8StringEncoding, null);
  } else {
    const cached = $.NSString.stringWithContentsOfFileEncodingError(cachePath, $.NSUTF8StringEncoding, null);
    if (cached && !cached.isNil()) raw = cached.js;
  }

  if (!raw) return ['🏃 Coach Run', '---', 'Programme indisponible (pas de réseau)', 'Ouvrir la page | href=' + PAGE_URL].join('\n');

  let plan;
  try { plan = JSON.parse(raw); } catch (e) { return '🏃 Coach Run\n---\nProgramme illisible\nOuvrir la page | href=' + PAGE_URL; }
  const days = plan.days || {};
  const page = plan.page || PAGE_URL;

  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const ICON = { run: '🏃', hard: '⚡', muscu: '🏋️', swim: '🏊', bike: '🚴', kine: '🩺', rest: '😴' };
  const emo = d => d.emoji || ICON[d.kind] || '🏃';
  const isDone = d => !!d && (d.done === true || /\s*·\s*fait\s*$/.test(d.title || ''));
  const label = d => (d.title || '').replace(/\s*·\s*fait\s*$/, '');
  const tick = d => isDone(d) ? ' ✅' : '';
  const QUOTES = plan.quotes || [];
  const clean = s => String(s || '').replace(/\|/g, '/');
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  const now = new Date();
  const tm = new Date(now); tm.setDate(now.getDate() + 1);
  const todayKey = iso(now), tomorrowKey = iso(tm);
  const keys = Object.keys(days).sort();
  const lastKey = keys.length ? keys[keys.length - 1] : '0000-00-00';

  const fallback = todayKey > lastKey
    ? { tag: 'À jour ?', kind: 'rest', title: 'Semaine terminée', detail: 'Ouvre la page pour le nouveau programme.', food: '' }
    : { tag: 'Repos', kind: 'rest', title: 'Repos ou vélo facile', detail: '', food: 'Protéines à chaque repas, féculents modérés.' };
  const today = days[todayKey] || fallback;
  const next = days[tomorrowKey];

  const out = [];
  out.push(emo(today) + ' ' + short(clean(label(today)), 28) + tick(today));
  out.push('---');
  out.push(emo(today) + ' ' + clean(today.tag).toUpperCase() + ' · ' + clean(label(today)) + (isDone(today) ? ' · ✅ fait' : '') + ' | size=13');
  if (today.analysis) out.push('📊 ' + clean(today.analysis) + ' | size=12');
  clean(today.detail).split(/ · |\. /).filter(Boolean).forEach(l => out.push(l + ' | size=12'));
  if (today.care) out.push(clean(today.care) + ' | size=12 color=#C2611A');
  if (plan.care && plan.care.routine) {
    out.push('Routine ischios | size=12');
    plan.care.routine.forEach(r => out.push('--' + clean(r) + ' | size=12'));
  }
  if (today.food) out.push('🍽 ' + clean(today.food) + ' | size=12');
  const dayIndex = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(now.getFullYear(), 0, 1)) / 86400000);
  const motivation = today.motivation || (QUOTES.length ? QUOTES[dayIndex % QUOTES.length] : '');
  if (motivation) out.push('💬 ' + clean(motivation) + ' | size=12');
  if (next) {
    out.push('---');
    out.push('Demain : ' + emo(next) + ' ' + clean(label(next)) + ' | size=12');
  }
  const rest = keys.filter(k => k > tomorrowKey).slice(0, 7);
  if (rest.length) {
    out.push('---');
    out.push('À venir | size=11');
    rest.forEach(k => {
      const d = new Date(k + 'T12:00:00');
      out.push(JOURS[d.getDay()] + ' ' + d.getDate() + '  ' + emo(days[k]) + ' ' + clean(label(days[k])) + tick(days[k]) + ' | size=12');
    });
  }
  if (plan.note) { out.push('---'); out.push(clean(plan.note) + ' | size=11'); }
  out.push('---');
  out.push('Ouvrir le programme complet | href=' + page);
  out.push('Mis à jour le ' + clean(plan.updated) + ' | size=11');
  out.push('Rafraîchir | refresh=true');
  return out.join('\n');
}
EOF
