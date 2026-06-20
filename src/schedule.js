import { state, getSceneGroup } from './state.js';
// Duration: "HH:MM" → total minutes (0 if empty, -1 if invalid)
  export function parseDuration(s) {
    if (!s) return 0;
    const m = s.match(/^(\d{1,2}):([0-5]\d)$/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1;
  }

  // Takes total minutes, returns "HH:MM"
  export function formatDuration(totalMin) {
    if (totalMin < 0) return '--:--';
    const h = Math.floor(totalMin / 60);
    const m = Math.round(totalMin % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  export function isValidDuration(s) {
    if (!s) return true;
    return /^\d{1,2}:[0-5]\d$/.test(s);
  }

  // Normalize raw duration input → "HH:MM".
  // Accepts: "30" → "00:30", "130" → "01:30", "0030" → "00:30", "1:30" → "01:30"
  export function normalizeDuration(raw) {
    if (!raw) return '';
    if (/^\d{1,2}:[0-5]\d$/.test(raw)) {
      const [hh, mm] = raw.split(':');
      return String(parseInt(hh, 10)).padStart(2, '0') + ':' + mm;
    }
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    let h, m;
    if (digits.length <= 2)      { h = 0;                         m = parseInt(digits, 10); }
    else if (digits.length === 3){ h = parseInt(digits[0], 10);   m = parseInt(digits.slice(1), 10); }
    else                         { m = parseInt(digits.slice(-2), 10); h = parseInt(digits.slice(0, -2), 10); }
    if (m > 59) { h += Math.floor(m / 60); m = m % 60; }
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  // Normalize raw wall-clock input → "HH:MM" (clamped to 23:59).
  export function normalizeTime(raw) {
    if (!raw) return '';
    if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(raw)) {
      const [hh, mm] = raw.split(':');
      return String(parseInt(hh, 10)).padStart(2, '0') + ':' + mm;
    }
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    let h, m;
    if (digits.length <= 2)      { h = 0;                         m = parseInt(digits, 10); }
    else if (digits.length === 3){ h = parseInt(digits[0], 10);   m = parseInt(digits.slice(1), 10); }
    else                         { m = parseInt(digits.slice(-2), 10); h = parseInt(digits.slice(0, -2), 10); }
    if (m > 59) m = 59;
    if (h > 23) h = 23;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  // Time-of-day: "HH:MM" → minutes since midnight (-1 if invalid)
  export function parseTime(s) {
    if (!s) return -1;
    const m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    return m ? parseInt(m[1])*60 + parseInt(m[2]) : -1;
  }

  export function formatTime(totalMin) {
    if (totalMin < 0) return '--:--';
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  }

  export function isValidTime(s) {
    if (!s) return true;
    return /^([01]?\d|2[0-3]):[0-5]\d$/.test(s);
  }

  // Takes overrun in minutes, returns "+HH:MM"
  export function formatOverrun(totalMin) {
    if (totalMin <= 0) return '';
    const h = Math.floor(totalMin / 60);
    const m = Math.round(totalMin % 60);
    return '+' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

    // ── Schedule Computation ───────────────────────
  // Duration is now HH:MM (hours:minutes); all schedule values in minutes.
  export function cascadeSchedule() {
    state.scheduleMap = {};
    state.groupTotals = {};
    let prevEndMin = -1;
    console.log('cascadeSchedule starting. Total shots:', state.shots.length);

    for (let i = 0; i < state.shots.length; i++) {
      const s = state.shots[i];
      const durMin = parseDuration(s.duration); // already in minutes

      const group = getSceneGroup(s.num);
      if (group) {
        if (!state.groupTotals[group.numStr]) state.groupTotals[group.numStr] = { min: 0, color: group.border, bg: group.bg };
        if (durMin > 0) state.groupTotals[group.numStr].min += durMin;
      }

      let callMin = -1;
      let isInherited = false;

      if (s.callTime && isValidTime(s.callTime)) {
        callMin = parseTime(s.callTime);
      } else if (prevEndMin >= 0) {
        callMin = prevEndMin;
        isInherited = true;
      }

      let endMin = -1;
      if (callMin >= 0 && durMin > 0) {
        endMin = callMin + durMin;
      } else if (callMin >= 0) {
        endMin = callMin;
      }

      state.scheduleMap[s.id] = { callMin, endMin, overrunMin: 0, isInherited };

      if (endMin >= 0) prevEndMin = endMin;
    }

    // Second pass: compute overruns (in minutes)
    for (let i = 0; i < state.shots.length - 1; i++) {
      const cur  = state.scheduleMap[state.shots[i].id];
      const next = state.scheduleMap[state.shots[i + 1].id];
      if (cur.endMin >= 0 && next.callMin >= 0 && !next.isInherited) {
        const delta = cur.endMin - next.callMin;
        if (delta > 0) cur.overrunMin = delta;
      }
    }
  }
