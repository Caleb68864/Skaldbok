// Values mechanically copied from tables.py in SCALDBUCK_PROMPT.yaml.
// Keep wording in sync with that source; code labels which ruleset supplies it.

export const EHEX = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ" as const;

export const STARPORT = {
  "A": {
    "quality": "Excellent",
    "berthing": "1D x Cr1000/week",
    "fuel": "Refined (Cr500/t)",
    "facilities": "Shipyard (all), Repair",
    "highport": "Highport likely (6+)",
    "tpl": "A · ref · 1D×1k"
  },
  "B": {
    "quality": "Good",
    "berthing": "1D x Cr500/week",
    "fuel": "Refined (Cr500/t)",
    "facilities": "Shipyard (spacecraft), Repair",
    "highport": "Highport possible (8+)",
    "tpl": "B · ref · 1D×500"
  },
  "C": {
    "quality": "Routine",
    "berthing": "1D x Cr100/week",
    "fuel": "Unrefined only (Cr100/t, risky to jump on)",
    "facilities": "Shipyard (small craft), Repair",
    "highport": "Highport unlikely (10+)",
    "tpl": "C · unref · 1D×100"
  },
  "D": {
    "quality": "Poor",
    "berthing": "1D x Cr10/week",
    "fuel": "Unrefined only (Cr100/t, risky to jump on)",
    "facilities": "Limited repair (Hull damage only)",
    "highport": "Highport rare (12+)",
    "tpl": "D · unref · 1D×10"
  },
  "E": {
    "quality": "Frontier",
    "berthing": "free",
    "fuel": "None",
    "facilities": "None - a beacon on bedrock",
    "highport": "No highport",
    "tpl": "E · none · free"
  },
  "X": {
    "quality": "No starport",
    "berthing": "n/a",
    "fuel": "None",
    "facilities": "None",
    "highport": "No highport",
    "tpl": "X · none"
  }
} as const;

export const SIZE = {
  "0": [
    "<1,000 km",
    "negligible",
    "asteroid / orbital complex"
  ],
  "1": [
    "1,600 km",
    "0.05",
    "Triton"
  ],
  "2": [
    "3,200 km",
    "0.15",
    "Luna, Europa"
  ],
  "3": [
    "4,800 km",
    "0.25",
    "Mercury, Ganymede"
  ],
  "4": [
    "6,400 km",
    "0.35",
    "Mars"
  ],
  "5": [
    "8,000 km",
    "0.45",
    ""
  ],
  "6": [
    "9,600 km",
    "0.7",
    ""
  ],
  "7": [
    "11,200 km",
    "0.9",
    ""
  ],
  "8": [
    "12,800 km",
    "1.0",
    "Earth"
  ],
  "9": [
    "14,400 km",
    "1.25",
    ""
  ],
  "10": [
    "16,000 km",
    "1.4",
    ""
  ]
} as const;

export const ATMOS = {
  "0": [
    "None",
    "0.00",
    "Vacc Suit"
  ],
  "1": [
    "Trace",
    "0.001-0.09",
    "Vacc Suit"
  ],
  "2": [
    "Very Thin, Tainted",
    "0.1-0.42",
    "Respirator + Filter"
  ],
  "3": [
    "Very Thin",
    "0.1-0.42",
    "Respirator"
  ],
  "4": [
    "Thin, Tainted",
    "0.43-0.7",
    "Filter"
  ],
  "5": [
    "Thin",
    "0.43-0.7",
    null
  ],
  "6": [
    "Standard",
    "0.71-1.49",
    null
  ],
  "7": [
    "Standard, Tainted",
    "0.71-1.49",
    "Filter"
  ],
  "8": [
    "Dense",
    "1.5-2.49",
    null
  ],
  "9": [
    "Dense, Tainted",
    "1.5-2.49",
    "Filter"
  ],
  "10": [
    "Exotic",
    "varies",
    "Air Supply"
  ],
  "11": [
    "Corrosive",
    "varies",
    "Vacc Suit"
  ],
  "12": [
    "Insidious",
    "varies",
    "Vacc Suit"
  ],
  "13": [
    "Very Dense",
    "2.5+",
    null
  ],
  "14": [
    "Low",
    "0.5 or less",
    null
  ],
  "15": [
    "Unusual",
    "varies",
    "Varies"
  ]
} as const;

export const ATMOS_NOTE = {
  "2": "Tainted: 1D damage every few minutes (or hours) without a filter.",
  "4": "Tainted: 1D damage every few minutes (or hours) without a filter.",
  "7": "Tainted: 1D damage every few minutes (or hours) without a filter.",
  "9": "Tainted: 1D damage every few minutes (or hours) without a filter.",
  "10": "Exotic: unbreathable but not otherwise hazardous - bring an air supply.",
  "11": "Corrosive: 1D damage EACH ROUND if breathed.",
  "12": "Insidious: attacks equipment; gets past seals/filters after ~2D hours.",
  "13": "Very Dense: unprotected humans can't survive at the surface; highlands may be habitable.",
  "14": "Low: breathable only in lowlands/depressions; high ground is near vacuum.",
  "15": "Unusual: catch-all (ellipsoidal, panthalassic, violent pressure swings) - ask the GM."
} as const;

export const ATMOS_MIN_TL = {
  "0": 8,
  "1": 8,
  "2": 5,
  "3": 5,
  "4": 3,
  "7": 3,
  "9": 3,
  "10": 8,
  "11": 9,
  "12": 10,
  "13": 5,
  "14": 5,
  "15": 8
} as const;

export const HYDRO = {
  "0": [
    "0-5%",
    "Desert world"
  ],
  "1": [
    "6-15%",
    "Dry world"
  ],
  "2": [
    "16-25%",
    "A few small seas"
  ],
  "3": [
    "26-35%",
    "Small seas and oceans"
  ],
  "4": [
    "36-45%",
    "Wet world"
  ],
  "5": [
    "46-55%",
    "A large ocean"
  ],
  "6": [
    "56-65%",
    "Large oceans"
  ],
  "7": [
    "66-75%",
    "Earth-like world"
  ],
  "8": [
    "76-85%",
    "Only a few islands and archipelagos"
  ],
  "9": [
    "86-95%",
    "Almost entirely water"
  ],
  "10": [
    "96-100%",
    "Waterworld"
  ]
} as const;

export const POP = {
  "0": "None",
  "1": "Few",
  "2": "Hundreds",
  "3": "Thousands",
  "4": "Tens of thousands",
  "5": "Hundreds of thousands",
  "6": "Millions",
  "7": "Tens of millions",
  "8": "Hundreds of millions",
  "9": "Billions",
  "10": "Tens of billions",
  "11": "Hundreds of billions",
  "12": "Trillions"
} as const;

export const GOV = {
  "0": [
    "None",
    "No government structure; family bonds predominate",
    []
  ],
  "1": [
    "Company/Corporation",
    "A company managerial elite rules; most citizens are employees or dependants",
    [
      "Weapons",
      "Drugs",
      "Travellers"
    ]
  ],
  "2": [
    "Participating Democracy",
    "Rule by advice and consent of the citizenry directly",
    [
      "Drugs"
    ]
  ],
  "3": [
    "Self-Perpetuating Oligarchy",
    "A restricted minority rules with little input from the masses",
    [
      "Technology",
      "Weapons",
      "Travellers"
    ]
  ],
  "4": [
    "Representative Democracy",
    "Elected representatives rule",
    [
      "Drugs",
      "Weapons",
      "Psionics"
    ]
  ],
  "5": [
    "Feudal Technocracy",
    "Rule by those who perform mutually beneficial technical activities",
    [
      "Technology",
      "Weapons",
      "Computers"
    ]
  ],
  "6": [
    "Captive Government",
    "Imposed leadership answerable to an outside group (colony / conquered)",
    [
      "Weapons",
      "Technology",
      "Travellers"
    ]
  ],
  "7": [
    "Balkanisation",
    "No central authority; rival governments. LAW LEVEL IS THE GOVERNMENT NEAREST THE STARPORT",
    [
      "Varies"
    ]
  ],
  "8": [
    "Civil Service Bureaucracy",
    "Government agencies staffed by experts",
    [
      "Drugs",
      "Weapons"
    ]
  ],
  "9": [
    "Impersonal Bureaucracy",
    "Agencies insulated from the governed citizens",
    [
      "Technology",
      "Weapons",
      "Drugs",
      "Travellers",
      "Psionics"
    ]
  ],
  "10": [
    "Charismatic Dictator",
    "A single leader with the overwhelming confidence of the citizens",
    []
  ],
  "11": [
    "Non-Charismatic Leader",
    "Successor to a charismatic dictator via normal channels",
    [
      "Weapons",
      "Technology",
      "Computers"
    ]
  ],
  "12": [
    "Charismatic Oligarchy",
    "A select group with the overwhelming confidence of the citizenry",
    [
      "Weapons"
    ]
  ],
  "13": [
    "Religious Dictatorship",
    "A religious organisation rules without regard to individual needs",
    [
      "Varies"
    ]
  ],
  "14": [
    "Religious Autocracy",
    "A single religious leader with absolute power",
    [
      "Varies"
    ]
  ],
  "15": [
    "Totalitarian Oligarchy",
    "An all-powerful minority rules through coercion and oppression",
    [
      "Varies"
    ]
  ]
} as const;

export const LAW = {
  "0": [
    "No restrictions - heavy armour and a handy weapon recommended",
    null
  ],
  "1": [
    "Poison gas, explosives, undetectable weapons, WMD",
    "Battle dress"
  ],
  "2": [
    "Portable energy and laser weapons",
    "Combat armour"
  ],
  "3": [
    "Military weapons",
    "Flak"
  ],
  "4": [
    "Light assault weapons and submachine guns",
    "Cloth"
  ],
  "5": [
    "Personal concealable weapons",
    "Mesh"
  ],
  "6": [
    "All firearms except shotguns & stunners; carrying weapons discouraged",
    null
  ],
  "7": [
    "Shotguns",
    null
  ],
  "8": [
    "All bladed weapons, stunners",
    "All visible armour"
  ],
  "9": [
    "ALL weapons",
    "ALL armour"
  ]
} as const;

export const LAW_ENCOUNTERS = [
  [
    "First approach to a planet",
    0,
    "Check"
  ],
  [
    "Offworlders wandering city streets (once/day)",
    0,
    "Check"
  ],
  [
    "Offworlders acting suspiciously",
    -1,
    "Check"
  ],
  [
    "Bar fight",
    -1,
    "Apprehended"
  ],
  [
    "Shots fired",
    -2,
    "Apprehended"
  ],
  [
    "Breaking and entering",
    -2,
    "Investigate"
  ]
] as const;

export const ITEM_BAN_LEVEL = {
  "Laser pistol": 2,
  "Blades": 8,
  "Visible armour (any)": 8,
  "Cloth armour": 4,
  "Mesh armour": 5
} as const;

export const TRADE_MGT = {
  "Ag": [
    "Agricultural",
    "Dedicated to farming and food production; often vast semi-feudal estates"
  ],
  "As": [
    "Asteroid",
    "Usually mining colonies; can be orbital factories or colonies"
  ],
  "Ba": [
    "Barren",
    "Uncolonised and empty"
  ],
  "De": [
    "Desert",
    "Dry and barely habitable"
  ],
  "Fl": [
    "Fluid Oceans",
    "Surface liquid is not water - incompatible with Earth-derived life"
  ],
  "Ga": [
    "Garden",
    "Earth-like"
  ],
  "Hi": [
    "High Population",
    "A population in the billions"
  ],
  "Ht": [
    "High Tech",
    "Among the most technologically advanced in Charted Space"
  ],
  "Ic": [
    "Ice-Capped",
    "Surface liquid mostly frozen in polar caps; cold and dry"
  ],
  "In": [
    "Industrial",
    "Dominated by factories and cities"
  ],
  "Lo": [
    "Low Population",
    "Only a few thousand people or less"
  ],
  "Lt": [
    "Low Tech",
    "Pre-industrial; cannot produce advanced goods"
  ],
  "Na": [
    "Non-Agricultural",
    "Too dry/barren to feed itself conventionally"
  ],
  "Ni": [
    "Non-Industrial",
    "Too few people for an extensive industrial base"
  ],
  "Po": [
    "Poor",
    "Marginal colony - lacking resources, land or people"
  ],
  "Ri": [
    "Rich",
    "Stable government + viable biosphere; an economic powerhouse"
  ],
  "Va": [
    "Vacuum",
    "No atmosphere"
  ],
  "Wa": [
    "Waterworld",
    "Almost entirely water-ocean"
  ]
} as const;

export const TRADE_T5 = {
  "He": "Hellworld",
  "Oc": "Ocean World",
  "Di": "Dieback (population died off)",
  "Ph": "Pre-High Population (Pop 8)",
  "Pa": "Pre-Agricultural",
  "Pi": "Pre-Industrial",
  "Pr": "Pre-Rich",
  "Fr": "Frozen",
  "Ho": "Hot",
  "Co": "Cold",
  "Lk": "Tidally locked",
  "Tr": "Tropic",
  "Tu": "Tundra",
  "Tz": "Twilight zone",
  "Fa": "Farming",
  "Mi": "Mining",
  "Mr": "Military rule",
  "Px": "Prison / exile camp",
  "Pe": "Penal colony",
  "Re": "Reserve",
  "Cp": "Subsector capital",
  "Cs": "Sector capital",
  "Cx": "Capital",
  "Cy": "Colony",
  "Sa": "Satellite (mainworld is a moon of a gas giant)",
  "Fo": "Forbidden (Red Zone)",
  "Pz": "Puzzle (Amber Zone, Pop 7+)",
  "Da": "Danger (Amber Zone, Pop 6-)",
  "Ab": "Data repository",
  "An": "Ancient site",
  "Rs": "Research station",
  "Xb": "X-boat station"
} as const;

export const BASES = {
  "C": [
    "Corsair base",
    "a warning, not a service"
  ],
  "D": [
    "Naval depot",
    "massive Imperial fleet base"
  ],
  "E": [
    "Embassy (Hiver)",
    "T5"
  ],
  "K": [
    "Naval base (non-Imperial)",
    "T5"
  ],
  "M": [
    "Military base",
    "ground troops and vehicles"
  ],
  "N": [
    "Naval base",
    "refined fuel/supplies; navy-surplus gear; ex-Navy contacts; merc work"
  ],
  "R": [
    "Aslan clan base",
    "T5"
  ],
  "S": [
    "Scout base",
    "refined fuel for scout ships; excellent for rumours and news"
  ],
  "T": [
    "Aslan Tlaukhu base",
    "T5"
  ],
  "V": [
    "Exploration base",
    "T5"
  ],
  "W": [
    "Way station",
    "IISS x-boat network hub"
  ]
} as const;

export const ZONE = {
  "": [
    "green",
    "🟢 Green",
    "Safe, or simply not classified."
  ],
  "A": [
    "amber",
    "🟡 Amber",
    "Deemed dangerous by the Imperium; Travellers are warned to be on their guard. Often upheaval/revolution or a naturally hazardous environment."
  ],
  "R": [
    "red",
    "🔴 Red",
    "INTERDICTED - travel forbidden, enforced by the Imperial Navy. May be protecting the world from you rather than you from it."
  ]
} as const;

export const NOBILITY = {
  "B": "Knight",
  "c": "Baronet",
  "C": "Baron",
  "D": "Marquis",
  "e": "Viscount",
  "E": "Count",
  "f": "Duke",
  "F": "Subsector Duke",
  "G": "Archduke",
  "H": "Emperor"
} as const;
