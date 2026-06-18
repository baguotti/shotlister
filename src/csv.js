import { state } from './state.js';
import { formatTime, parseDuration } from './schedule.js';
import { getFilteredShots } from './main.js';
  // ── CSV Export ─────────────────────────────────
  export function exportCSV() {
    const headers = ['Scene','Shot','Priority','Location','Description','Notes','Character','Shot Size','Lens','Movement','Props','Duration','Call Time','End Time'];
    const rows = state.shots.map(s => {
      const sched = state.scheduleMap[s.id] || { callMin: -1, endMin: -1 };
      if (s.kind === 'block') {
        return [
          s.num || '',
          '',
          '',
          `"${(s.label||'').replace(/"/g,'""')}"`,
          `"${(s.description||'').replace(/"/g,'""')}"`,
          `"${(s.notes||'').replace(/"/g,'""')}"`,
          '',
          '',
          '',
          `"${s.blockType}"`,
          '',
          s.duration,
          sched.callMin >= 0 ? formatTime(sched.callMin) : '',
          sched.endMin >= 0 ? formatTime(sched.endMin) : ''
        ];
      }
      return [
        s.num,
        s.shot || '',
        s.priority,
        `"${(s.location||'').replace(/"/g,'""')}"`,
        `"${(s.description||'').replace(/"/g,'""')}"`,
        `"${(s.notes||'').replace(/"/g,'""')}"`,
        `"${(s.characters||'').replace(/"/g,'""')}"`,
        s.shotSize || '',
        s.lens || '',
        s.movement || '',
        `"${(s.props||'').replace(/"/g,'""')}"`,
        s.duration,
        sched.callMin >= 0 ? formatTime(sched.callMin) : '',
        sched.endMin >= 0 ? formatTime(sched.endMin) : ''
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (dom.projectTitle.textContent.trim() || 'shotlist') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }
