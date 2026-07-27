// js/content/meals.js — phase-aware food suggestions. Owner: Agent D (V3).
// Pure content module: no DB, no dates, no network. Whole foods only, high
// fibre, gut-friendly (fermented foods, prebiotics, a wide diversity of
// plants), with the mechanism spelled out for every suggestion.
//
// Frozen contract:
//   mealsFor(phase, cycleDay) -> {
//     phaseLabel, why,
//     nutrients: [{ name, why }],
//     meals:     { breakfast, lunch, dinner, snack },   // dish strings
//     mealWhys:  { breakfast, lunch, dinner, snack },   // additive extra
//     gutNote                                            // additive extra
//   }
// `meals` values stay plain strings so the frozen contract is untouched;
// the per-dish reasoning rides alongside in `mealWhys`.
//
// Food suggestions, not medical nutrition therapy.

const m = (dish, why) => ({ dish, why });

const PHASES = {
  /* ------------------------------------------------------------------ */
  menstrual: {
    phaseLabel: 'Menstrual — replenish',
    why: 'You are losing blood and, with it, iron. This is the week to eat for restock and calm: iron always alongside vitamin C, omega-3 fats to soften the prostaglandin storm that drives cramping, and warm, gently cooked food that a sensitive gut can handle. If you have a copper IUD, a heavier bleed is common — which makes the iron habit matter even more.',
    gutNote: 'Prostaglandins act on bowel muscle as well as uterine muscle — cooked, warm and soluble-fibre-rich food is kinder than a big raw salad today.',
    nutrients: [
      { name: 'Iron', why: 'Menstrual blood loss depletes iron stores; plant (non-haem) iron needs help to be absorbed.' },
      { name: 'Vitamin C', why: 'Eaten in the same meal it can multiply non-haem iron absorption several-fold — a squeeze of lemon is doing real work.' },
      { name: 'Omega-3', why: 'EPA and DHA compete with arachidonic acid, nudging your body toward less inflammatory prostaglandins and gentler cramps.' },
      { name: 'Magnesium', why: 'Helps uterine and skeletal muscle relax, and is easily topped up with cocoa, seeds and wholegrains.' }
    ],
    slots: {
      breakfast: [
        m('Porridge with berries, pumpkin seeds and a spoon of blackstrap molasses', 'Oat beta-glucan is a prebiotic that feeds your gut bacteria; the seeds and molasses carry iron, and the berries supply the vitamin C that unlocks it.'),
        m('Kefir bowl with grated pear, ground flaxseed and walnuts', 'Kefir delivers live cultures while pear pectin feeds them; flax and walnuts add the omega-3s that quiet cramp-driving prostaglandins.'),
        m('Scrambled eggs with wilted spinach on rye sourdough, tomatoes alongside', 'Spinach iron plus tomato vitamin C is the classic pairing, and slow-fermented rye is easier on a day-two stomach than fast bread.'),
        m('Buckwheat pancakes with stewed apple, cinnamon and live yoghurt', 'Buckwheat brings iron and fibre, cooked apple pectin is soothing and prebiotic, and the yoghurt tops up both calcium and cultures.')
      ],
      lunch: [
        m('Golden lentil and spinach dahl with lemon and brown rice', 'Lentils and spinach are iron-dense; the lemon squeezed in at the end converts that iron into a far more absorbable form, and turmeric is mildly anti-inflammatory.'),
        m('Warm quinoa with roast beetroot, chickpeas, parsley and orange', 'Beetroot nitrates support blood flow, chickpeas add iron and resistant starch, and parsley and orange bring the vitamin C.'),
        m('Sardines on wholegrain toast with rocket and lemon', 'Possibly the perfect day-two plate: haem iron (the most absorbable kind), omega-3 EPA and DHA, and calcium, all from one tin.'),
        m('Miso and tofu soup with pak choi, ginger and soba noodles', 'Warm fermented broth is gentle when cramps have unsettled your gut; tofu and greens give iron, and ginger has real evidence behind it for period pain.')
      ],
      dinner: [
        m('Slow-cooked beef and root vegetable stew with pearl barley', 'Haem iron from red meat absorbs better than any plant source, and barley beta-glucan keeps the fibre high while everything stays soft and warm.'),
        m('Baked salmon with roast sweet potato and garlicky kale', 'Salmon omega-3s temper the inflammatory cascade behind cramps, while kale layers iron, calcium and vitamin C on the same fork.'),
        m('Black bean and sweet potato chilli with lime and coriander', 'Beans give iron plus resistant starch that ferments into butyrate for your gut lining; the lime at the table maximises iron uptake.'),
        m('Mackerel with warm puy lentils, roast peppers and watercress', 'Oily fish, pulses and peppers together cover omega-3, iron and vitamin C in a single dish.')
      ],
      snack: [
        m('Dark chocolate (70%+) with dried apricots and almonds', 'Cocoa and apricots both carry iron and magnesium, and the nut fat and fibre keep blood sugar steady through the afternoon.'),
        m('A small glass of kefir with a satsuma', 'Live cultures for the microbiome, vitamin C to help this morning’s iron find its way in.'),
        m('Pumpkin seeds and a kiwi', 'Pumpkin seeds are among the richest plant sources of iron, zinc and magnesium; kiwi is denser in vitamin C than orange.'),
        m('Oatcakes with hummus and a warm ginger-lemon tea', 'Slow carbohydrate and chickpea fibre steady energy, and ginger is a well-studied comfort for cramping.')
      ]
    }
  },

  /* ------------------------------------------------------------------ */
  follicular: {
    phaseLabel: 'Follicular — build',
    why: 'Oestrogen is climbing and your body is rebuilding the lining it just shed. Feed the build: fermented foods and diverse plants for the gut bacteria that will later help clear spent oestrogen, cruciferous vegetables that support the liver pathways doing that clearing, and sprouted or wholegrain carbohydrate for the energy this phase is good at using.',
    gutNote: 'Your gut microbes (the "estrobolome") help decide how much used oestrogen leaves the body versus gets reabsorbed — fibre diversity and fermented food are the levers you actually hold.',
    nutrients: [
      { name: 'Fermented foods', why: 'Live cultures in kefir, sauerkraut, kimchi and miso support a microbiome that handles oestrogen metabolism more evenly.' },
      { name: 'Cruciferous veg', why: 'Broccoli, cabbage and their cousins supply sulforaphane and indole-3-carbinol, which support liver phase-II detoxification of oestrogen.' },
      { name: 'B vitamins', why: 'Wholegrains and pulses fuel the methylation reactions your liver uses to package hormones for disposal.' },
      { name: 'Diverse plants', why: 'Thirty different plants a week is the single best-evidenced target for microbiome diversity — every colour counts.' }
    ],
    slots: {
      breakfast: [
        m('Sprouted-grain toast with smashed avocado, sauerkraut and hemp seeds', 'Raw sauerkraut brings live lactobacilli, avocado adds fibre and fat, and sprouting makes the grain’s minerals easier to absorb.'),
        m('Overnight oats with live yoghurt, grated apple, chia and cinnamon', 'Soaking softens the oats and raises resistant starch; apple pectin and chia are prebiotics that feed the cultures in the yoghurt.'),
        m('Tempeh scramble with tomatoes and broccoli sprouts on rye', 'Tempeh is fermented soy, so it comes with both cultures and protein; broccoli sprouts are the most concentrated sulforaphane source there is.'),
        m('Kefir smoothie with frozen berries, spinach, oats and ground flax', 'Four plant families and a live culture in one glass — plus flax lignans, which are gently oestrogen-modulating.')
      ],
      lunch: [
        m('Roast broccoli, butter bean and lemon-tahini grain bowl', 'Cruciferous compounds support oestrogen clearance while butter beans and wholegrain deliver the slow carbohydrate this phase burns well.'),
        m('Kimchi rice bowl with edamame, cucumber and sesame', 'Kimchi is fermented cruciferous — cultures and sulforaphane precursors in the same forkful.'),
        m('Sprouted lentil and shaved cabbage slaw with herby yoghurt dressing', 'Sprouted pulses are easier to digest and higher in available minerals; raw cabbage is at its most enzyme-active.'),
        m('Cauliflower, chickpea and turmeric soup with wholegrain sourdough', 'Cauliflower for the liver, chickpeas for prebiotic fibre, and sourdough’s long fermentation for a gentler blood-sugar curve.')
      ],
      dinner: [
        m('Miso-glazed cod or tofu with pak choi and brown rice', 'Miso is a living ferment, pak choi is cruciferous, and brown rice keeps the fibre up — a quietly perfect follicular plate.'),
        m('Roast chicken thigh with Brussels sprouts, farro and parsley', 'Sprouts are dense in indole-3-carbinol; farro is an ancient wholegrain with more fibre and minerals than modern wheat.'),
        m('Cabbage and white-bean stew with garlic, thyme and olive oil', 'Garlic and onion are prebiotic inulin sources, beans feed butyrate-producing bacteria, and cabbage does the cruciferous work.'),
        m('Tempeh stir-fry with broccoli, red pepper and buckwheat noodles', 'Fermented protein, cruciferous veg and a gluten-free wholegrain — high fibre without heaviness.')
      ],
      snack: [
        m('Carrot and radish sticks with hummus', 'Raw crunch suits this phase, and chickpea fibre is a favourite food of your resident bacteria.'),
        m('Live yoghurt with pumpkin seeds and a little honey', 'Cultures plus seeds gives you probiotic and mineral in one small bowl.'),
        m('Apple slices with almond butter', 'Pectin and almond fibre together slow sugar release and feed the microbiome.'),
        m('Walnuts with a small unsweetened kombucha', 'Walnuts are the nut richest in plant omega-3; kombucha adds another ferment to the week’s tally.')
      ]
    }
  },

  /* ------------------------------------------------------------------ */
  ovulation: {
    phaseLabel: 'Ovulation — protect and clear',
    why: 'Ovulation is a genuinely inflammatory, oxidative event, and oestrogen is at its highest concentration of the whole cycle. Eat colour: antioxidants to buffer the oxidative burst around follicle rupture, zinc for the corpus luteum about to form, and plenty of raw, fibrous plants to carry spent oestrogen out rather than let it be reabsorbed.',
    gutNote: 'Fibre binds oestrogen metabolites in the bowel so they leave rather than recirculate — this is the week raw, crunchy volume pays off most.',
    nutrients: [
      { name: 'Antioxidants', why: 'Follicle rupture generates reactive oxygen species; deeply coloured plants supply the polyphenols that buffer them.' },
      { name: 'Zinc', why: 'Concentrated in the ovary and needed for the corpus luteum that forms straight after ovulation.' },
      { name: 'Fibre', why: 'Binds oestrogen metabolites in the gut so they are excreted instead of reabsorbed.' },
      { name: 'Selenium', why: 'Supports the glutathione peroxidase enzymes that handle oxidative stress; two Brazil nuts is plenty.' }
    ],
    slots: {
      breakfast: [
        m('Berry and beetroot smoothie bowl with pumpkin seeds and cacao nibs', 'Berries and beetroot are two of the highest-polyphenol foods available; pumpkin seeds bring the zinc.'),
        m('Live yoghurt with pomegranate, walnuts and mint', 'Pomegranate punicalagins are potent antioxidants, and your gut bacteria convert them into the forms your body actually uses.'),
        m('Rye toast with ricotta, figs and pistachios', 'Figs add fibre and polyphenols, pistachios add zinc and lutein, and rye keeps the release slow.'),
        m('Bircher oats soaked in orange juice with grated carrot, sunflower seeds and blueberries', 'Vitamin C, carotenoids and anthocyanins in one bowl, over a base of prebiotic oats.')
      ],
      lunch: [
        m('Big raw salad: rocket, fennel, orange, pumpkin seeds, olive oil and lemon', 'Maximum raw fibre for oestrogen clearance, with olive oil polyphenols and pumpkin-seed zinc.'),
        m('Rainbow slaw of red cabbage, carrot, herbs and cashews with lime-tahini', 'Red cabbage anthocyanins plus five plant types; cashews and sesame both carry zinc.'),
        m('Wholegrain wrap with hummus, raw grated beetroot, watercress and sunflower seeds', 'Watercress is remarkably nutrient-dense per calorie, and raw beetroot keeps its nitrates and betalains intact.'),
        m('Gazpacho with wholegrain sourdough and a boiled egg', 'Raw tomato and pepper deliver lycopene and vitamin C; the egg adds zinc and choline.')
      ],
      dinner: [
        m('Grilled prawns or chickpeas with courgette ribbons, tomatoes and basil', 'Shellfish are a top zinc source; a light, colourful plate suits a phase where energy is high and digestion is easy.'),
        m('Seared tuna or tempeh with raw kale-avocado salad, sesame and quinoa', 'Massaged raw kale keeps its glucosinolates; sesame and quinoa add zinc and complete protein.'),
        m('Roast pepper, tomato and butter bean traybake with pumpkin-seed pesto', 'Cooked tomato actually raises lycopene availability, while the seed pesto covers zinc and vitamin E.'),
        m('Beef or lentil kofta with tabbouleh and cucumber-yoghurt', 'Beef and lentils are both strong zinc sources; a parsley-heavy tabbouleh is a herb salad in disguise.')
      ],
      snack: [
        m('Pomegranate seeds with pistachios', 'Polyphenols and zinc, and pleasingly little effort.'),
        m('Two Brazil nuts and a handful of grapes', 'Two Brazil nuts cover a day’s selenium; grape skins carry resveratrol.'),
        m('Raw pepper and carrot sticks with guacamole', 'Vitamin C from the pepper, carotenoids from the carrot, and fat from the avocado to absorb them.'),
        m('Cacao, date and pumpkin-seed energy ball', 'Raw cacao is one of the most polyphenol-dense foods measured, and dates bring the fibre with the sweetness.')
      ]
    }
  },

  /* ------------------------------------------------------------------ */
  luteal: {
    phaseLabel: 'Luteal — steady',
    why: 'Progesterone raises your body temperature, slows gut transit and genuinely increases appetite, while falling oestrogen thins serotonin support toward the end. Steady complex carbohydrate keeps serotonin and blood sugar level, magnesium and B6 support mood and muscle, calcium has real trial evidence for premenstrual symptoms — and going lighter on caffeine and salt in the last few days takes the edge off tenderness and fluid retention.',
    gutNote: 'Progesterone relaxes smooth muscle, so everything moves more slowly now: keep fibre high and water higher, or bloating and constipation fill the gap.',
    nutrients: [
      { name: 'Complex carbs', why: 'Slow carbohydrate helps tryptophan reach the brain, supporting the serotonin that falling oestrogen leaves short.' },
      { name: 'Magnesium', why: 'Relaxes smooth and skeletal muscle and is associated with fewer premenstrual mood and cramp symptoms.' },
      { name: 'Vitamin B6', why: 'A cofactor for making serotonin, dopamine and GABA — the exact neurotransmitters this phase leans on.' },
      { name: 'Calcium', why: 'One of the better-evidenced nutrients for premenstrual symptom relief in randomised trials.' },
      { name: 'Less caffeine and salt', why: 'Both amplify breast tenderness, jitteriness and fluid retention in the premenstrual days.' }
    ],
    slots: {
      breakfast: [
        m('Porridge with banana, peanut butter and a spoon of cocoa', 'Oats give the slow carbohydrate that lifts serotonin, banana brings B6, and cocoa is one of the densest magnesium foods.'),
        m('Buckwheat and banana pancakes with yoghurt and pumpkin seeds', 'Buckwheat is a magnesium-rich pseudo-grain; yoghurt covers calcium and live cultures for a slowed-down gut.'),
        m('Wholegrain toast with mashed avocado, sunflower seeds and a poached egg', 'Avocado and sunflower seeds both carry magnesium and B6; protein at breakfast steadies the whole day’s appetite.'),
        m('Quinoa porridge with almond butter, chopped dates and cinnamon', 'Almonds are magnesium and calcium together, and cinnamon may help smooth the blood-sugar swings behind luteal cravings.')
      ],
      lunch: [
        m('Sweet potato and black bean bowl with kale, avocado and lime yoghurt', 'Sweet potato is the ideal luteal carbohydrate — slow, filling, high fibre — and kale adds calcium alongside beans for magnesium.'),
        m('Wholegrain pasta salad with white beans, spinach, peas and lemon', 'Wholegrain pasta with pulses keeps blood sugar remarkably flat, which is half the battle against premenstrual mood dips.'),
        m('Barley and roast squash salad with feta and pumpkin seeds', 'Barley beta-glucan keeps a sluggish gut moving; feta adds calcium and the seeds add magnesium and zinc.'),
        m('Chickpea, spinach and brown rice soup with lemon', 'Warm, high-fibre and gentle — chickpeas bring B6 as well as fibre, and spinach adds magnesium and calcium.')
      ],
      dinner: [
        m('Baked salmon with mashed sweet potato and steamed greens', 'Omega-3s and B6 from salmon, complex carbohydrate from sweet potato, calcium and magnesium from the greens.'),
        m('Lentil shepherd’s pie with a sweet potato and celeriac top', 'Comfort food that is genuinely fibrous — lentils are a strong source of B6, magnesium and slow carbohydrate.'),
        m('Tofu and greens curry with brown rice', 'Calcium-set tofu is an excellent calcium source, and the rice provides the steady carbohydrate that this phase wants after dark.'),
        m('Chicken or butter-bean casserole with vegetables and wholegrain bread', 'A one-pot with a bean base keeps protein and fibre high while progesterone slows digestion.')
      ],
      snack: [
        m('A square of dark chocolate with a banana', 'The classic craving, made functional: cocoa magnesium and banana B6, with enough fibre to avoid a sugar spike.'),
        m('Live yoghurt with oats, chia and berries', 'Calcium, cultures and soluble fibre — a small bowl that answers both the craving and the constipation.'),
        m('Wholegrain crackers with hummus and cucumber', 'Slow carbohydrate with protein and fibre, and no caffeine anywhere near it.'),
        m('Warm milk or fortified soy with cinnamon and a few almonds', 'Calcium and magnesium before bed, with nothing stimulating in it — luteal sleep is fragile enough already.')
      ]
    }
  },

  /* ------------------------------------------------------------------ */
  general: {
    phaseLabel: 'Everyday — gut-first',
    why: 'No cycle data yet, so this is the reliable baseline: plenty of plants, something fermented every day, and fibre at every meal. A diverse, well-fed microbiome influences everything from oestrogen clearance to mood, and it is built by variety more than by any single food.',
    gutNote: 'Aim for around thirty different plants a week — herbs, seeds, nuts, wholegrains and pulses all count toward the total.',
    nutrients: [
      { name: 'Fibre', why: 'The main food supply for the gut bacteria that produce butyrate, which keeps the gut lining healthy.' },
      { name: 'Fermented foods', why: 'Regular live cultures are one of the few things shown to raise microbiome diversity and lower inflammatory markers.' },
      { name: 'Plant diversity', why: 'Different fibres feed different bacteria; variety beats quantity of any single food.' },
      { name: 'Iron and omega-3', why: 'Worth building into the week regardless of phase when periods are heavy.' }
    ],
    slots: {
      breakfast: [
        m('Overnight oats with live yoghurt, berries and ground flaxseed', 'Prebiotic oats plus probiotic yoghurt is the simplest gut-friendly pairing there is.'),
        m('Rye toast with avocado, sauerkraut and hemp seeds', 'A raw ferment first thing, with fibre and fat to carry it.'),
        m('Kefir smoothie with frozen berries, spinach and oats', 'Four plants and a live culture before you have properly woken up.'),
        m('Eggs with wilted greens and wholegrain toast', 'Protein and fibre together keep appetite and energy level all morning.')
      ],
      lunch: [
        m('Grain bowl with a pulse, three vegetables and a lemon-tahini dressing', 'A template rather than a recipe: rotate the grain, the pulse and the vegetables to keep plant diversity high.'),
        m('Lentil soup with wholegrain sourdough', 'Lentils are one of the highest-fibre foods you can build a habit around.'),
        m('Big salad with chickpeas, seeds, herbs and olive oil', 'Herbs count as plants; a handful of them meaningfully raises your weekly diversity.'),
        m('Miso soup with tofu, greens and brown rice', 'Fermented, warm and fibrous — easy on the gut, kind to the microbiome.')
      ],
      dinner: [
        m('Oily fish with roast vegetables and a wholegrain', 'Two portions of oily fish a week covers omega-3 for the whole cycle.'),
        m('Bean chilli with brown rice, avocado and lime', 'Beans feed butyrate-producing bacteria better than almost anything else on the shelf.'),
        m('Vegetable and butter-bean traybake with garlic and olive oil', 'Garlic and onion are prebiotic inulin sources hiding in plain sight.'),
        m('Stir-fry with tempeh, mixed vegetables and buckwheat noodles', 'Fermented protein and a high plant count in fifteen minutes.')
      ],
      snack: [
        m('Fruit with a handful of nuts', 'Fibre plus fat and protein keeps blood sugar steadier than fruit alone.'),
        m('Live yoghurt with seeds', 'A daily culture habit matters more than any occasional supplement.'),
        m('Vegetable sticks with hummus', 'Raw plants and chickpea fibre, no thought required.'),
        m('Oatcakes with nut butter', 'Slow carbohydrate for the afternoon dip.')
      ]
    }
  }
};

function pick(list, index) {
  const arr = Array.isArray(list) && list.length ? list : [{ dish: '', why: '' }];
  const i = ((index % arr.length) + arr.length) % arr.length;
  return arr[i];
}

// mealsFor(phase, cycleDay)
// phase ∈ 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | null
export function mealsFor(phase, cycleDay) {
  const set = PHASES[phase] || PHASES.general;

  let day = Math.round(Number(cycleDay));
  if (!Number.isFinite(day) || day < 1) day = 1;

  // Offset each slot so the four suggestions do not rotate in lockstep.
  const b = pick(set.slots.breakfast, day - 1);
  const l = pick(set.slots.lunch, day + 0);
  const d = pick(set.slots.dinner, day + 1);
  const s = pick(set.slots.snack, day + 2);

  return {
    phaseLabel: set.phaseLabel,
    why: set.why,
    nutrients: set.nutrients.map((n) => ({ name: n.name, why: n.why })),
    meals: { breakfast: b.dish, lunch: l.dish, dinner: d.dish, snack: s.dish },
    mealWhys: { breakfast: b.why, lunch: l.why, dinner: d.why, snack: s.why },
    gutNote: set.gutNote
  };
}

export { PHASES as MEAL_SETS };
