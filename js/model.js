// model.js — derives periods/cycles/state from logs. Pure functions. Owner: Agent 1.
import { todayStr, addDays, diffDays } from './db.js';
import { predictions } from './predict.js';

// A period = consecutive run of dates with non-null flow.
// A gap of 1 missing day (diff of 2 between logged flow dates) stays within
// the same period; a gap of >=2 missing days (diff >= 3) starts a new period.
export function getPeriods(logs) {
  const flowDates = (logs || [])
    .filter(l => l && l.flow != null && l.flow !== '')
    .map(l => l.date)
    .sort();

  const periods = [];
  let start = null;
  let prev = null;
  for (const d of flowDates) {
    if (start === null) {
      start = d;
    } else if (diffDays(prev, d) > 2) {
      periods.push({ start, end: prev, length: diffDays(start, prev) + 1 });
      start = d;
    }
    prev = d;
  }
  if (start !== null) {
    periods.push({ start, end: prev, length: diffDays(start, prev) + 1 });
  }
  return periods;
}

// A cycle starts at a period's first day, ends the day before the next
// period's first day. Last cycle is open-ended (end/length null).
export function getCycles(logs) {
  const periods = getPeriods(logs);
  const cycles = [];
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    const next = periods[i + 1] || null;
    if (next) {
      cycles.push({
        start: p.start,
        end: addDays(next.start, -1),
        length: diffDays(p.start, next.start),
        periodLength: p.length
      });
    } else {
      cycles.push({
        start: p.start,
        end: null,
        length: null,
        periodLength: p.length
      });
    }
  }
  return cycles;
}

// Stats over the last <=6 completed cycles.
export function cycleStats(cycles) {
  const completed = (cycles || []).filter(c => c.length != null).slice(-6);
  const count = completed.length;
  if (count === 0) {
    return { avgCycle: null, stdCycle: null, avgPeriod: null, count: 0 };
  }
  const lengths = completed.map(c => c.length);
  const periodLengths = completed.map(c => c.periodLength);
  const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const avgC = mean(lengths);
  const variance = mean(lengths.map(x => (x - avgC) * (x - avgC)));
  return {
    avgCycle: Math.round(avgC),
    stdCycle: Math.round(Math.sqrt(variance) * 10) / 10,
    avgPeriod: Math.round(mean(periodLengths)),
    count
  };
}

// Current position in the cycle, today.
export function currentState(logs, settings) {
  const periods = getPeriods(logs || []);
  if (periods.length === 0) {
    return { cycleDay: null, cycleStart: null, onPeriod: false, phase: null };
  }
  const today = todayStr();
  const last = periods[periods.length - 1];
  const cycleStart = last.start;
  const cycleDay = diffDays(cycleStart, today) + 1;
  if (cycleDay < 1) {
    // All logged periods are in the future relative to today (odd but possible).
    return { cycleDay: null, cycleStart, onPeriod: false, phase: null };
  }

  const todayLog = (logs || []).find(l => l && l.date === today);
  const onPeriod = !!(todayLog && todayLog.flow != null && todayLog.flow !== '') ||
    (today >= last.start && today <= last.end);

  const pred = predictions(logs, settings || {});
  let phase = null;
  if (pred) {
    if (onPeriod || cycleDay <= pred.avgPeriod) {
      phase = 'menstrual';
    } else {
      const dToOv = diffDays(pred.ovulationDate, today); // >0 means past ovulation
      if (Math.abs(dToOv) <= 1) phase = 'ovulation';
      else if (dToOv > 1) phase = 'luteal';
      else phase = 'follicular';
    }
  }
  return { cycleDay, cycleStart, onPeriod, phase };
}

// V3 (Agent C): per-cycle-day pain/bleeding profile across ALL cycles,
// including the current open one. Returns an array indexed [cycleDay - 1]
// up to the longest cycle (or the furthest logged day of the open cycle):
//   { day, avgPain, maxPain, avgFlow, n }
// avgFlow uses a 0–4 scale (none 0, spotting 1, light 2, medium 3, heavy 4);
// a logged day with no flow counts as 0 (she logged — no bleeding).
// painLevel 0 is real data (explicitly pain-free); null/absent is not logged.
// Days with no logs at all get null averages and n = 0. Pure — no DB access.
export function cycleDayProfile(logs) {
  const cycles = getCycles(logs || []);
  if (!cycles.length) return [];

  const FLOW_VAL = { none: 0, spotting: 1, light: 2, medium: 3, heavy: 4 };

  let maxDay = 0;
  for (const c of cycles) {
    if (c.length != null && c.length > maxDay) maxDay = c.length;
  }

  const acc = []; // index -> { painSum, painN, painMax, flowSum, flowN, n }
  for (const log of logs || []) {
    if (!log || !log.date) continue;
    // Find the cycle this date belongs to (completed, or the open last cycle).
    let cyc = null;
    for (const c of cycles) {
      if (diffDays(c.start, log.date) < 0) continue;      // before this cycle
      if (c.end == null || diffDays(log.date, c.end) >= 0) { cyc = c; break; }
    }
    if (!cyc) continue;
    const day = diffDays(cyc.start, log.date) + 1;
    if (day < 1) continue;
    if (day > maxDay) maxDay = day;

    const i = day - 1;
    if (!acc[i]) acc[i] = { painSum: 0, painN: 0, painMax: null, flowSum: 0, flowN: 0, n: 0 };
    const a = acc[i];
    a.n += 1;

    const p = log.painLevel;
    if (typeof p === 'number' && isFinite(p)) {
      a.painSum += p;
      a.painN += 1;
      if (a.painMax == null || p > a.painMax) a.painMax = p;
    }
    const f = (log.flow != null && log.flow !== '' && FLOW_VAL[log.flow] != null)
      ? FLOW_VAL[log.flow] : 0;
    a.flowSum += f;
    a.flowN += 1;
  }

  const round2 = (x) => Math.round(x * 100) / 100;
  const out = [];
  for (let i = 0; i < maxDay; i++) {
    const a = acc[i];
    if (!a || a.n === 0) {
      out.push({ day: i + 1, avgPain: null, maxPain: null, avgFlow: null, n: 0 });
    } else {
      out.push({
        day: i + 1,
        avgPain: a.painN ? round2(a.painSum / a.painN) : null,
        maxPain: a.painMax,
        avgFlow: a.flowN ? round2(a.flowSum / a.flowN) : null,
        n: a.n
      });
    }
  }
  return out;
}
