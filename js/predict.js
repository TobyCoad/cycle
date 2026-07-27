// predict.js — cycle predictions. Pure functions, no DB access. Owner: Agent 1.
import { todayStr, addDays, diffDays } from './db.js';
import { getPeriods, getCycles, cycleStats } from './model.js';

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

// Weighted mean toward recent: weights 1..n where the most recent gets n.
function weightedMean(values) {
  let num = 0, den = 0;
  for (let i = 0; i < values.length; i++) {
    const w = i + 1; // values are oldest-first
    num += values[i] * w;
    den += w;
  }
  return num / den;
}

// predictions(logs, settings [, todayS]) -> null if no period logged.
// Optional third arg overrides "today" for unit tests; defaults to todayStr().
export function predictions(logs, settings, todayS) {
  const periods = getPeriods(logs || []);
  if (periods.length < 1) return null;

  settings = settings || {};
  const today = todayS || todayStr();
  const cycles = getCycles(logs || []);
  const stats = cycleStats(cycles);
  const completed = cycles.filter(c => c.length != null).slice(-6);

  // avgCycle: recent-weighted mean of last <=6 completed cycle lengths;
  // fallback cycleLengthOverride else 28. Clamp 15-60.
  let avgCycle;
  if (completed.length > 0) {
    avgCycle = weightedMean(completed.map(c => c.length));
  } else {
    avgCycle = settings.cycleLengthOverride != null ? settings.cycleLengthOverride : 28;
  }
  avgCycle = clamp(Math.round(avgCycle), 15, 60);

  // avgPeriod: mean of last <=6 period lengths; fallback override else 5. Clamp 1-10.
  const lastPeriods = periods.slice(-6);
  let avgPeriod;
  if (lastPeriods.length > 0) {
    avgPeriod = lastPeriods.reduce((a, p) => a + p.length, 0) / lastPeriods.length;
  } else {
    avgPeriod = settings.periodLengthOverride != null ? settings.periodLengthOverride : 5;
  }
  avgPeriod = clamp(Math.round(avgPeriod), 1, 10);

  const lutealLength = settings.lutealLength != null ? settings.lutealLength : 14;

  // Next period: last period start + avgCycle, projected forward if stale.
  // Keep the prediction while it's less than ~avgPeriod in the past (that is
  // the "overdue" window); beyond that, roll forward whole cycles.
  const lastStart = periods[periods.length - 1].start;
  let nextPeriodStart = addDays(lastStart, avgCycle);
  while (diffDays(nextPeriodStart, today) > avgPeriod) {
    nextPeriodStart = addDays(nextPeriodStart, avgCycle);
  }

  // overdueDays: today past predicted start with no flow logged today.
  const todayLog = (logs || []).find(l => l && l.date === today);
  const flowToday = !!(todayLog && todayLog.flow != null && todayLog.flow !== '');
  const late = diffDays(nextPeriodStart, today);
  const overdueDays = (!flowToday && late > 0) ? late : 0;

  const nextPeriodEnd = addDays(nextPeriodStart, avgPeriod - 1);
  const ovulationDate = addDays(nextPeriodStart, -lutealLength);
  const fertileStart = addDays(ovulationDate, -5);
  const fertileEnd = addDays(ovulationDate, 1);

  const std = stats.stdCycle != null ? stats.stdCycle : Infinity;
  const count = stats.count;
  const irregular = std > 7 || count < 2;

  let confidence = 'low';
  if (count >= 3 && std <= 3) confidence = 'high';
  else if (count >= 2 && std <= 7) confidence = 'medium';

  const futurePeriods = [];
  for (let i = 0; i < 3; i++) {
    const start = addDays(nextPeriodStart, i * avgCycle);
    futurePeriods.push({ start, end: addDays(start, avgPeriod - 1) });
  }

  return {
    nextPeriodStart,
    nextPeriodEnd,
    ovulationDate,
    fertileStart,
    fertileEnd,
    avgCycle,
    avgPeriod,
    irregular,
    confidence,
    overdueDays,
    futurePeriods
  };
}
