// js/content/hormones.js — daily hormone insight content. Owner: Agent S (V2).
// Pure content module: no DB, no dates. Curated windows scaled to the user's
// actual cycle. Warm, supportive, non-diagnostic. Hormone arcs are the
// textbook shape: FSH rises across the period to recruit a follicle, estrogen
// climbs through the follicular phase to a peak that triggers the LH surge
// (~1 day before ovulation), then progesterone rises after ovulation, peaks
// mid-luteal alongside a second smaller estrogen peak, and both fall into PMS.
// Levels are one of: 'low' | 'rising' | 'peak' | 'falling'.

function win(title, body, estrogen, progesterone, lh, fsh) {
  return { title, body, levels: { estrogen, progesterone, lh, fsh } };
}

// ctx = { avgCycle, avgPeriod, ovulationDay, phase }
export function dailyInsight(cycleDay, ctx) {
  const day = Number(cycleDay);
  if (!Number.isFinite(day) || day < 1) return null;

  const c = ctx || {};
  const avgCycle = Math.max(15, Math.min(60, Number(c.avgCycle) || 28));
  const avgPeriod = Math.max(1, Math.min(10, Number(c.avgPeriod) || 5));
  let ovu = Number(c.ovulationDay);
  if (!Number.isFinite(ovu) || ovu < avgPeriod + 2 || ovu > avgCycle) {
    ovu = Math.max(avgPeriod + 2, avgCycle - 14);
  }

  // ---- 12 curated windows, most specific first ----

  // 1. Overdue — past the expected cycle length.
  if (day > avgCycle) {
    return win(
      'The waiting game \u{1F90D}',
      'Your cycle is running a little long — totally common, and stress, travel or sleep can nudge things. Estrogen and progesterone are sitting low while your body decides its next move, so be extra gentle with yourself today.',
      'low', 'falling', 'low', 'rising');
  }

  // 2. LH surge day — the day before ovulation.
  if (day === ovu - 1) {
    return win(
      'LH surge day ⚡',
      'Your estrogen peak has just flipped the switch: LH is surging right now, the hormonal green light for ovulation within about a day. Many people feel magnetic, chatty and full of spark today — enjoy the glow.',
      'peak', 'low', 'peak', 'peak');
  }

  // 3. Ovulation day.
  if (day === ovu) {
    return win(
      'Ovulation day \u{1FAB7}',
      'The egg makes its grand exit today — the main event of your cycle. The LH surge is easing off and estrogen dips while progesterone starts warming up; a tiny twinge on one side (mittelschmerz) is normal for some.',
      'falling', 'rising', 'falling', 'falling');
  }

  // 4. Early period (days 1–2).
  if (day <= 2) {
    return win(
      'Fresh start \u{1F338}',
      'Day ' + day + ' — estrogen and progesterone are at their lowest, which is exactly what tells your body to begin your period. Low-energy, cosy vibes are completely normal; warmth, rest and iron-rich food are your friends.',
      'low', 'low', 'low', 'rising');
  }

  // 5. Late period (day 3 to end of bleed).
  if (day <= avgPeriod) {
    return win(
      'Turning the corner \u{1F337}',
      'Your period is winding down and FSH has been quietly recruiting this cycle’s follicles, so estrogen is starting to creep back up. Many people feel the fog lift around now — a gentle lightness returning.',
      'rising', 'low', 'low', 'rising');
  }

  // 6. PMS window — final ~3 days of the cycle.
  if (day >= avgCycle - 2) {
    return win(
      'PMS window \u{1F9F8}',
      'Estrogen and progesterone are both dropping fast as your body preps for a new cycle — the classic recipe for PMS moods, cravings and tender everything. None of it is you being "too much"; it’s chemistry, and it passes.',
      'low', 'falling', 'low', 'rising');
  }

  // 7. Fertile approach / late follicular — the few days before the surge.
  if (day >= ovu - 4 && day < ovu - 1) {
    return win(
      'Estrogen’s big moment \u{1F4AB}',
      'Estrogen is racing toward its highest peak of the whole cycle, and it tends to bring glowy skin, energy and confidence along for the ride. You’re in your fertile window now, so heads up if that matters to you.',
      'peak', 'low', 'rising', 'rising');
  }

  // Split what's left of the follicular stretch into early/mid halves.
  const folStart = avgPeriod + 1;
  const folEnd = Math.max(folStart, ovu - 5);
  const folMid = folStart + Math.floor((folEnd - folStart) / 2);

  // 8. Early follicular.
  if (day <= folMid) {
    return win(
      'Springtime energy \u{1F331}',
      'Welcome to your inner spring: estrogen is climbing day by day, gently boosting mood, focus and stamina. FSH did its recruiting job and is easing off — this is a lovely window for plans, workouts and new ideas.',
      'rising', 'low', 'low', 'falling');
  }

  // 9. Mid follicular.
  if (day < ovu - 4) {
    return win(
      'Building your glow ✨',
      'Estrogen keeps rising as your lead follicle grows, and with it often comes sharper thinking and a sunnier outlook. Your body is quietly building toward ovulation — ride the momentum while it’s here.',
      'rising', 'low', 'low', 'low');
  }

  // 10. Early luteal — the 3 days after ovulation.
  if (day <= ovu + 3) {
    return win(
      'The handover \u{1F49B}',
      'The corpus luteum (the follicle’s second act) has started making progesterone, your warm, calming, slightly sleepy hormone. Estrogen dipped after its peak and will drift back up soon — a soft, settling few days.',
      'falling', 'rising', 'low', 'low');
  }

  // 11. Mid luteal — progesterone's peak, estrogen's second smaller rise.
  if (day <= ovu + 9) {
    return win(
      'Peak cosy \u{1F9F6}',
      'Progesterone is at its peak and estrogen is enjoying a second, smaller rise — the classic mid-luteal duet. You might notice a warmer body temperature, a bigger appetite and a pull toward comfort; all by design.',
      'rising', 'peak', 'low', 'low');
  }

  // 12. Late luteal — the slide toward the next period.
  return win(
    'Winding down \u{1F30A}',
    'With no pregnancy signal, the corpus luteum is retiring, so progesterone and estrogen are both sliding downhill. Energy naturally dips here — swap the hustle for softer plans and give yourself full permission to slow down.',
    'falling', 'falling', 'low', 'low');
}

/* =====================================================================
   V3 — hormoneCurves(): physiologically shaped, normalised 0–1 curves
   ---------------------------------------------------------------------
   Built from smooth analytic bumps (gaussian / logistic), never from a
   lookup table, so the shapes scale to ANY cycle length and ovulation
   day. Shapes follow the standard textbook picture:
     E2  — slow follicular climb to the highest peak of the cycle ~2 days
           before ovulation, a sharp post-ovulatory drop, then a smaller
           mid-luteal rise from the corpus luteum, withdrawing at the end.
     LH  — flat baseline, then a narrow, sharp surge peaking the day
           before ovulation (~48h from onset to ovulation).
     P4  — near-zero until ovulation, then a broad luteal dome peaking
           mid-luteal, collapsing in the last days (luteolysis).
     FSH — modest early-follicular rise (follicle recruitment), a small
           ovulatory blip alongside the LH surge, and the inter-cycle
           rise as E2/P4 withdraw at the very end.
   Each series is scaled so its own maximum is 1 (baselines stay above 0,
   which is the physiological truth — nothing ever reaches literal zero).
   ===================================================================== */

function gauss(x, mu, sigma) {
  const s = sigma > 0.0001 ? sigma : 0.0001;
  const z = (x - mu) / s;
  return Math.exp(-0.5 * z * z);
}

// Gaussian with a different width either side of the peak (rise vs fall).
function asymGauss(x, mu, sigmaLeft, sigmaRight) {
  return gauss(x, mu, x < mu ? sigmaLeft : sigmaRight);
}

function logistic(x, mid, k) {
  const kk = k > 0.0001 ? k : 0.0001;
  return 1 / (1 + Math.exp(-(x - mid) / kk));
}

function normalise(arr) {
  let max = 0;
  for (const v of arr) if (v > max) max = v;
  if (!(max > 0)) return arr.map(() => 0);
  return arr.map((v) => Math.round((v / max) * 10000) / 10000);
}

// hormoneCurves(avgCycle, ovulationDay)
// -> { days:[1..n], e2:[…], p4:[…], lh:[…], fsh:[…] } all 0–1, length n.
export function hormoneCurves(avgCycle, ovulationDay) {
  const n = Math.max(15, Math.min(60, Math.round(Number(avgCycle)) || 28));

  let ovu = Math.round(Number(ovulationDay));
  if (!Number.isFinite(ovu)) ovu = n - 14;
  ovu = Math.max(4, Math.min(n - 1, ovu));

  const luteal = Math.max(4, n - ovu);      // days from ovulation to cycle end
  const follicular = Math.max(3, ovu - 1);  // days before ovulation
  const fScale = follicular / 13;           // 1.0 for a textbook 28-day cycle
  const lScale = luteal / 14;

  const days = [];
  const e2 = [];
  const p4 = [];
  const lh = [];
  const fsh = [];

  for (let d = 1; d <= n; d += 1) {
    const x = d;

    // Withdrawal gate: everything luteal collapses over the last ~2 days.
    const endGate = 1 - logistic(x, n - 1.2, 0.55 * lScale);

    // --- Oestradiol -------------------------------------------------
    // Slow climb (wide left tail) to the pre-ovulatory peak at ovu−2,
    // then a fast fall; plus the smaller mid-luteal shoulder.
    const e2Peak = 1.00 * asymGauss(x, ovu - 2, 3.0 * fScale, 1.6 * lScale);
    const e2Luteal = 0.45 * gauss(x, ovu + 0.5 * luteal, 0.30 * luteal) * endGate;
    e2.push(0.06 + e2Peak + e2Luteal);

    // --- Progesterone ----------------------------------------------
    // Silent until the corpus luteum forms, then a broad dome peaking
    // just past mid-luteal, ending in luteolysis.
    const p4Dome = asymGauss(x, ovu + 0.45 * luteal, 0.22 * luteal, 0.30 * luteal);
    const p4Gate = logistic(x, ovu + 1, 0.8 * lScale);
    p4.push(0.03 + 1.00 * p4Dome * p4Gate * endGate);

    // --- LH ----------------------------------------------------------
    // A narrow spike the day before ovulation; width is roughly fixed in
    // real time (~48h), so it is deliberately not scaled to cycle length.
    lh.push(0.07 + 1.00 * asymGauss(x, ovu - 1, 1.0, 0.75));

    // --- FSH ---------------------------------------------------------
    const fshEarly = 0.85 * gauss(x, 2.5, 2.6 * fScale);
    const fshBlip = 0.50 * gauss(x, ovu - 1, 1.1);
    const fshInter = 0.50 * logistic(x, n - 1.0, 0.7 * lScale); // inter-cycle rise
    fsh.push(0.20 + fshEarly + fshBlip + fshInter);

    days.push(d);
  }

  return {
    days,
    e2: normalise(e2),
    p4: normalise(p4),
    lh: normalise(lh),
    fsh: normalise(fsh)
  };
}

/* =====================================================================
   V3 — whyYouFeel(): the physiology behind today, in plain words.
   14 day-windows, most specific first. Textbook-accurate, non-diagnostic.
   ===================================================================== */

function why(headline, body, facts) {
  return { headline, body, facts };
}

// whyYouFeel(cycleDay, ctx) where ctx = { avgCycle, avgPeriod, ovulationDay, phase }
// -> { headline, body, facts:[3–5] }
export function whyYouFeel(cycleDay, ctx) {
  const day = Number(cycleDay);
  if (!Number.isFinite(day) || day < 1) return null;

  const c = ctx || {};
  const avgCycle = Math.max(15, Math.min(60, Number(c.avgCycle) || 28));
  const avgPeriod = Math.max(1, Math.min(10, Number(c.avgPeriod) || 5));
  let ovu = Number(c.ovulationDay);
  if (!Number.isFinite(ovu) || ovu < avgPeriod + 2 || ovu > avgCycle) {
    ovu = Math.max(avgPeriod + 2, avgCycle - 14);
  }

  // 1. Overdue.
  if (day > avgCycle) {
    return why(
      'A cycle taking its time',
      'You are past your usual length, which is far more ordinary than it feels. Ovulation is the moveable part of a cycle — illness, travel, short sleep or a stressful fortnight can delay the LH surge, and the luteal phase afterwards stays stubbornly close to two weeks. Your hormones are simply waiting for the signal.',
      [
        'Cycle length varies mostly because ovulation timing varies; the luteal phase is comparatively fixed at ~11–16 days.',
        'Stress raises cortisol and CRH, which can suppress the GnRH pulses that trigger the LH surge.',
        'Oestrogen and progesterone are both low right now — the quiet before a new follicular wave.',
        'A late period after a delayed ovulation is a normal cycle, not a missed one.'
      ]);
  }

  // 2. Day 1 — the withdrawal.
  if (day === 1) {
    return why(
      'The withdrawal',
      'Yesterday your corpus luteum finished its work, and progesterone and oestrogen fell away together. That fall is the whole instruction: without progesterone holding it, the lining releases prostaglandins, the spiral arteries constrict and the uterus begins to shed. Everything you feel today follows from one absence.',
      [
        'Progesterone withdrawal — not a rise in anything — is what starts a period.',
        'Prostaglandin F2α makes the myometrium contract; strong contractions are felt as cramps.',
        'The same prostaglandins reach the nearby bowel, which is why day one often comes with loose stools or nausea.',
        'Oestrogen is at its lowest of the entire cycle, so serotonin support is at its thinnest — low mood today is chemistry, not character.'
      ]);
  }

  // 3. Day 2 — usually the heaviest.
  if (day === 2) {
    return why(
      'Day two, the heavy hour',
      'For most people day two is the peak of the whole bleed, and the peak of the cramping with it — prostaglandin concentrations in menstrual fluid are highest in the first 48 hours. If you have a copper IUD, it amplifies exactly this step: it provokes a local inflammatory response in the endometrium, which typically means more prostaglandins, heavier flow and sharper cramps.',
      [
        'Endometrial prostaglandin release peaks in the first two days of bleeding.',
        'Copper IUDs commonly increase menstrual blood loss and cramping, especially in the first year.',
        'Iron leaves with the blood — pairing iron-rich food with vitamin C improves absorption several-fold.',
        'Heat on the abdomen relaxes uterine smooth muscle and measurably reduces cramp pain.',
        'Oestrogen and progesterone are both floor-level; FSH has already begun recruiting the next follicles.'
      ]);
  }

  // 4. Rest of the bleed.
  if (day <= avgPeriod) {
    return why(
      'The tide going out',
      'The heaviest part is behind you. Beneath the bleeding, FSH has been quietly recruiting a cohort of follicles, and the small amount of oestradiol they already make is enough to start rebuilding the lining. Most people feel the fog thin around now — that is oestrogen coming back into the room.',
      [
        'FSH rises across the bleed to recruit an antral follicle cohort.',
        'Endometrial repair begins while you are still bleeding, driven by early oestradiol.',
        'Prostaglandin levels drop after the first 48 hours, so cramps usually soften.',
        'Rising oestrogen supports serotonin and dopamine signalling — the returning lightness is real.'
      ]);
  }

  // 5. PMS window — final three days.
  if (day >= avgCycle - 2) {
    return why(
      'The steep descent',
      'Your corpus luteum has stopped, and progesterone and oestrogen are falling faster now than at any other point in the cycle. The brain does not mind low hormones nearly as much as it minds the speed of the drop: allopregnanolone, progesterone’s calming metabolite, is withdrawing from the same GABA receptors it has been soothing for a fortnight. Irritability, tears, cravings, a body that feels a size larger — all of it is a withdrawal, and all of it lifts.',
      [
        'PMS symptoms track the rate of hormone withdrawal, not the absolute levels.',
        'Allopregnanolone acts on GABA-A receptors; its loss unsettles mood and sleep.',
        'Falling oestrogen lowers serotonin availability, which is why carbohydrate cravings spike.',
        'Fluid shifts and breast tenderness are hormonal, not weight gain, and resolve within days.',
        'Symptoms characteristically stop within a day or two of bleeding starting.'
      ]);
  }

  // 6. LH surge day — the day before ovulation.
  if (day === ovu - 1) {
    return why(
      'The switch flips',
      'Your dominant follicle has been pouring out oestradiol, and once that level stays high for roughly two days the brain does something it does nowhere else: it flips oestrogen’s feedback from negative to positive. The pituitary answers with a sudden flood of LH. This is the sharpest, briefest hormonal event of your month, and many people feel it as pure voltage — talkative, magnetic, wide awake.',
      [
        'Sustained high oestradiol (~48h) converts negative feedback into positive feedback at the hypothalamus and pituitary.',
        'Ovulation follows about 24–36 hours after the surge begins, and ~10–12 hours after the LH peak.',
        'Cervical mucus is at its clearest and most stretchy under peak oestrogen.',
        'Testosterone also rises modestly around now, adding to the libido lift.'
      ]);
  }

  // 7. Ovulation day.
  if (day === ovu) {
    return why(
      'Release',
      'The follicle wall thins, enzymes digest the last of it, and the egg is released — the single event the whole first half of your cycle was building toward. Oestrogen dips briefly with the rupture while the emptied follicle reorganises itself into the corpus luteum and starts making progesterone. A one-sided ache today has a name: mittelschmerz.',
      [
        'Ovulation is a genuinely inflammatory, enzymatic rupture — hence the twinge some people feel.',
        'The follicle becomes the corpus luteum and switches production from oestrogen to progesterone.',
        'Basal body temperature rises 0.3–0.5 °C in the day or two after ovulation, from progesterone acting on the hypothalamus.',
        'A little clear or blood-tinged mucus around ovulation is normal.'
      ]);
  }

  // 8. Glow window — the days of the oestrogen peak.
  if (day >= ovu - 4 && day < ovu - 1) {
    return why(
      'Oestrogen at its golden hour',
      'Your dominant follicle is at full production and oestradiol is climbing to the highest concentration it will reach all cycle. Oestrogen is quietly cosmetic: it supports dermal collagen and hyaluronic acid, so skin holds water and light differently this week. It also sharpens verbal fluency and social confidence. You are not imagining the difference in the mirror.',
      [
        'Oestrogen stimulates fibroblast collagen synthesis and skin hydration.',
        'Peak oestradiol is the highest hormone concentration of the cycle by a wide margin.',
        'Insulin sensitivity and pain tolerance both tend to be at their best in the late follicular phase.',
        'Libido rises here through oestrogen and a small mid-cycle testosterone bump.'
      ]);
  }

  // The remaining follicular stretch, split in half.
  const folStart = avgPeriod + 1;
  const folEnd = Math.max(folStart, ovu - 5);
  const folMid = folStart + Math.floor((folEnd - folStart) / 2);

  // 9. Early follicular.
  if (day <= folMid) {
    return why(
      'Building again',
      'Bleeding is done and the lining is regenerating from its basal layer under rising oestradiol — several millimetres of new tissue over the next fortnight. Meanwhile a cohort of follicles is competing, each making a little oestrogen. Energy, mood and stamina climb roughly in step with that curve.',
      [
        'This is the proliferative phase: oestrogen drives endometrial regrowth.',
        'FSH is easing off as oestradiol feeds back negatively on the pituitary.',
        'Oestrogen increases serotonin receptor density and BDNF — the lift in mood is measurable.',
        'Strength and recovery tend to be favourable in the first half of the cycle.'
      ]);
  }

  // 10. Mid follicular.
  if (day < ovu - 4) {
    return why(
      'One follicle wins',
      'Somewhere around now a single follicle is selected: it becomes the most FSH-sensitive of the cohort and thrives even as falling FSH starves its rivals, which quietly regress. Its oestradiol output starts to climb steeply. This is the most steadily capable stretch of many people’s month.',
      [
        'Dominant follicle selection happens in the mid-follicular phase; the rest undergo atresia.',
        'Oestradiol rises exponentially from here to its pre-ovulatory peak.',
        'Progesterone is essentially absent, so body temperature sits at its cycle low.',
        'Verbal memory and mood generally track rising oestrogen.'
      ]);
  }

  // 11. Early luteal.
  if (day <= ovu + 3) {
    return why(
      'The handover',
      'The corpus luteum is up and running, and progesterone is the hormone of the next fortnight. It is thermogenic, so your baseline temperature has stepped up; it is sedating, because its metabolite allopregnanolone calms GABA receptors; and it relaxes smooth muscle everywhere, including the gut. Slower, warmer, softer is exactly on schedule.',
      [
        'The corpus luteum secretes progesterone for ~11–16 days unless pregnancy signals it to continue.',
        'Progesterone raises basal body temperature via the hypothalamus — the classic biphasic chart.',
        'Allopregnanolone is a positive modulator of GABA-A receptors: calm, sometimes drowsy.',
        'Smooth-muscle relaxation slows gut transit, so bloating and constipation are common now.'
      ]);
  }

  // 12. Mid luteal.
  if (day <= ovu + 9) {
    return why(
      'The warm plateau',
      'Progesterone is at its cycle peak, joined by a second, smaller oestrogen rise — the mid-luteal duet, and the window where a pregnancy would implant. Appetite genuinely increases in the luteal phase, resting metabolic rate ticks up, and breasts feel fuller because progesterone stimulates the milk ducts. Your body is running warm and provisioned.',
      [
        'Progesterone peaks around 7 days after ovulation (day ~21 of a 28-day cycle).',
        'Luteal resting energy expenditure rises modestly — the extra hunger is real, not weakness.',
        'Oestrogen makes a second, smaller rise from the corpus luteum.',
        'Progesterone stimulates breast alveolar tissue, causing fullness and tenderness.',
        'Body temperature stays elevated for as long as the corpus luteum lives.'
      ]);
  }

  // 13. Late luteal.
  return why(
    'Luteolysis',
    'With no embryo sending hCG, the corpus luteum has begun to dismantle itself on its own timetable. Progesterone and oestrogen are both sliding, and the nervous system notices the change before the calendar does: sleep fragments, patience thins, water is held. Nothing is going wrong — this is a scheduled retirement, and the fall itself is what will start your next period.',
    [
      'Without hCG the corpus luteum regresses about 10–12 days after ovulation.',
      'Falling progesterone means falling allopregnanolone — restlessness and lighter sleep follow.',
      'Declining oestrogen reduces serotonin support, tilting mood and appetite.',
      'Fluid retention here is hormonal, transient, and not fat gain.'
    ]);
}
