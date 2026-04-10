export interface ReferenceSection {
  id: string;
  title: string;
  pg?: string;
  type: 'table' | 'key_value_list' | 'rules_text';
  columns?: string[];
  rows?: Record<string, string>[];
  items?: { label: string; description: string }[];
  paragraphs?: string[];
  footnote?: string;
}

export interface ReferencePage {
  title: string;
  sections: string[];
}

export const referencePages: ReferencePage[] = [
  {
    title: 'Core Rules',
    sections: [
      'measuring_time',
      'attributes',
      'conditions',
      'skill_level_base_chance',
      'boons_banes_pushing',
      'skills',
      'healing_and_rest',
      'death_and_dying',
      'encumbrance',
    ],
  },
  {
    title: 'Combat',
    sections: [
      'combat_round_structure',
      'actions',
      'free_actions',
      'movement',
      'combat_details',
      'terrain',
      'sneak_attacks_and_ambush',
      'mounted_combat',
    ],
  },
  {
    title: 'Mishap Tables',
    sections: [
      'melee_demon_table',
      'ranged_demon_table',
      'severe_injuries',
      'fear',
      'mishaps',
    ],
  },
  {
    title: 'Magic',
    sections: [
      'spellcasting',
      'magical_mishaps',
      'spell_list',
    ],
  },
  {
    title: 'Gear',
    sections: [
      'melee_weapons',
      'ranged_weapons',
      'weapon_features',
      'armor',
    ],
  },
  {
    title: 'Hazards',
    sections: [
      'environmental_hazards',
      'darkness_and_light',
      'poison',
    ],
  },
  {
    title: 'Kin & NPCs',
    sections: [
      'kin_abilities',
      'typical_npcs',
      'common_animals',
      'npc_attribute_guidelines',
      'creating_npcs',
    ],
  },
];

// =============================================================================
// CORE RULES
// =============================================================================

const measuring_time: ReferenceSection = {
  id: 'measuring_time',
  title: 'Measuring Time',
  pg: '11',
  type: 'table',
  columns: ['unit_of_time', 'duration', 'enough_time_to'],
  rows: [
    { unit_of_time: 'Round', duration: '10 seconds', enough_time_to: 'Perform an action in combat, take a round rest' },
    { unit_of_time: 'Stretch', duration: '15 minutes', enough_time_to: 'Explore a room, take a stretch rest' },
    { unit_of_time: 'Shift', duration: '6 hours', enough_time_to: 'Hike 15 km, take a shift rest' },
  ],
};

const attributes: ReferenceSection = {
  id: 'attributes',
  title: 'Attributes',
  pg: '28-29',
  type: 'table',
  columns: ['attribute', 'description', 'condition'],
  rows: [
    { attribute: 'Strength (STR)', description: 'Raw muscle power.', condition: 'Exhausted' },
    { attribute: 'Constitution (CON)', description: 'Physical fitness and resilience.', condition: 'Sickly' },
    { attribute: 'Agility (AGL)', description: 'Body control, speed, and fine motor skills.', condition: 'Dazed' },
    { attribute: 'Intelligence (INT)', description: 'Mental acuity, intellect, and reasoning skills.', condition: 'Angry' },
    { attribute: 'Willpower (WIL)', description: 'Self-discipline and focus.', condition: 'Scared' },
    { attribute: 'Charisma (CHA)', description: 'Force of personality and empathy.', condition: 'Disheartened' },
  ],
};

const conditions: ReferenceSection = {
  id: 'conditions',
  title: 'Conditions',
  pg: '56',
  type: 'table',
  columns: ['condition', 'attribute'],
  rows: [
    { condition: 'Exhausted', attribute: 'STR' },
    { condition: 'Sickly', attribute: 'CON' },
    { condition: 'Dazed', attribute: 'AGL' },
    { condition: 'Angry', attribute: 'INT' },
    { condition: 'Scared', attribute: 'WIL' },
    { condition: 'Disheartened', attribute: 'CHA' },
  ],
  footnote: 'Bane on all rolls against that attribute and skill rolls based on it.',
};

const skill_level_base_chance: ReferenceSection = {
  id: 'skill_level_base_chance',
  title: 'Skill Base Chance',
  pg: '28-29',
  type: 'table',
  columns: ['attribute_range', 'base_chance'],
  rows: [
    { attribute_range: '1-5', base_chance: '3' },
    { attribute_range: '6-8', base_chance: '4' },
    { attribute_range: '9-12', base_chance: '5' },
    { attribute_range: '13-15', base_chance: '6' },
    { attribute_range: '16-18', base_chance: '7' },
  ],
};

const boons_banes_pushing: ReferenceSection = {
  id: 'boons_banes_pushing',
  title: 'Boons, Banes & Pushing',
  pg: '32',
  type: 'rules_text',
  paragraphs: [
    'Boon: Roll 2d20, keep the lower (better) result. Bane: Roll 2d20, keep the higher (worse) result. Multiple boons/banes cancel 1:1.',
    'Pushing: After a failed skill/attribute roll, reroll (with boon/bane = reroll both dice). New result applies. You always suffer a condition of your choice (can\'t pick one you already have). Cannot push a Demon (20). All 6 conditions = no more pushing. Only PCs can push.',
    'Damage Bonus: STR 13-16 (or AGL for ranged/subtle weapons) = +D4. STR 17+ = +D6.',
  ],
};

const skills: ReferenceSection = {
  id: 'skills',
  title: 'Skills',
  pg: '33-35',
  type: 'table',
  columns: ['skill', 'attribute', 'description'],
  rows: [
    { skill: 'ACROBATICS', attribute: 'AGL', description: 'Jumping, climbing, balancing or performing other similar physical actions.' },
    { skill: 'AWARENESS', attribute: 'INT', description: 'Watch or listen for anyone sneaking around, notice emerging threats in time.' },
    { skill: 'BARTERING', attribute: 'CHA', description: 'Haggling over the price when buying or selling.' },
    { skill: 'BEAST LORE', attribute: 'INT', description: 'Identifying an animal or monster, to know its habits, abilities, and weaknesses.' },
    { skill: 'BLUFFING', attribute: 'CHA', description: 'Quickly come up with a convincing lie.' },
    { skill: 'BUSHCRAFT', attribute: 'INT', description: 'Lead the way through the wilderness, make camp, cook food, or stay warm in cold weather.' },
    { skill: 'CRAFTING', attribute: 'STR', description: 'Repair gear and weapons, craft useful items.' },
    { skill: 'EVADE', attribute: 'AGL', description: 'Dodge an attack or flee from combat.' },
    { skill: 'HEALING', attribute: 'INT', description: 'Get fallen companions back on their feet or even save their lives.' },
    { skill: 'HUNTING & FISHING', attribute: 'AGL', description: 'Finding and obtaining food in wilderness.' },
    { skill: 'LANGUAGES', attribute: 'INT', description: 'Understanding foreign or ancient languages.' },
    { skill: 'MYTHS & LEGENDS', attribute: 'INT', description: 'Trying to remember stories of old times or distant lands, understand links to the past.' },
    { skill: 'PERFORMANCE', attribute: 'CHA', description: 'Singing a song, reading a poem, making jokes or in some other way try to amuse a crowd.' },
    { skill: 'PERSUASION', attribute: 'CHA', description: 'Charm, threats or sensible reasoning, make another person see things your way.' },
    { skill: 'RIDING', attribute: 'AGL', description: 'Advanced maneuvers while mounted.' },
    { skill: 'SEAMANSHIP', attribute: 'INT', description: 'Steer a vessel over water, navigation.' },
    { skill: 'SLEIGHT OF HAND', attribute: 'AGL', description: 'Steal something unnoticed, pick a lock, or perform any other action that requires fine motor skill.' },
    { skill: 'SNEAKING', attribute: 'AGL', description: 'Sneak past the enemy undetected.' },
    { skill: 'SPOT HIDDEN', attribute: 'INT', description: 'Looking for something hidden or concealed.' },
    { skill: 'SWIMMING', attribute: 'AGL', description: 'Swim in difficult situations.' },
    { skill: 'Axes', attribute: 'STR', description: 'Axes of all kinds, including when thrown.' },
    { skill: 'Bows', attribute: 'AGL', description: 'All types of bows.' },
    { skill: 'Brawling', attribute: 'STR', description: 'Unarmed combat with fists, feet, teeth or claws.' },
    { skill: 'Crossbows', attribute: 'AGL', description: 'Attack with crossbows of all kinds.' },
    { skill: 'Hammers', attribute: 'STR', description: 'Warhammers and other blunt weapons such as clubs and maces.' },
    { skill: 'Knives', attribute: 'AGL', description: 'Combat with knives and daggers, including when thrown.' },
    { skill: 'Slings', attribute: 'AGL', description: 'Attacking with slings.' },
    { skill: 'Spears', attribute: 'STR', description: 'Combat with spears, tridents, and lances, including when thrown.' },
    { skill: 'Staves', attribute: 'AGL', description: 'Fighting with a staff.' },
    { skill: 'Swords', attribute: 'STR', description: 'Combat with all types of swords.' },
  ],
};

const healing_and_rest: ReferenceSection = {
  id: 'healing_and_rest',
  title: 'Healing & Rest',
  pg: '55, 57',
  type: 'table',
  columns: ['rest_type', 'effect'],
  rows: [
    { rest_type: 'Round Rest', effect: 'Recover D6 WP. Once per shift.' },
    { rest_type: 'Stretch Rest', effect: 'Heal D6 HP (2D6 if HEALING roll succeeds). Recover D6 WP. Heal one condition.' },
    { rest_type: 'Shift Rest', effect: 'Recover all HP and WP, heal all conditions.' },
  ],
};

const death_and_dying: ReferenceSection = {
  id: 'death_and_dying',
  title: 'Death & Dying',
  pg: '55',
  type: 'rules_text',
  paragraphs: [
    'At 0 HP: Make a CON death roll each round. 3 successes = recover with D6 HP. 3 failures = death.',
    'Dragon on death roll = 2 successes. Demon on death roll = 2 failures.',
    'Taking damage at 0 HP = automatic failed death roll.',
    'Instant death: A single attack reduces HP to negative of max HP.',
    'After recovery: Roll CON. Failure = permanent injury (D10 table).',
  ],
};

const encumbrance: ReferenceSection = {
  id: 'encumbrance',
  title: 'Encumbrance',
  pg: '28',
  type: 'rules_text',
  paragraphs: [
    'Carry up to STR / 2 (rounded up) items in inventory.',
    'Weapons at hand (up to 3) and worn armor/helmet don\'t count against slots.',
    '4 rations = 1 slot. Under 100 coins = free, 100-199 = 1 slot.',
    'Over-encumbered: STR roll to move each round/shift. Fail = drop items or stay put.',
  ],
};

// =============================================================================
// COMBAT
// =============================================================================

const combat_round_structure: ReferenceSection = {
  id: 'combat_round_structure',
  title: 'Combat Round Structure',
  pg: '41',
  type: 'rules_text',
  paragraphs: [
    '1. Draw initiative cards (1-10) \u2014 one per character. Lowest acts first.',
    '2. Each turn: one free movement (10m) + one action.',
    '3. After acting or reacting, flip card face-down \u2014 no further reactions allowed.',
    '4. Wait: Swap initiative card with a later creature (they can\'t refuse). Monsters never wait.',
    '5. Cards are redrawn every round.',
  ],
};

const actions: ReferenceSection = {
  id: 'actions',
  title: 'Actions',
  pg: '42',
  type: 'key_value_list',
  items: [
    { label: 'Dash', description: 'Doubles your movement rate in the round.' },
    { label: 'Melee Attack', description: 'Against enemy within 2m (4m for long weapons).' },
    { label: 'Ranged Attack', description: 'Against targets within the weapon\'s range.' },
    { label: 'Parry', description: 'Parry melee/ranged (ranged requires shield). Reaction, replaces your action.' },
    { label: 'Dodge', description: 'Dodge melee or ranged attacks. Also a reaction.' },
    { label: 'Pick Up Item', description: 'Pick up item within 2m, or from your inventory.' },
    { label: 'Equip Armor', description: 'Put on or remove armor/helmet.' },
    { label: 'First Aid', description: 'HEALING skill to save someone at 0 HP.' },
    { label: 'Rally', description: 'PERSUADE another PC at 0 HP to keep fighting.' },
    { label: 'Break Down Door', description: 'Doors take a certain amount of damage before breaking.' },
    { label: 'Pick Lock', description: 'SLEIGHT OF HAND roll. Bane without lockpicks.' },
    { label: 'Use Item', description: 'Use a potion or item within 2m.' },
    { label: 'Activate Ability', description: 'Use an innate or heroic ability.' },
    { label: 'Cast Spell', description: 'Most spells are actions (incl. magic tricks). Some are reactions.' },
    { label: 'Helping', description: 'Give another character a boon on a roll this round.' },
    { label: 'Round Rest', description: 'Recover D6 WP. Once per shift only.' },
  ],
};

const free_actions: ReferenceSection = {
  id: 'free_actions',
  title: 'Free Actions',
  pg: '42',
  type: 'key_value_list',
  items: [
    { label: 'Draw Weapon', description: 'Draw, exchange, or put away a weapon kept at hand.' },
    { label: 'Change Position', description: 'Throw yourself to the ground or get up.' },
    { label: 'Drop Item', description: 'Drop an item on the ground.' },
    { label: 'Shout', description: 'Say or shout a few words.' },
  ],
};

const movement: ReferenceSection = {
  id: 'movement',
  title: 'Movement',
  pg: '43',
  type: 'key_value_list',
  items: [
    { label: 'Base', description: 'Move up to your Movement rate in meters per turn (free).' },
    { label: 'Dash', description: 'Use your action to double movement this round.' },
    { label: 'Leaping', description: 'Horizontal leap up to half movement with ACROBATICS. Quarter or less = no roll needed.' },
    { label: 'Door', description: 'Passing through a closed unlocked door costs half movement.' },
    { label: 'Enemies', description: 'Can\'t move past a standing enemy (~2x2m block). Must topple or reduce to 0 HP first. Friendlies pass freely.' },
    { label: 'Reaction', description: 'Performing a reaction (parry/dodge) also loses your movement for the round.' },
  ],
};

const combat_details: ReferenceSection = {
  id: 'combat_details',
  title: 'Combat Details',
  pg: '44-50',
  type: 'key_value_list',
  items: [
    { label: 'Critical Hit (Dragon)', description: 'Choose: double damage dice, OR free second attack, OR armor no effect (piercing only).' },
    { label: 'Prone Targets', description: 'Boon on attack + extra D6 damage.' },
    { label: 'Shove', description: 'On melee hit, if STR dmg bonus \u2265 opponent\'s, shove 2m. Monsters can\'t be shoved.' },
    { label: 'Parry: Dragon', description: 'Counterattack \u2014 auto hit, can\'t dodge/parry. Not if attacker also Dragon.' },
    { label: 'Dodge: Movement', description: 'On success, move 2m any direction (no free attacks).' },
    { label: 'STR Requirement', description: 'Below req = bane on attacks/parries. Below half = can\'t use.' },
    { label: 'Obscured Targets', description: 'Partial = bane on ranged. Full = can\'t shoot.' },
  ],
};

const terrain: ReferenceSection = {
  id: 'terrain',
  title: 'Terrain',
  pg: '44',
  type: 'table',
  columns: ['type', 'effect'],
  rows: [
    { type: 'Cramped', effect: 'All melee except piercing & subtle weapons get a bane.' },
    { type: 'Rough', effect: 'ACROBATICS when moving (not action). Fail = fall, lose remaining movement.' },
    { type: 'Dimly Lit', effect: 'Bane on all ranged attacks.' },
  ],
};

const sneak_attacks_and_ambush: ReferenceSection = {
  id: 'sneak_attacks_and_ambush',
  title: 'Sneak Attacks & Ambush',
  pg: '43, 48',
  type: 'rules_text',
  paragraphs: [
    'Sneak Attack: SNEAKING roll (melee within 2m = bane). Success = choose any initiative card, boon on attack, target can\'t dodge/parry. Subtle weapons get +1 damage die. One attacker vs one target.',
    'Ambush: Victims roll AWARENESS (bane if ambushers prepared). Fail = bottom initiative cards (#10+).',
  ],
};

const mounted_combat: ReferenceSection = {
  id: 'mounted_combat',
  title: 'Mounted Combat',
  pg: '50',
  type: 'rules_text',
  paragraphs: [
    'Mount must be combat trained. Move at mount\'s rate.',
    'Use the lowest of RIDING and weapon skill for attack rolls.',
    'RIDING replaces EVADE for dodging while mounted. No saddle = bane.',
    'Ground melee vs mounted = bane for the ground fighter.',
    'Mount at 0 HP = dead (mounts do not make death rolls).',
  ],
};

// =============================================================================
// MISHAP TABLES
// =============================================================================

const melee_demon_table: ReferenceSection = {
  id: 'melee_demon_table',
  title: 'Melee Demon (Fumble)',
  pg: '46',
  type: 'table',
  columns: ['d6', 'effect'],
  rows: [
    { d6: '1', effect: 'Drop weapon. Picking up = action.' },
    { d6: '2', effect: 'Expose yourself. Enemy gets a free attack (can\'t dodge/parry).' },
    { d6: '3', effect: 'Weapon stuck. STR roll to free (action).' },
    { d6: '4', effect: 'Toss weapon D3+3 meters. Move + action to retrieve.' },
    { d6: '5', effect: 'Weapon damaged. Bane on attacks until repaired.' },
    { d6: '6', effect: 'Hit yourself. Roll damage (no bonus).' },
  ],
};

const ranged_demon_table: ReferenceSection = {
  id: 'ranged_demon_table',
  title: 'Ranged Demon (Fumble)',
  pg: '48',
  type: 'table',
  columns: ['d6', 'effect'],
  rows: [
    { d6: '1', effect: 'Drop weapon. Picking up = action.' },
    { d6: '2', effect: 'Out of ammo. Re-roll for slings/thrown.' },
    { d6: '3', effect: 'Hit valuable/important item. GM decides.' },
    { d6: '4', effect: 'Weapon damaged. Bane on attacks until repaired.' },
    { d6: '5', effect: 'Hit random friendly PC/NPC. Roll damage with bonus.' },
    { d6: '6', effect: 'Hit yourself. Roll damage (no bonus).' },
  ],
};

const severe_injuries: ReferenceSection = {
  id: 'severe_injuries',
  title: 'Severe Injuries',
  pg: '56',
  type: 'table',
  columns: ['d20', 'injury', 'effect'],
  rows: [
    { d20: '1-2', injury: 'Broken nose', effect: 'Bane on AWARENESS. Heals: D6 days.' },
    { d20: '3-4', injury: 'Scarred face', effect: 'Bane on PERFORMANCE & PERSUASION. Heals: 2D6 days.' },
    { d20: '5-6', injury: 'Teeth knocked out', effect: 'PERFORMANCE & PERSUASION permanently -2 (min 3).' },
    { d20: '7-8', injury: 'Broken ribs', effect: 'Bane on all STR & AGL skills. Heals: D6 days.' },
    { d20: '9-10', injury: 'Concussion', effect: 'Bane on all INT skills. Heals: D6 days.' },
    { d20: '11-12', injury: 'Deep wounds', effect: 'Bane on STR & AGL skills + D6 dmg per roll. Heals: 2D6 days.' },
    { d20: '13', injury: 'Broken leg', effect: 'Movement halved. Heals: 3D6 days.' },
    { d20: '14', injury: 'Broken arm', effect: 'No two-handed/dual wield, bane on two-arm tasks. Heals: 3D6 days.' },
    { d20: '15', injury: 'Severed toe', effect: 'Movement permanently -2 (min 4).' },
    { d20: '16', injury: 'Severed finger', effect: 'All weapon skill levels permanently -1 (min 3).' },
    { d20: '17', injury: 'Gouged eye', effect: 'SPOT HIDDEN permanently -2 (min 3).' },
    { d20: '18', injury: 'Nightmares', effect: 'Fear roll each shift slept. Fail = doesn\'t count. Heals: 2D6 days.' },
    { d20: '19', injury: 'Changed personality', effect: 'Randomly generate a new weakness.' },
    { d20: '20', injury: 'Amnesia', effect: 'Can\'t remember identity. Must roleplay. Heals: D6 days.' },
  ],
};

const fear: ReferenceSection = {
  id: 'fear',
  title: 'Fear (Failed WIL Roll)',
  pg: '58-59',
  type: 'table',
  columns: ['d8', 'effect'],
  rows: [
    { d8: '1', effect: 'Enfeebled. Lose 2D6 WP (min 0), become Disheartened.' },
    { d8: '2', effect: 'Shaken. Suffer the Scared condition.' },
    { d8: '3', effect: 'Panting. Become Exhausted.' },
    { d8: '4', effect: 'Pale. You and all PCs within 10m in sight become Scared.' },
    { d8: '5', effect: 'Scream. All PCs who hear must also resist fear (one WIL roll per fear source).' },
    { d8: '6', effect: 'Rage. Must attack fear source next turn (melee if possible). Become Angry.' },
    { d8: '7', effect: 'Paralyzed. No action/movement next turn. WIL roll each turn to break free.' },
    { d8: '8', effect: 'Wild Panic. Must dash away from fear source. WIL roll each turn to stop.' },
  ],
};

const mishaps: ReferenceSection = {
  id: 'mishaps',
  title: 'Travel Mishaps',
  pg: '107',
  type: 'table',
  columns: ['d12', 'mishap'],
  rows: [
    { d12: '1', mishap: 'Fog. Distance covered halved this shift.' },
    { d12: '2', mishap: 'Blocking Terrain. ACROBATICS roll or no progress. Success can help others.' },
    { d12: '3', mishap: 'Torn Clothes. Random PC\'s clothes become rags.' },
    { d12: '4', mishap: 'Lost. No progress. Pathfinder BUSHCRAFT to find way (no help).' },
    { d12: '5', mishap: 'Dropped Item. Random PC drops/breaks an item.' },
    { d12: '6', mishap: 'Mosquito Swarm. All PCs without cloak become Angry.' },
    { d12: '7', mishap: 'Sprained Ankle. Random PC takes D6 dmg (boots -2, no armor).' },
    { d12: '8', mishap: 'Downpour. No cloak = cold roll. Must shelter, no progress this shift.' },
    { d12: '9', mishap: 'Wasps. All PCs EVADE or take D6 dmg + a condition.' },
    { d12: '10', mishap: 'Landslide. All PCs EVADE or take D10 dmg.' },
    { d12: '11', mishap: 'Savage Animal. Wolf, bear, or similar attacks.' },
    { d12: '12', mishap: 'Quicksand. BUSHCRAFT or condition + reroll. Second fail = death. Others can help.' },
  ],
};

// =============================================================================
// MAGIC
// =============================================================================

const spellcasting: ReferenceSection = {
  id: 'spellcasting',
  title: 'Spellcasting',
  pg: '63-64',
  type: 'table',
  columns: ['type', 'wp_cost', 'casting_time'],
  rows: [
    { type: 'Magic Trick', wp_cost: '1 WP', casting_time: '1 action (auto-success)' },
    { type: 'Spell (Power 1)', wp_cost: '2 WP', casting_time: '1 action (memorized) / 2 actions (grimoire)' },
    { type: 'Spell (Power 2)', wp_cost: '4 WP', casting_time: '1 action (memorized) / 2 actions (grimoire)' },
    { type: 'Spell (Power 3)', wp_cost: '6 WP', casting_time: '1 action (memorized) / 2 actions (grimoire)' },
    { type: 'Reaction Spell', wp_cost: 'Varies', casting_time: 'Triggered (does NOT replace your action)' },
    { type: 'Ritual', wp_cost: 'Varies', casting_time: '1 stretch or shift' },
  ],
  footnote: 'Roll d20 \u2264 school skill. Fail = no effect, WP still spent. Dragon (1): double damage/range, OR no WP cost, OR cast another spell (with bane). Demon (20): roll on Magical Mishaps table. Cannot push spell rolls. Requirements: Word (chant), Gesture (hand movements), Focus (held item), Ingredient (consumed). All listed requirements must be met.',
};

const magical_mishaps: ReferenceSection = {
  id: 'magical_mishaps',
  title: 'Magical Mishaps',
  pg: '65',
  type: 'table',
  columns: ['d20', 'mishap', 'effect'],
  rows: [
    { d20: '1', mishap: 'Dazed', effect: 'You become Dazed.' },
    { d20: '2', mishap: 'Exhausted', effect: 'You become Exhausted.' },
    { d20: '3', mishap: 'Sickly', effect: 'You become Sickly.' },
    { d20: '4', mishap: 'Angry', effect: 'You lose control of the spell, become Angry.' },
    { d20: '5', mishap: 'Scared', effect: 'Demonic visions leave you Scared.' },
    { d20: '6', mishap: 'Disheartened', effect: 'You see beyond the veil, realize your insignificance. Disheartened.' },
    { d20: '7', mishap: 'Damage', effect: 'Magic ravages your body: D6 damage per power level.' },
    { d20: '8', mishap: 'WP Drain', effect: 'Spell drains willpower: lose D6 WP per power level.' },
    { d20: '9', mishap: 'Magical Disease', effect: 'Disease with Virulence 3D6. You and all contacts next shift are exposed.' },
    { d20: '10', mishap: 'Wrong Spell', effect: 'Random spell of yours activates instead, same target and power level.' },
    { d20: '11', mishap: 'Frog Curse', effect: 'Vomit a frog when you lie. D4 each morning, 1 = wears off. Dispel lifts it.' },
    { d20: '12', mishap: 'Midas Bane', effect: 'Gold/silver you touch turns to dust. D4 each morning, 1 = wears off. Dispel lifts it.' },
    { d20: '13', mishap: 'Blindness', effect: 'Blinded (total darkness rules). D4 each morning, 1 = recover. Dispel lifts it.' },
    { d20: '14', mishap: 'Amnesia', effect: 'Forget identity. Must roleplay. D4 each morning, 1 = memory returns.' },
    { d20: '15', mishap: 'Unintended Victim', effect: 'Spell also hits a friend. Healing/helping spells affect an enemy instead.' },
    { d20: '16', mishap: 'Backfire', effect: 'Offensive spell hits you instead. Protect/heal spell deals damage instead.' },
    { d20: '17', mishap: 'Polymorph', effect: 'Turn into animal. D6: 1=cat, 2=fox, 3=goat, 4=wolf, 5=deer, 6=bear.' },
    { d20: '18', mishap: 'Youth', effect: 'Become one age category younger. Permanent (normal aging resumes).' },
    { d20: '19', mishap: 'Aging', effect: 'Become one age category older. Permanent (normal aging resumes).' },
    { d20: '20', mishap: 'Demon Attracted', effect: 'A demon arrives within the next shift and attacks or causes trouble.' },
  ],
};

const spell_list: ReferenceSection = {
  id: 'spell_list',
  title: 'Spell List by School',
  pg: '62-76',
  type: 'table',
  columns: ['school', 'tricks', 'rank_1', 'rank_2', 'rank_3'],
  rows: [
    { school: 'General', tricks: 'Fetch, Flick, Light, Open/Close, Repair Clothes, Sense Magic', rank_1: 'Dispel, Protector', rank_2: 'Magic Shield', rank_3: 'Transfer, Magic Seal (R4), Charge (R4), Permanence (R5)' },
    { school: 'Animism', tricks: 'Birdsong, Clean, Cook Food, Floral Trail, Hairstyle', rank_1: 'Animal Whisperer, Banish, Ensnaring Roots, Lightning Flash, Treat Wound', rank_2: 'Engulfing Forest, Heal Wound, Lightning Bolt, Purge, Sleep', rank_3: 'Restoration, Resurrection, Thunderbolt' },
    { school: 'Elementalism', tricks: 'Heat/Chill, Ignite, Puff of Smoke', rank_1: 'Fireball, Frost, Gust of Wind, Pillar, Shatter', rank_2: 'Fire Blast, Stone Shield, Stonewall, Tidal Wave, Whirlwind', rank_3: 'Firebird, Firestorm, Gnome, Salamander, Sylph, Undine' },
    { school: 'Mentalism', tricks: 'Lock/Unlock, Magic Stool, Slow Fall', rank_1: 'Farsight, Levitate, Longstrider, Power Fist, Stone Skin', rank_2: 'Divination, Enchant Weapon, Mental Strike, Scrying, Telepathy', rank_3: 'Dominate, Flight, Teleport' },
  ],
};

// =============================================================================
// GEAR
// =============================================================================

const melee_weapons: ReferenceSection = {
  id: 'melee_weapons',
  title: 'Melee Weapons',
  pg: '73-75',
  type: 'table',
  columns: ['weapon', 'grip', 'str', 'damage', 'durability', 'features', 'cost'],
  rows: [
    { weapon: 'Knife', grip: '1H', str: '-', damage: 'D8', durability: '6', features: 'Subtle, P, Throw', cost: '5s' },
    { weapon: 'Dagger', grip: '1H', str: '-', damage: 'D8', durability: '9', features: 'Subtle, P, S, Throw', cost: '1g' },
    { weapon: 'Parrying Dagger', grip: '1H', str: '-', damage: '2D6', durability: '15', features: 'Subtle, P, S', cost: '2g' },
    { weapon: 'Short Sword', grip: '1H', str: '7', damage: '2D10', durability: '12', features: 'P, S', cost: '8g' },
    { weapon: 'Broadsword', grip: '1H', str: '10', damage: '2D6', durability: '15', features: 'P, S', cost: '12g' },
    { weapon: 'Longsword', grip: '1H', str: '13', damage: '2D8', durability: '15', features: 'P, S', cost: '25g' },
    { weapon: 'Greatsword', grip: '2H', str: '16', damage: '2D10', durability: '15', features: 'P, S', cost: '50g' },
    { weapon: 'Scimitar', grip: '1H', str: '10', damage: '2D6', durability: '12', features: 'Top, S', cost: '10g' },
    { weapon: 'Handaxe', grip: '1H', str: '7', damage: '2D6', durability: '9', features: 'Top, S, Throw', cost: '2g' },
    { weapon: 'Battleaxe', grip: '1H', str: '13', damage: '2D8', durability: '9', features: 'Top, S', cost: '10g' },
    { weapon: 'Two-Handed Axe', grip: '2H', str: '16', damage: '2D10', durability: '9', features: 'Top, S', cost: '25g' },
    { weapon: 'Mace', grip: '1H', str: '7', damage: '2D4', durability: '12', features: 'B', cost: '8g' },
    { weapon: 'Morningstar', grip: '1H', str: '13', damage: '2D8', durability: '12', features: 'B', cost: '14g' },
    { weapon: 'Warhammer, Lt', grip: '1H', str: '10', damage: '2D6', durability: '12', features: 'B, Top', cost: '10g' },
    { weapon: 'Warhammer, Hvy', grip: '2H', str: '16', damage: '2D10', durability: '12', features: 'B, Top', cost: '20g' },
    { weapon: 'Flail', grip: '1H', str: '13', damage: '2D8', durability: '-', features: 'B, Top, No Parry', cost: '16g' },
    { weapon: 'Staff', grip: '2H', str: '7', damage: 'D8', durability: '9', features: 'B, Top', cost: '2s' },
    { weapon: 'Short Spear', grip: '1H', str: '7', damage: 'D10', durability: '9', features: 'P, Throw', cost: '5s' },
    { weapon: 'Long Spear', grip: '2H', str: '10', damage: '2D8', durability: '9', features: 'Long, P', cost: '1g' },
    { weapon: 'Lance', grip: '1H', str: '13', damage: '2D10', durability: '12', features: 'Long, P, Mounted', cost: '12g' },
    { weapon: 'Halberd', grip: '2H', str: '13', damage: '2D8', durability: '12', features: 'Long, Top, P, S', cost: '20g' },
    { weapon: 'Trident', grip: '1H', str: '10', damage: '2D6', durability: '9', features: 'Top, P, Throw', cost: '5g' },
    { weapon: 'Shield, Small', grip: '1H', str: '7', damage: 'D8', durability: '15', features: 'B', cost: '4g' },
    { weapon: 'Shield, Large', grip: '1H', str: '13', damage: 'D8', durability: '18', features: 'B', cost: '12g' },
  ],
};

const ranged_weapons: ReferenceSection = {
  id: 'ranged_weapons',
  title: 'Ranged Weapons',
  pg: '76',
  type: 'table',
  columns: ['weapon', 'grip', 'str', 'damage', 'range', 'cost'],
  rows: [
    { weapon: 'Sling', grip: '1H', str: '-', damage: 'D8', range: '20m', cost: '1s' },
    { weapon: 'Short Bow', grip: '2H', str: '7', damage: 'D10', range: '30m', cost: '25g' },
    { weapon: 'Longbow', grip: '2H', str: '13', damage: 'D12', range: '100m', cost: '50g' },
    { weapon: 'Crossbow, Lt', grip: '2H', str: '7', damage: '2D6', range: '40m', cost: '75g' },
    { weapon: 'Crossbow, Hvy', grip: '2H', str: '13', damage: '2D8', range: '60m', cost: '200g' },
    { weapon: 'Crossbow, Hand', grip: '1H', str: '7', damage: '2D6', range: '30m', cost: '90g' },
  ],
  footnote: 'All ranged = Piercing. Crossbows: no damage bonus. Beyond range (up to 2x) = bane.',
};

const weapon_features: ReferenceSection = {
  id: 'weapon_features',
  title: 'Weapon Features',
  pg: '73',
  type: 'key_value_list',
  items: [
    { label: 'P = Piercing', description: 'Can affect armor effectiveness.' },
    { label: 'S = Slashing', description: 'Choose P or S before rolling.' },
    { label: 'B = Bludgeoning', description: 'Affects armor effectiveness.' },
    { label: 'Top = Toppling', description: 'Boon to topple opponent.' },
    { label: 'Subtle', description: 'Boon + extra damage die on sneak attacks.' },
    { label: 'Long', description: '4m reach (2 squares).' },
    { label: 'Throw = Throwable', description: 'Use as ranged attack.' },
    { label: 'Mastercrafted', description: '10x cost, STR req -3, Durability +3.' },
  ],
};

const armor: ReferenceSection = {
  id: 'armor',
  title: 'Armor & Helmets',
  pg: '77',
  type: 'table',
  columns: ['armor', 'rating', 'bane_on', 'cost'],
  rows: [
    { armor: 'Leather', rating: '1', bane_on: '-', cost: '2g' },
    { armor: 'Studded Leather', rating: '2', bane_on: 'Sneaking', cost: '10g' },
    { armor: 'Chainmail', rating: '4', bane_on: 'Evade, Sneaking', cost: '50g' },
    { armor: 'Plate Armor', rating: '6', bane_on: 'Acrobatics, Evade, Sneaking', cost: '500g' },
    { armor: 'Open Helmet', rating: '+1', bane_on: 'Awareness', cost: '12g' },
    { armor: 'Great Helm', rating: '+2', bane_on: 'Awareness, All ranged attacks', cost: '100g' },
  ],
  footnote: 'Helmet AR stacks with body armor. Equip/unequip = 1 action.',
};

// =============================================================================
// HAZARDS
// =============================================================================

const environmental_hazards: ReferenceSection = {
  id: 'environmental_hazards',
  title: 'Environmental Hazards',
  pg: '57-59',
  type: 'key_value_list',
  items: [
    { label: 'Cold', description: 'BUSHCRAFT per shift (stretch/round extreme). No blanket = bane, fur = boon. Fail = D6 HP + D6 WP, no healing except magic. 0 HP = death next roll.' },
    { label: 'Falling', description: 'D6 per 2m (rounded down). Under 2m = none. ACROBATICS halves dice. Armor does NOT protect.' },
    { label: 'Drowning', description: 'Half move, no ranged, bane melee. SWIMMING per stretch (per round heavy armor). Underwater: CON/round or D6 dmg. 0 HP = death.' },
    { label: 'Fire', description: 'Torch as weapon = small wooden club + fire damage.' },
  ],
};

const darkness_and_light: ReferenceSection = {
  id: 'darkness_and_light',
  title: 'Darkness & Light',
  pg: '57',
  type: 'table',
  columns: ['source', 'radius', 'duration', 'goes_out'],
  rows: [
    { source: 'Torch', radius: '10m', duration: '~1 shift', goes_out: 'D6: 1 per stretch' },
    { source: 'Lantern', radius: '10m', duration: '1 shift/oil', goes_out: 'D8: 1 per stretch' },
    { source: 'Oil Lamp', radius: '10m', duration: '1 shift/dose', goes_out: 'D6: 1 per stretch' },
    { source: 'Candle', radius: '4m', duration: 'Variable', goes_out: 'D4: 1 per stretch' },
  ],
  footnote: 'Total darkness: No dash, no ranged attacks. Melee requires AWARENESS roll first (not an action). Fail = miss.',
};

const poison: ReferenceSection = {
  id: 'poison',
  title: 'Poison',
  pg: '57',
  type: 'table',
  columns: ['type', 'full_effect', 'limited_effect'],
  rows: [
    { type: 'Lethal', full_effect: 'D6 dmg/round until 0 HP. Antidote stops it.', limited_effect: 'D6 dmg next turn only.' },
    { type: 'Paralyzing', full_effect: 'Exhausted + CON/round or lose all actions. Lasts 1 stretch or antidote.', limited_effect: 'Exhausted only.' },
    { type: 'Sleeping', full_effect: 'Dazed + CON/round or sleep 1 shift. Antidote or 1+ dmg wakes.', limited_effect: 'Dazed only.' },
  ],
  footnote: 'Opposed roll: poison potency vs. victim\'s CON. Poison has no effect on monsters.',
};

// =============================================================================
// KIN & NPCs
// =============================================================================

const kin_abilities: ReferenceSection = {
  id: 'kin_abilities',
  title: 'Kin Abilities',
  pg: '9-13',
  type: 'table',
  columns: ['kin', 'move', 'ability', 'wp', 'effect'],
  rows: [
    { kin: 'Human', move: '10', ability: 'Adaptive', wp: '3', effect: 'Use a different skill for a roll (GM approval).' },
    { kin: 'Dwarf', move: '8', ability: 'Unbreakable', wp: '3', effect: 'Completely ignore damage from one attack.' },
    { kin: 'Elf', move: '10', ability: 'Inner Peace', wp: '-', effect: 'Stretch rest: +D6 HP, +D6 WP, +1 condition healed. Unresponsive during meditation.' },
    { kin: 'Halfling', move: '8', ability: 'Hard to Catch', wp: '3', effect: 'Boon on EVADE roll when dodging.' },
    { kin: 'Halfling', move: '', ability: 'Unforgiving', wp: '3', effect: 'Boon on attack vs someone who has harmed you.' },
    { kin: 'Mallard', move: '8', ability: 'Ill-Tempered', wp: '3', effect: 'Boon on a skill roll, but become Angry. Not INT skills.' },
    { kin: 'Mallard', move: '', ability: 'Webbed Feet', wp: '-', effect: 'Boon on SWIMMING. Full speed in water.' },
    { kin: 'Wolfkin', move: '12', ability: 'Hunting Instincts', wp: '3+1', effect: 'Mark prey (action). Track by scent 1 day. +1 WP per attack for boon vs prey.' },
  ],
};

const typical_npcs: ReferenceSection = {
  id: 'typical_npcs',
  title: 'Typical NPCs',
  pg: '110',
  type: 'table',
  columns: ['type', 'skills', 'heroic_abilities', 'damage_bonus', 'hp', 'wp', 'gear'],
  rows: [
    { type: 'Guard', skills: 'Awareness 10, Swords 12', heroic_abilities: '-', damage_bonus: 'STR +D4', hp: '12', wp: '-', gear: 'Broadsword, studded leather' },
    { type: 'Cultist', skills: 'Evade 14, Knives 14', heroic_abilities: '-', damage_bonus: 'AGL +D4', hp: '12', wp: '-', gear: 'Dagger' },
    { type: 'Thief', skills: 'Evade 12, Knives 12', heroic_abilities: '-', damage_bonus: 'AGL +D4', hp: '10', wp: '-', gear: 'Knife' },
    { type: 'Villager', skills: 'Brawling 8', heroic_abilities: '-', damage_bonus: '-', hp: '8', wp: '-', gear: 'Wooden club' },
    { type: 'Hunter', skills: 'Awareness 12, Bows 13', heroic_abilities: '-', damage_bonus: 'AGL +D4', hp: '13', wp: '-', gear: 'Longbow, leather armor' },
    { type: 'Bandit', skills: 'Bows 12, Evade 10, Swords 12', heroic_abilities: '-', damage_bonus: '-', hp: '12', wp: '-', gear: 'Short sword, short bow' },
    { type: 'Adventurer', skills: 'Awareness 10, Swords 12', heroic_abilities: '-', damage_bonus: 'STR +D4', hp: '13', wp: '-', gear: 'Broadsword, studded leather' },
    { type: 'Scholar', skills: 'Languages 13, Myths & Legends 13, Staves 8', heroic_abilities: '-', damage_bonus: '-', hp: '7', wp: '-', gear: 'A good book' },
    { type: 'Bandit Chief (Boss)', skills: 'Awareness 12, Brawling 15, Hammers 15', heroic_abilities: 'Berserker, Robust x6, Veteran', damage_bonus: 'STR +D6', hp: '30', wp: '16', gear: 'Heavy warhammer, chainmail, open helm' },
    { type: 'Knight Champion (Boss)', skills: 'Brawling 14, Swords 16', heroic_abilities: 'Defensive, Double Slash, Focused x6, Robust x6', damage_bonus: 'STR +D6', hp: '28', wp: '26', gear: 'Longsword, large shield, plate, great helm, horse' },
    { type: 'Archmage (Boss)', skills: 'Magic School 15, Staves 13', heroic_abilities: 'Focused x6, Master Spellcaster, Robust x4', damage_bonus: '-', hp: '22', wp: '30', gear: 'Staff, grimoire' },
  ],
};

const common_animals: ReferenceSection = {
  id: 'common_animals',
  title: 'Common Animals',
  pg: '104',
  type: 'table',
  columns: ['animal', 'movement', 'hp', 'attack', 'skills'],
  rows: [
    { animal: 'Cat', movement: '12', hp: '4', attack: 'Bite (8, D3)', skills: 'Awareness 12, Evade 14, Sneaking 16' },
    { animal: 'Dog', movement: '14', hp: '8', attack: 'Bite (12, D8)', skills: 'Awareness 14, Evade 10, Sneaking 12' },
    { animal: 'Goat', movement: '10', hp: '6', attack: 'Horns (10, D6)', skills: 'Awareness 10, Evade 12' },
    { animal: 'Donkey', movement: '14', hp: '12', attack: 'Kick (10, D10)', skills: 'Awareness 10, Evade 6' },
    { animal: 'Horse', movement: '20', hp: '16', attack: 'Kick (10, 2D4)', skills: 'Awareness 12, Evade 8' },
    { animal: 'Wild Boar', movement: '12', hp: '14', attack: 'Tusks (12, 2D6)', skills: 'Awareness 10, Evade 8' },
    { animal: 'Deer', movement: '18', hp: '12', attack: 'Horns (10, D8)', skills: 'Awareness 12, Evade 12' },
    { animal: 'Moose', movement: '16', hp: '18', attack: 'Horns (10, 2D6)', skills: 'Awareness 10, Evade 8' },
    { animal: 'Fox', movement: '10', hp: '6', attack: 'Bite (12, D6)', skills: 'Awareness 12, Evade 10, Sneaking 14' },
    { animal: 'Wolf', movement: '16', hp: '10', attack: 'Bite (14, 2D6)', skills: 'Awareness 14, Evade 12, Sneaking 14' },
    { animal: 'Bear', movement: '12', hp: '20', attack: 'Bite (12, 2D8)', skills: 'Awareness 10, Evade 8' },
  ],
};

const npc_attribute_guidelines: ReferenceSection = {
  id: 'npc_attribute_guidelines',
  title: 'Attributes for NPCs',
  pg: '109',
  type: 'rules_text',
  paragraphs: [
    'STR & AGL: Use damage bonus. +D6 = 17, +D4 = 14, none = 10.',
    'CON: Roll against max HP, -2 per Robust level.',
    'WIL: Roll against max WP (if listed), -2 per Focused level. If no WP listed, use 10.',
    'INT & CHA: Roll against 10.',
  ],
};

const creating_npcs: ReferenceSection = {
  id: 'creating_npcs',
  title: 'NPC Generator',
  pg: '111',
  type: 'table',
  columns: ['d20', 'attitude_d4', 'kin_d6', 'motivation_d8', 'profession_d10', 'trait_d12', 'name'],
  rows: [
    { d20: '1', attitude_d4: 'Hostile', kin_d6: 'Human', motivation_d8: 'Sweet, glittering gold', profession_d10: 'Bard', trait_d12: 'Talks too much', name: 'Agnar / Jorid / Dereios' },
    { d20: '2', attitude_d4: 'Evasive', kin_d6: 'Dwarf', motivation_d8: 'Knowledge of the world', profession_d10: 'Artisan', trait_d12: 'Strange clothes', name: 'Ragnfast / Ask / Euanthe' },
    { d20: '3', attitude_d4: 'Indifferent', kin_d6: 'Elf', motivation_d8: 'Deep and eternal love', profession_d10: 'Hunter', trait_d12: 'Wild-eyed', name: 'Arnulf / Tyra / Xanthos' },
    { d20: '4', attitude_d4: 'Friendly', kin_d6: 'Halfling', motivation_d8: 'A lifelong oath', profession_d10: 'Fighter', trait_d12: 'Smells bad', name: 'Atle / Liv / Athalia' },
    { d20: '5', attitude_d4: '-', kin_d6: 'Wolfkin', motivation_d8: 'Injustice demands retribution', profession_d10: 'Scholar', trait_d12: 'Joker', name: 'Guthorm / Embla / Kleitos' },
    { d20: '6', attitude_d4: '-', kin_d6: 'Mallard', motivation_d8: 'A life of joy and song', profession_d10: 'Mage', trait_d12: 'Cultist', name: 'Botvid / Ragna / Astara' },
    { d20: '7', attitude_d4: '-', kin_d6: '-', motivation_d8: 'Blood ties never severed', profession_d10: 'Merchant', trait_d12: 'A bit childish', name: 'Kale / Turid / Priamus' },
    { d20: '8', attitude_d4: '-', kin_d6: '-', motivation_d8: 'Escaping the dark past', profession_d10: 'Knight', trait_d12: 'Quiet and difficult', name: 'Egil / Jorunn / Galyna' },
    { d20: '9', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: 'Mariner', trait_d12: 'Demon worshiper', name: 'Ingemund / Borghild / Taras' },
    { d20: '10', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: 'Thief', trait_d12: 'Obstinate', name: 'Gudmund / Gylla / Zenais' },
    { d20: '11', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: 'Very touchy', name: 'Grim / Tora / Hesiod' },
    { d20: '12', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: 'Highly romantic', name: 'Brand / Edda / Liene' },
    { d20: '13', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name: 'Folkvid / Sigrun / Eupraxia' },
    { d20: '14', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name: 'Germund / Dagrun / Tyrus' },
    { d20: '15', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name: 'Algot / Bolla / Lysandra' },
    { d20: '16', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name: 'Tolir / Yrsa / Kallias' },
    { d20: '17', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name: 'Hjorvald / Estrid / Isidora' },
    { d20: '18', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name: 'Ambjorn / Signe / Athos' },
    { d20: '19', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name: 'Grunn / Tilde / Larysa' },
    { d20: '20', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name: 'Olgrid / Idun / Nikias' },
  ],
};

// =============================================================================
// EXPORT
// =============================================================================

export const referenceSections: ReferenceSection[] = [
  // Core Rules
  measuring_time,
  attributes,
  conditions,
  skill_level_base_chance,
  boons_banes_pushing,
  skills,
  healing_and_rest,
  death_and_dying,
  encumbrance,
  // Combat
  combat_round_structure,
  actions,
  free_actions,
  movement,
  combat_details,
  terrain,
  sneak_attacks_and_ambush,
  mounted_combat,
  // Mishap Tables
  melee_demon_table,
  ranged_demon_table,
  severe_injuries,
  fear,
  mishaps,
  // Magic
  spellcasting,
  magical_mishaps,
  spell_list,
  // Gear
  melee_weapons,
  ranged_weapons,
  weapon_features,
  armor,
  // Hazards
  environmental_hazards,
  darkness_and_light,
  poison,
  // Kin & NPCs
  kin_abilities,
  typical_npcs,
  common_animals,
  npc_attribute_guidelines,
  creating_npcs,
];
