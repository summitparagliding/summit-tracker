<script>
  import { enhance } from '$app/forms';
  import Icon from '$lib/components/Icon.svelte';
  import FlightReplay from '$lib/components/FlightReplay.svelte';
  export let data;
  $: ({ flights } = data);
  let search = '';

  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-CA') : '—'; }
  function fmtDur(s) { if(!s)return'—'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; }
  function siteName(s) {
    if(!s)return'—';
    const m={ne:'NE',n:'N',o:'O',s:'S',n_club:'Club N',o_jardin:'Jardin O',o_alt:'Alt. O',s_alt:'Alt. S',arbrissage:'Arbrissage'};
    return m[s]||s.replace(/_/g,' ');
  }

  $: filtered = flights.filter(f =>
    !search || f.student_name?.toLowerCase().includes(search.toLowerCase()) ||
    f.site?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by date then student
  $: grouped = (() => {
    const byDate = {};
    for (const f of filtered) {
      const d = f.date || 'Unknown';
      if (!byDate[d]) byDate[d] = {};
      const s = f.student_name || 'Unknown';
      if (!byDate[d][s]) byDate[d][s] = [];
      byDate[d][s].push(f);
    }
    // Sort dates descending
    return Object.entries(byDate)
      .sort(([a],[b]) => b.localeCompare(a))
      .map(([date, students]) => ({
        date,
        students: Object.entries(students)
          .sort(([a],[b]) => a.localeCompare(b))
          .map(([name, fls]) => ({
            name,
            flights: fls.sort((a,b) => (a.start_time||'').localeCompare(b.start_time||''))
          })),
        totalFlights: Object.values(students).flat().length
      }));
  })();

  $: totalFlights = flights.length;
  let replayFlight = null;
  function fq(f) {
    if (!f.launch_quality && !f.landing_quality) return 0;
    return Math.round(((f.launch_quality||0)+(f.landing_quality||0)) / (f.launch_quality&&f.landing_quality?2:1));
  }
</script>

{#if replayFlight}
  <FlightReplay flight={replayFlight} onClose={() => replayFlight = null} />
{/if}

<svelte:head><title>All Flights — Instructor</title></svelte:head>

<div class="page-hd">
  <div><h1>All Flights</h1><p>{totalFlights} total · grouped by day & pilot</p></div>
  <input bind:value={search} placeholder="Search student or site…" style="max-width:240px" />
</div>

{#if grouped.length === 0}
  <div class="empty card"><div class="empty-icon"><Icon name="flights" size={36} color="var(--teal)" /></div><strong>No flights found</strong></div>
{/if}

{#each grouped as day}
  <!-- Day header -->
  <div class="day-header">
    <div class="day-date mono">{fmtDate(day.date)}</div>
    <div class="day-count xs dimmed">{day.totalFlights} flight{day.totalFlights!==1?'s':''}</div>
  </div>

  {#each day.students as student}
    <div class="student-day-block card">
      <div class="sdb-header">
        <div class="sdb-av">{student.name[0]}</div>
        <div class="sdb-name">{student.name}</div>
        <div class="sdb-count xs dimmed">{student.flights.length} flight{student.flights.length!==1?'s':''}</div>
      </div>

      <div class="flight-rows">
        {#each student.flights as f, i}
          <div class="flight-row">
            <div class="fr-num mono dimmed xs">{i+1}</div>
            <div class="fr-times xs mono dimmed">
              {#if f.start_time}{f.start_time}{/if}
              {#if f.start_time && f.end_time} → {/if}
              {#if f.end_time}{f.end_time}{/if}
              {#if !f.start_time && !f.end_time}—{/if}
            </div>
            <div class="fr-site small">{siteName(f.site)}{#if f.landing_site} → {siteName(f.landing_site)}{/if}</div>
            <div class="fr-dur mono xs" style="color:var(--teal)">{fmtDur(f.duration_seconds)}</div>
            {#if f.meters_gained}
              <div class="fr-gain xs" style="color:var(--green)">+{f.meters_gained}m</div>
            {/if}
            <!-- Quality badge -->
            {#if fq(f) > 0}
              <div class="fr-quality">
                {#each Array(fq(f)) as _}
                  <svg width="10" height="10" viewBox="0 0 24 24"><polygon points="12,2 15,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="var(--amber)" /></svg>
                {/each}
              </div>
            {/if}
            <!-- Type badge -->
            {#if f.flight_type}
              <span class="badge badge-muted xs">{f.flight_type}</span>
            {/if}
            <!-- GPS indicator -->
            {#if f.track_geojson}
              <span class="gps-dot" title="GPS track available"></span>
            {/if}
            <!-- Launch type -->
            {#if f.launch_type}
              <span class="xs dimmed">{f.launch_type==='forward'?'↑face':'↑dos'}</span>
            {/if}
            {#if f.track_geojson}
              <button class="btn btn-primary btn-xs" on:click={() => replayFlight = f}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
              </button>
              <a href="/api/flight/{f.id}/download" class="btn btn-secondary btn-xs">GPX</a>
            {/if}
            <a href="/flight/{f.id}" target="_blank" class="btn btn-secondary btn-xs fr-view">
              <Icon name="share" size={12} />View
            </a>
          </div>
        {/each}
      </div>
    </div>
  {/each}
{/each}

<style>
  .page-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.25rem;flex-wrap:wrap}
  .page-hd h1{font-size:1.5rem}
  .page-hd p{color:var(--txt-2);font-size:.82rem;margin-top:.2rem}

  .day-header{display:flex;align-items:center;gap:.875rem;margin:1.25rem 0 .5rem;padding-bottom:.4rem;border-bottom:1px solid var(--border)}
  .day-date{font-family:var(--ff-head);font-weight:700;font-size:.95rem;color:var(--txt)}
  .day-count{margin-left:auto}

  .student-day-block{margin-bottom:.625rem;padding:.875rem 1rem}
  .sdb-header{display:flex;align-items:center;gap:.625rem;margin-bottom:.625rem}
  .sdb-av{width:26px;height:26px;border-radius:50%;background:var(--teal-lo);border:1px solid var(--teal-border);color:var(--teal);font-family:var(--ff-head);font-weight:800;font-size:.78rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .sdb-name{font-weight:700;font-size:.875rem;flex:1}
  .sdb-count{flex-shrink:0}

  .flight-rows{display:flex;flex-direction:column;gap:0}
  .flight-row{display:flex;align-items:center;gap:.5rem;padding:.45rem .5rem;border-top:1px solid var(--border);flex-wrap:wrap}
  .flight-row:first-child{border-top:none}
  .fr-num{width:18px;flex-shrink:0}
  .fr-times{flex-shrink:0;min-width:90px}
  .fr-site{flex:1;min-width:80px}
  .fr-dur{flex-shrink:0}
  .fr-gain{flex-shrink:0}
  .fr-quality{display:flex;gap:1px;flex-shrink:0}
  .gps-dot{width:7px;height:7px;border-radius:50%;background:var(--teal);flex-shrink:0;box-shadow:0 0 4px var(--teal)}
  .fr-view{flex-shrink:0;margin-left:auto}
</style>
