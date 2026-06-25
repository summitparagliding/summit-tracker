<script>
 const SITES = ['NE','N','W','S'];
 const DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
 const ACTS = [
 { key:'flight', label:' Vols (grands)' },
 { key:'first_flight', label:' 1ers vols' },
 { key:'ground', label:' Sol / GH' },
 { key:'theory', label:' Théorie' },
 { key:'exam', label:' Examen' },
 ];
 let selected = new Set();
 function toggle(k) { selected.has(k) ? selected.delete(k) : selected.add(k); selected = selected; }

 // Tomorrow's date as default
 const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
 const defaultDate = tomorrow.toISOString().slice(0,10);
</script>

<div class="page-wrap">
 <div class="page-hdr">
 <a href="/instructor/planning" class="btn btn-ghost btn-sm">← Back</a>
 <h1>New Training Day</h1>
 </div>

 <form method="POST" class="plan-form">
 <div class="fg">
 <label>Date de la journée</label>
 <div class="date-wrap">
   <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="cal-icon">
     <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
   </svg>
   <input type="date" name="date" value={defaultDate} required class="date-input" />
 </div>
 </div>

 <div class="fg">
 <label>Activités prévues</label>
 <div class="act-checks">
 {#each ACTS as a}
 <label class="act-chk" class:sel={selected.has(a.key)}>
 <input type="checkbox" name="activity_types" value={a.key}
 checked={selected.has(a.key)}
 on:change={() => toggle(a.key)} />
 {a.label}
 </label>
 {/each}
 </div>
 </div>

 <div class="row2">
 <div class="fg">
 <label>Site décollage</label>
 <select name="launch_site">
 <option value="">—</option>
 {#each SITES as s}<option>{s}</option>{/each}
 </select>
 </div>
 <div class="fg">
 <label>Max étudiants</label>
 <input type="number" name="max_students" value="12" min="1" max="30" />
 </div>
 </div>

 <div class="row3">
 <div class="fg">
 <label>Vent min (km/h)</label>
 <input type="number" name="wind_min" min="0" max="50" placeholder="0" />
 </div>
 <div class="fg">
 <label>Vent max (km/h)</label>
 <input type="number" name="wind_max" min="0" max="50" placeholder="20" />
 </div>
 <div class="fg">
 <label>Direction</label>
 <select name="wind_dir">
 <option value="">—</option>
 {#each DIRS as d}<option>{d}</option>{/each}
 </select>
 </div>
 </div>

 <div class="fg">
 <label>Résumé météo</label>
 <input type="text" name="weather_summary" placeholder="Ex: Matin calme, thermiques l'après-midi" />
 </div>

 <div class="fg">
 <label>Plan de journée (publié aux étudiants)</label>
 <textarea name="plan_text" rows="5"
 placeholder="Décrivez le plan de la journée — ce message sera envoyé sur Telegram et visible dans l'application des étudiants."></textarea>
 </div>

 <div class="fg-check">
 <label class="chk-lbl">
 <input type="checkbox" name="publish" value="1" checked />
 Publier immédiatement (visible aux étudiants)
 </label>
 </div>

 <div class="actions">
 <button type="submit" class="btn btn-primary">Créer le plan</button>
 </div>
 </form>
</div>

<style>
 .page-wrap{padding:1.25rem;max-width:560px}
 .page-hdr{font-family:var(--ff-head);display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem}
 h1{font-size:1.2rem;font-weight:700;color:var(--txt);margin:0}
 .plan-form{display:flex;flex-direction:column;gap:.875rem}
 .fg{display:flex;flex-direction:column;gap:.3rem}
 .fg label,.fg-check label{font-size:.8rem;font-weight:600;color:var(--txt-2)}
 .fg input,.fg select,.fg textarea{background:var(--bg-2);border:1px solid var(--border);border-radius:7px;padding:.5rem .65rem;color:var(--txt);font-size:.9rem;width:100%}
 .row2{display:grid;grid-template-columns:1fr 1fr;gap:.625rem}
 .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.625rem}
 .act-checks{display:flex;flex-wrap:wrap;gap:.4rem}
 .act-chk{display:flex;align-items:center;gap:.35rem;padding:.35rem .6rem;border-radius:20px;border:1px solid var(--border);font-size:.82rem;cursor:pointer;background:var(--bg-2);color:var(--txt-2);transition:all .15s}
 .act-chk.sel{background:rgba(0,184,122,.12);border-color:var(--teal);color:var(--teal)}
 .act-chk input{display:none}
 .fg-check{display:flex;align-items:center;gap:.5rem}
 .chk-lbl{display:flex;align-items:center;gap:.5rem;font-size:.85rem;color:var(--txt-2);cursor:pointer}
 .actions{padding-top:.5rem}
 .date-wrap{position:relative;display:flex;align-items:center}
 .cal-icon{position:absolute;left:.65rem;pointer-events:none;color:var(--teal);z-index:1}
 .date-input{padding-left:2.25rem !important;cursor:pointer;font-size:1rem !important;font-weight:600}
 .date-input::-webkit-calendar-picker-indicator{cursor:pointer;opacity:.6}
</style>
