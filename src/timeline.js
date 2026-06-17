import { dom, $ } from './dom.js';
import { state, getSceneGroup } from './state.js';
import { esc } from './main.js';
import { parseDuration, formatDuration, formatTime } from './schedule.js';
  // ── Timeline Bar ───────────────────────────────
  export function renderTimeline() {
    const inner = $('timelineInner');
    const times = $('timelineTimes');

    if (state.shots.length === 0) {
      inner.innerHTML = '';
      times.textContent = '';
      return;
    }

    const totalDurSec = state.shots.reduce((sum, s) => {
      const d = parseDuration(s.duration);
      return sum + (d > 0 ? d : 0);
    }, 0);

    if (totalDurSec === 0) {
      // Equal blocks
      const pct = 100 / state.shots.length;
      inner.innerHTML = state.shots.map(s => {
        const group = getSceneGroup(s.num);
        let title = s.kind === 'block' ? `${esc(s.blockType)}${s.label?' '+esc(s.label):''}` : `#${esc(s.num)} · ${esc(s.movement || '')}`;
        if (group && state.groupTotals[group.numStr]) {
          title += ` (Sc ${group.numStr} Total: ${formatDuration(state.groupTotals[group.numStr].min)})`;
        }
        const defaultBg = s.kind === 'block' ? 'var(--bg-2)' : '';
        const bg = group ? group.border : defaultBg;
        return `<div class="tl-block${s.kind==='block' ? ' block-type-'+s.blockType : ''}" style="width:${pct}%;${bg?'background:'+bg+' !important':''}">` +
        `<span class="tl-tooltip">${title}</span></div>`;
      }).join('');
    } else {
      inner.innerHTML = state.shots.map(s => {
        const d = parseDuration(s.duration);
        const sec = d > 0 ? d : 0;
        const pct = (sec / totalDurSec) * 100;
        const group = getSceneGroup(s.num);
        let title = s.kind === 'block' ? `${esc(s.blockType)}${s.label?' '+esc(s.label):''}` : `#${esc(s.num)} · ${esc(s.movement || '')}`;

        const durStr = s.duration || '--:--';
        title += ` · ${durStr}`;
        if (group && state.groupTotals[group.numStr]) {
          title += ` (Sc ${group.numStr} Total: ${formatDuration(state.groupTotals[group.numStr].min)})`;
        }
        const defaultBg = s.kind === 'block' ? (s.blockType==='PREP'?'var(--orange)':s.blockType==='BREAK'?'var(--green)':s.blockType==='LUNCH'?'var(--blue)':s.blockType==='TRAVEL'?'#a855f7':'var(--text-2)') : '';
        const bg = group ? group.border : defaultBg;
        return `<div class="tl-block" style="width:${Math.max(pct, 0.5)}%;${bg?'background:'+bg+' !important':''}">` +
          `<span class="tl-tooltip">${title}</span></div>`;
      }).join('');
    }

    // Show first call time → last end time
    const firstSched = state.scheduleMap[state.shots[0]?.id];
    const lastSched = state.scheduleMap[state.shots[state.shots.length - 1]?.id];
    const startStr = firstSched && firstSched.callMin >= 0 ? formatTime(firstSched.callMin) : '--:--';
    const endStr = lastSched && lastSched.endMin >= 0 ? formatTime(lastSched.endMin) : '--:--';
    times.textContent = startStr + ' → ' + endStr;
  }
