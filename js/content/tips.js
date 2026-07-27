// js/content/tips.js — daily tips by cycle phase (Agent 5)
// Supportive, evidence-informed wellbeing content. Deliberately NOT medical
// advice: no diagnoses, no treatment claims, gentle signposting only.

export const TIPS = {
  menstrual: [
    {
      title: 'Warmth really helps',
      body: 'A heat pad or warm water bottle on your lower belly can genuinely ease cramps — heat relaxes the uterine muscle. Cosy up guilt-free.'
    },
    {
      title: 'Top up your iron',
      body: 'You lose a little iron while bleeding. Lentils, leafy greens, red meat or fortified cereals — paired with vitamin C — help you restock.'
    },
    {
      title: 'Gentle movement counts',
      body: 'You don’t need a hard workout. A short walk or easy stretching can ease cramps and lift your mood. Listen to your body first.'
    },
    {
      title: 'Rest is productive',
      body: 'Feeling lower-energy in the first days of your period is completely normal. An earlier night is self-care, not laziness.'
    },
    {
      title: 'Keep sipping water',
      body: 'Staying hydrated can take the edge off period headaches and bloating. Keep a bottle nearby and sip through the day.'
    },
    {
      title: 'Your flow tells a story',
      body: 'Logging flow each day builds a picture of what’s normal for you — which makes any change much easier to spot and describe.'
    }
  ],

  follicular: [
    {
      title: 'Energy on the rise',
      body: 'As estrogen climbs after your period, many people feel brighter and sharper. A lovely window for plans that need focus or momentum.'
    },
    {
      title: 'A good time to move',
      body: 'If exercise appeals more this week, ride the wave — energy and recovery often feel easier in this phase. Any movement you enjoy counts.'
    },
    {
      title: 'Feed the rebuild',
      body: 'Your body is rebuilding the uterine lining. Protein, whole grains and colourful veg give it good raw materials.'
    },
    {
      title: 'Soak up some daylight',
      body: 'Morning light helps anchor your sleep rhythm and mood. Even ten minutes outside with a cuppa makes a difference.'
    },
    {
      title: 'Plan the big stuff',
      body: 'Many people find decision-making and socialising feel easier mid-follicular phase. If that’s you, schedule accordingly — your log will show your pattern.'
    },
    {
      title: 'Skin often smiles now',
      body: 'Rising estrogen tends to be kind to skin. Whatever your routine, consistency beats complexity — and hydration helps from the inside too.'
    }
  ],

  ovulation: [
    {
      title: 'Peak fertile window',
      body: 'The days just before and around ovulation are when pregnancy is most likely. Whatever your goals, knowing your window puts you in charge.'
    },
    {
      title: 'Egg-white discharge is normal',
      body: 'Clear, stretchy discharge around now is a classic sign of ovulation — it’s your body doing exactly what it’s designed to do.'
    },
    {
      title: 'A little twinge?',
      body: 'Some people feel a mild one-sided ache around ovulation. It usually passes quickly — persistent or severe pain is worth mentioning to a clinician.'
    },
    {
      title: 'Temperature tells a tale',
      body: 'If you log your waking temperature, look for a small sustained rise after ovulation — over a few cycles it can confirm your pattern.'
    },
    {
      title: 'Feeling magnetic?',
      body: 'Energy, confidence and desire often peak around ovulation. Totally normal — enjoy it, and log it so you can see your own rhythm.'
    },
    {
      title: 'Hydration checkpoint',
      body: 'Mid-cycle is a nice moment for a habit check: water, movement, sleep. Small consistent things carry you into the luteal phase feeling steadier.'
    }
  ],

  luteal: [
    {
      title: 'Be extra kind to yourself',
      body: 'If mood dips or irritability creep in before your period, that’s a real, common hormonal effect — not a character flaw. Lower the bar a little.'
    },
    {
      title: 'Steady carbs, steady mood',
      body: 'Complex carbs like oats, beans and whole grains help keep blood sugar — and mood — on a more even keel this week.'
    },
    {
      title: 'Magnesium-rich comfort',
      body: 'Nuts, seeds, leafy greens and yes, dark chocolate contain magnesium, which some studies link to milder PMS. A tasty experiment either way.'
    },
    {
      title: 'Ease up on salt and caffeine',
      body: 'If bloating or breast tenderness bother you pre-period, going lighter on salt and caffeine for a few days may take the edge off.'
    },
    {
      title: 'Guard your sleep',
      body: 'Sleep can feel lighter in the late luteal phase. A calm wind-down and a cooler room help — your body temperature runs slightly higher now.'
    },
    {
      title: 'Movement as mood medicine',
      body: 'Gentle exercise is one of the better-supported ways to soften PMS symptoms. A walk counts. Dancing round the kitchen counts double.'
    }
  ],

  general: [
    {
      title: 'Little logs, big picture',
      body: 'Even 20 seconds of logging a day adds up to a genuinely useful picture of your cycle within two or three months. Future you says thanks.'
    },
    {
      title: 'There’s no one “normal”',
      body: 'Cycles between about 21 and 35 days are common, and some variation month to month is expected. Your own pattern is the best baseline.'
    },
    {
      title: 'Know when to check in',
      body: 'Very heavy bleeding, severe pain, or a big change from your usual pattern deserve a chat with a doctor or nurse. You know your body best — trust that.'
    },
    {
      title: 'Sleep is cycle care',
      body: 'A regular sleep rhythm supports the hormones that run your cycle. Consistency matters more than perfection.'
    },
    {
      title: 'Your data stays yours',
      body: 'Everything you log lives only on this device — no cloud, no account, no sharing. Export a backup now and then to keep it safe.'
    },
    {
      title: 'Notes are gold',
      body: 'A quick note — stress, travel, illness, a new pill — often explains a cycle that looks odd later. Jot it down while you remember.'
    }
  ]
};

/**
 * Pick a tip for the given phase, rotating deterministically by cycle day so
 * the tip is stable within a day but changes across the cycle.
 * phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | null
 * Returns {title, body} (never throws; falls back to general tips).
 */
export function tipFor(phase, cycleDay) {
  const pool = (phase && TIPS[phase]) ? TIPS[phase] : TIPS.general;
  if (!pool.length) return null;
  let seed;
  if (Number.isFinite(cycleDay) && cycleDay > 0) {
    seed = Math.floor(cycleDay);
  } else {
    // No cycle info yet — still rotate day-to-day so content feels alive.
    seed = new Date().getDate();
  }
  return pool[seed % pool.length];
}
