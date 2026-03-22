export interface ReferenceSection {
  id: string;
  title: string;
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
    title: 'Combat & Time',
    sections: ['measuring_time', 'free_actions', 'actions', 'severe_injuries'],
  },
  {
    title: 'Core Rules',
    sections: ['attributes', 'skills', 'healing_and_rest', 'conditions', 'fear', 'skill_level_base_chance'],
  },
  {
    title: 'NPCs & Animals',
    sections: ['typical_npcs', 'common_animals', 'npc_attribute_guidelines'],
  },
  {
    title: 'NPC Generator & Travel',
    sections: ['creating_npcs', 'mishaps'],
  },
];

export const referenceSections: ReferenceSection[] = [
  {
    id: 'measuring_time',
    title: 'Measuring Time',
    type: 'table',
    columns: ['unit_of_time', 'duration', 'enough_time_to'],
    rows: [
      {
        unit_of_time: 'Round',
        duration: '10 seconds',
        enough_time_to: 'Perform an action in combat, take a round rest (page 52)',
      },
      {
        unit_of_time: 'Stretch',
        duration: '15 minutes',
        enough_time_to: 'Explore a room, take a stretch rest (page 52)',
      },
      {
        unit_of_time: 'Shift',
        duration: '6 hours',
        enough_time_to: 'Hike for 15 kilometers, take a shift rest (page 52)',
      },
    ],
  },
  {
    id: 'free_actions',
    title: 'Free Actions',
    type: 'key_value_list',
    items: [
      { label: 'Draw Weapon', description: 'Draw, exchange, or put away a weapon kept at hand.' },
      { label: 'Change Position', description: 'Throw yourself to the ground or get up.' },
      { label: 'Drop Item', description: 'Drop an item on the ground.' },
      { label: 'Shout', description: 'Say or shout a few words.' },
    ],
  },
  {
    id: 'actions',
    title: 'Actions',
    type: 'key_value_list',
    items: [
      { label: 'Dash', description: 'This action doubles your movement rate in the round.' },
      {
        label: 'Melee Attack',
        description:
          'These can be performed against an enemy within 2 meters (4 meters for long weapons).',
      },
      {
        label: 'Ranged Attack',
        description:
          "Attacks with a ranged weapon can be made against targets within the weapon's range.",
      },
      {
        label: 'Parry',
        description:
          'Both melee and ranged attacks can be parried, but the latter requires a shield. Parrying is a reaction and takes place outside your turn and replaces your regular action in the round.',
      },
      {
        label: 'Dodge',
        description: 'Dodging melee or ranged attacks is also a reaction.',
      },
      {
        label: 'Pick Up Item',
        description: 'Pick up an item from the ground within 2 meters, or from your inventory.',
      },
      {
        label: 'Equip / Unequip Armor / Helmet',
        description:
          'Suits of armor and helmets protect you from damage, but also restrict your movement.',
      },
      {
        label: 'First Aid',
        description:
          'The HEALING skill is used to save the life of someone who has had their HP reduced to zero and is at risk of dying.',
      },
      {
        label: 'Rally',
        description:
          'You can PERSUADE another player character at zero HP to rally and keep fighting.',
      },
      {
        label: 'Break Down Door',
        description: 'Doors can take a certain amount of damage before they break down.',
      },
      {
        label: 'Pick Lock',
        description:
          'Picking a lock requires a SLEIGHT OF HAND roll. Doing so without lockpicks gives you a bane.',
      },
      {
        label: 'Use Item',
        description: 'Use a potion or some other item within 2 meters.',
      },
      {
        label: 'Activate Ability',
        description: 'Use an innate or heroic ability.',
      },
      {
        label: 'Cast Spell',
        description:
          'In most cases, casting a spell counts as an action. This includes magic tricks. Some spells are reactions and do not require an action, while others are more time-consuming.',
      },
      {
        label: 'Helping',
        description:
          'Helping another character gives them a boon to a roll in the same round.',
      },
      {
        label: 'Round Rest',
        description: 'You rest and recover D6 WP. This can only be done once per shift.',
      },
    ],
  },
  {
    id: 'severe_injuries',
    title: 'Severe Injuries',
    type: 'table',
    columns: ['d20', 'injury', 'effect'],
    rows: [
      {
        d20: '1-2',
        injury: 'Broken nose',
        effect: 'You get a bane on all AWARENESS rolls. Healing time: D6 days.',
      },
      {
        d20: '3-4',
        injury: 'Scarred face',
        effect: 'Bane on all PERFORMANCE and PERSUASION rolls. Healing time: 2D6 days.',
      },
      {
        d20: '5-6',
        injury: 'Teeth knocked out',
        effect:
          'Your PERFORMANCE and PERSUASION skill levels are permanently reduced by 2 (to a minimum of 3).',
      },
      {
        d20: '7-8',
        injury: 'Broken ribs',
        effect: 'Bane on all skills based on STR and AGL. Healing time: D6 days.',
      },
      {
        d20: '9-10',
        injury: 'Concussion',
        effect: 'Bane on all skills based on INT. Healing time: D6 days.',
      },
      {
        d20: '11-12',
        injury: 'Deep wounds',
        effect:
          'Bane on all skills based on STR and AGL, and every roll against such skill inflicts D6 points of damage. Healing time: 2D6 days.',
      },
      {
        d20: '13',
        injury: 'Broken leg',
        effect: 'Your movement rate is halved. Healing time: 3D6 days.',
      },
      {
        d20: '14',
        injury: 'Broken arm',
        effect:
          'You cannot use two-handed weapon, nor dual wield, and get a bane on all other actions normally using both arms, such as climbing. Healing time: 3D6 days.',
      },
      {
        d20: '15',
        injury: 'Severed toe',
        effect: 'Movement rate permanently reduced by 2 (to a minimum of 4).',
      },
      {
        d20: '16',
        injury: 'Severed finger',
        effect:
          'Your skill levels in all weapon skills are permanently reduced by 1 (to a minimum of 3).',
      },
      {
        d20: '17',
        injury: 'Gouged eye',
        effect:
          'Your skill level in SPOT HIDDEN is permanently reduced by 2 (to a minimum of 3).',
      },
      {
        d20: '18',
        injury: 'Nightmares',
        effect:
          "Roll to resist fear (page 52). Each shift you sleep. If you fail, the shift doesn't count as slept. Healing time: 2D6 days.",
      },
      {
        d20: '19',
        injury: 'Changed personality',
        effect: 'Randomly generate a new weakness (page 26).',
      },
      {
        d20: '20',
        injury: 'Amnesia',
        effect:
          'You cannot remember who you or the other player characters are. The effect must be roleplayed. Healing time: D6 days.',
      },
    ],
  },
  {
    id: 'attributes',
    title: 'Attributes',
    type: 'table',
    columns: ['attribute', 'description'],
    rows: [
      { attribute: 'Strength (STR)', description: 'Raw muscle power.' },
      { attribute: 'Constitution (CON)', description: 'Physical fitness and resilience.' },
      { attribute: 'Agility (AGL)', description: 'Body control, speed, and fine motor skills.' },
      { attribute: 'Intelligence (INT)', description: 'Mental acuity, intellect, and reasoning skills.' },
      { attribute: 'Willpower (WIL)', description: 'Self-discipline and focus.' },
      { attribute: 'Charisma (CHA)', description: 'Force of personality and empathy.' },
    ],
  },
  {
    id: 'skills',
    title: 'Skills',
    type: 'table',
    columns: ['skill', 'attribute', 'description'],
    rows: [
      {
        skill: 'ACROBATICS',
        attribute: 'AGL',
        description: 'Jumping, climbing, balancing or performing other similar physical actions.',
      },
      {
        skill: 'AWARENESS',
        attribute: 'INT',
        description: 'Watch or listen for anyone sneaking around, notice emerging threats in time.',
      },
      {
        skill: 'BARTERING',
        attribute: 'CHA',
        description: 'Haggling over the price when buying or selling.',
      },
      {
        skill: 'BEAST LORE',
        attribute: 'INT',
        description: 'Identifying an animal or monster, to know its habits, abilities, and weaknesses.',
      },
      {
        skill: 'BLUFFING',
        attribute: 'CHA',
        description: 'Quickly come up with a convincing lie.',
      },
      {
        skill: 'BUSHCRAFT',
        attribute: 'INT',
        description: 'Lead the way through the wilderness, make camp, cook food, or stay warm in cold weather.',
      },
      {
        skill: 'CRAFTING',
        attribute: 'STR',
        description: 'Repair gear and weapon, craft useful item.',
      },
      {
        skill: 'EVADE',
        attribute: 'AGL',
        description: 'Dodge an attack or flee from combat.',
      },
      {
        skill: 'HEALING',
        attribute: 'INT',
        description: 'Get fallen companions back on their feet or even save their lives.',
      },
      {
        skill: 'HUNTING & FISHING',
        attribute: 'AGL',
        description: 'Finding and obtaining food in wilderness.',
      },
      {
        skill: 'LANGUAGES',
        attribute: 'INT',
        description: 'Understanding foreign or ancient language.',
      },
      {
        skill: 'MYTHS & LEGENDS',
        attribute: 'INT',
        description: 'Trying to remember stories of old times or distant lands, understand links to the past.',
      },
      {
        skill: 'PERFORMANCE',
        attribute: 'CHA',
        description: 'Singing a song, reading a poem, making jokes or in some other way try to amuse a crowd.',
      },
      {
        skill: 'PERSUASION',
        attribute: 'CHA',
        description: 'Charm, threats or sensible reasoning, make another person see things your way.',
      },
      {
        skill: 'RIDING',
        attribute: 'AGL',
        description: 'Advanced maneuvers while mounted.',
      },
      {
        skill: 'SEAMANSHIP',
        attribute: 'INT',
        description: 'Steer a vessel over water, navigation.',
      },
      {
        skill: 'SLEIGHT OF HAND',
        attribute: 'AGL',
        description: 'Steal something unnoticed, pick a lock, or perform any other action that requires fine motor skill.',
      },
      {
        skill: 'SNEAKING',
        attribute: 'AGL',
        description: 'Sneak past the enemy undetected.',
      },
      {
        skill: 'SPOT HIDDEN',
        attribute: 'INT',
        description: 'Looking for something hidden, concealed.',
      },
      {
        skill: 'SWIMMING',
        attribute: 'AGL',
        description: 'Swim in difficult situation.',
      },
      {
        skill: 'WEAPON SKILLS',
        attribute: 'STR / AGL',
        description: 'Wielding different types of weapons.',
      },
      {
        skill: 'Axes',
        attribute: 'STR',
        description: 'Axes of all kinds, including when thrown.',
      },
      {
        skill: 'Bows',
        attribute: 'AGL',
        description: 'All types of bows.',
      },
      {
        skill: 'Brawling',
        attribute: 'STR',
        description: 'Unarmed combat with fists, feet, teeth or claws.',
      },
      {
        skill: 'Crossbows',
        attribute: 'AGL',
        description: 'Attack with crossbows of all kinds.',
      },
      {
        skill: 'Hammers',
        attribute: 'STR',
        description: 'Warhammers and other blunt weapons such as clubs and maces.',
      },
      {
        skill: 'Knives',
        attribute: 'AGL',
        description: 'Combat with knives and daggers, including when thrown.',
      },
      {
        skill: 'Slings',
        attribute: 'AGL',
        description: 'Attacking with sling.',
      },
      {
        skill: 'Spears',
        attribute: 'STR',
        description: 'Combat with spears and tridents, including when thrown, lances.',
      },
      {
        skill: 'Staves',
        attribute: 'AGL',
        description: 'Fighting with staff.',
      },
      {
        skill: 'Swords',
        attribute: 'STR',
        description: 'Combat with all types of swords.',
      },
    ],
  },
  {
    id: 'healing_and_rest',
    title: 'Healing & Rest',
    type: 'table',
    columns: ['rest_type', 'effect'],
    rows: [
      { rest_type: 'Round Rest', effect: 'Recover D6 WP. Once per shift.' },
      {
        rest_type: 'Stretch Rest',
        effect:
          'Heal D6 HP, or 2D6 HP if someone else succeeds with HEALING roll. Recover D6 WP and heal one condition.',
      },
      {
        rest_type: 'Shift Rest',
        effect: 'Recover all HP and WP, and heal all conditions.',
      },
    ],
  },
  {
    id: 'conditions',
    title: 'Conditions',
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
    footnote: 'Bane on all rolls against attribute and skill rolls based on that attribute.',
  },
  {
    id: 'fear',
    title: 'Fear',
    type: 'table',
    columns: ['d8', 'effect'],
    rows: [
      {
        d8: '1',
        effect:
          'Enfeebled. The fear drains your energy and determination. You lose 2D6 WP (to a minimum of zero) and become Disheartened.',
      },
      { d8: '2', effect: 'Shaken. You suffer the Scared condition.' },
      {
        d8: '3',
        effect: 'Panting. The intense fear leaves you out of breath and makes you Exhausted.',
      },
      {
        d8: '4',
        effect:
          'Pale. Your face turns white as a sheet. You and all player characters within 10 meters and in sight of you become Scared.',
      },
      {
        d8: '5',
        effect:
          'Scream. You scream in horror, which causes all player characters who hear the sound to immediately suffer a fear attack as well. Each person only ever needs to make one WIL roll to resist the same fear attack.',
      },
      {
        d8: '6',
        effect:
          'Rage. Your fear turns into anger, and you are forced to attack its source on your next turn, in melee combat if possible. You also become Angry.',
      },
      {
        d8: '7',
        effect:
          'Paralyzed. You are petrified with terror and unable to move. You cannot perform any action or movement on your next turn. Make another WIL roll on each subsequent turn (not an action) to break the paralysis.',
      },
      {
        d8: '8',
        effect:
          'Wild Panic. In a fit of utter panic, you flee the scene as fast as you can. On your next turn you must dash away from the source of your fear. Make another WIL roll on each subsequent turn (not an action) to stop running and act normally again.',
      },
    ],
  },
  {
    id: 'skill_level_base_chance',
    title: 'Skill Level',
    type: 'table',
    columns: ['attribute_range', 'base_chance'],
    rows: [
      { attribute_range: '1-5', base_chance: '3' },
      { attribute_range: '6-8', base_chance: '4' },
      { attribute_range: '9-12', base_chance: '5' },
      { attribute_range: '13-15', base_chance: '6' },
      { attribute_range: '16-18', base_chance: '7' },
    ],
  },
  {
    id: 'typical_npcs',
    title: 'Typical NPCs',
    type: 'table',
    columns: ['type', 'skills', 'heroic_abilities', 'damage_bonus', 'hp', 'wp', 'gear'],
    rows: [
      {
        type: 'Guard',
        skills: 'Awareness 10, Swords 12',
        heroic_abilities: '-',
        damage_bonus: 'STR +D4',
        hp: '12',
        wp: '-',
        gear: 'Broadsword, studded leather armor',
      },
      {
        type: 'Cultist',
        skills: 'Evade 14, Knives 14',
        heroic_abilities: '-',
        damage_bonus: 'AGL +D4',
        hp: '12',
        wp: '-',
        gear: 'Dagger',
      },
      {
        type: 'Thief',
        skills: 'Evade 12, Knives 12',
        heroic_abilities: '-',
        damage_bonus: 'AGL +D4',
        hp: '10',
        wp: '-',
        gear: 'Knife',
      },
      {
        type: 'Villager',
        skills: 'Brawling 8',
        heroic_abilities: '-',
        damage_bonus: '-',
        hp: '8',
        wp: '-',
        gear: 'Wooden club',
      },
      {
        type: 'Hunter',
        skills: 'Awareness 12, Bows 13',
        heroic_abilities: '-',
        damage_bonus: 'AGL +D4',
        hp: '13',
        wp: '-',
        gear: 'Longbow, leather armor',
      },
      {
        type: 'Bandit',
        skills: 'Bows 12, Evade 10, Swords 12',
        heroic_abilities: '-',
        damage_bonus: '-',
        hp: '12',
        wp: '-',
        gear: 'Short sword, short bow',
      },
      {
        type: 'Adventurer',
        skills: 'Awareness 10, Swords 12',
        heroic_abilities: '-',
        damage_bonus: 'STR +D4',
        hp: '13',
        wp: '-',
        gear: 'Broadsword, studded leather armor',
      },
      {
        type: 'Scholar',
        skills: 'Languages 13, Myths & Legends 13, Staves 8',
        heroic_abilities: '-',
        damage_bonus: '-',
        hp: '7',
        wp: '-',
        gear: 'A good book',
      },
      {
        type: 'Bandit Chief (Boss)',
        skills: 'Awareness 12, Brawling 15, Hammers 15',
        heroic_abilities: 'Berserker, Robust x 6, Veteran',
        damage_bonus: 'STR +D6',
        hp: '30',
        wp: '16',
        gear: 'Heavy warhammer, chainmail, open helmet',
      },
      {
        type: 'Knight Champion (Boss)',
        skills: 'Brawling 14, Swords 16',
        heroic_abilities: 'Defensive, Double Slash, Focused x 6, Robust x 6',
        damage_bonus: 'STR +D6',
        hp: '28',
        wp: '26',
        gear: 'Longsword, large shield, plate armor, great helm, combat-trained horse',
      },
      {
        type: 'Archmage (Boss)',
        skills: 'Magic School 15, Staves 13',
        heroic_abilities: 'Focused x 6, Master Spellcaster, Robust x 4',
        damage_bonus: '-',
        hp: '22',
        wp: '30',
        gear: 'Staff, grimoire',
      },
    ],
  },
  {
    id: 'common_animals',
    title: 'Common Animals',
    type: 'table',
    columns: ['animal', 'movement', 'hp', 'attack', 'skills'],
    rows: [
      {
        animal: 'Cat',
        movement: '12',
        hp: '4',
        attack: 'Bite (skill level 8, damage D3)',
        skills: 'Awareness 12, Evade 14, Sneaking 16',
      },
      {
        animal: 'Dog',
        movement: '14',
        hp: '8',
        attack: 'Bite (skill level 12, damage D8)',
        skills: 'Awareness 14, Evade 10, Sneaking 12',
      },
      {
        animal: 'Goat',
        movement: '10',
        hp: '6',
        attack: 'Horns (skill level 10, damage D6)',
        skills: 'Awareness 10, Evade 12',
      },
      {
        animal: 'Donkey',
        movement: '14',
        hp: '12',
        attack: 'Kick (skill level 10, damage D10)',
        skills: 'Awareness 10, Evade 6',
      },
      {
        animal: 'Horse',
        movement: '20',
        hp: '16',
        attack: 'Kick (skill level 10, damage 2D4)',
        skills: 'Awareness 12, Evade 8',
      },
      {
        animal: 'Wild Boar',
        movement: '12',
        hp: '14',
        attack: 'Tusks (skill level 12, damage 2D6)',
        skills: 'Awareness 10, Evade 8',
      },
      {
        animal: 'Deer',
        movement: '18',
        hp: '12',
        attack: 'Horns (skill level 10, damage D8)',
        skills: 'Awareness 12, Evade 12',
      },
      {
        animal: 'Moose',
        movement: '16',
        hp: '18',
        attack: 'Horns (skill level 10, damage 2D6)',
        skills: 'Awareness 10, Evade 8',
      },
      {
        animal: 'Fox',
        movement: '10',
        hp: '6',
        attack: 'Bite (skill level 12, damage D6)',
        skills: 'Awareness 12, Evade 10, Sneaking 14',
      },
      {
        animal: 'Wolf',
        movement: '16',
        hp: '10',
        attack: 'Bite (skill level 14, damage 2D6)',
        skills: 'Awareness 14, Evade 12, Sneaking 14',
      },
      {
        animal: 'Bear',
        movement: '12',
        hp: '20',
        attack: 'Bite (skill level 12, damage 2D8)',
        skills: 'Awareness 10, Evade 8',
      },
    ],
  },
  {
    id: 'npc_attribute_guidelines',
    title: 'Attributes for NPCs',
    type: 'rules_text',
    paragraphs: [
      'In adventures for Dragonbane, attribute scores for NPCs are not listed as they are very rarely used. If you at some point would need to roll against an exact attribute score for NPC, use the guidelines below:',
      'STR & AGL: Use the damage bonus. At +D6, roll against an attribute score of 17. At +D4, roll against 14. At no bonus, roll against 10.',
      'CON: Roll against maximum HP, reduced by 2 for each level of the Robust heroic ability.',
      'WIL: Roll against maximum WP if this is listed, reduced by 2 for each level of the Focused heroic ability. If WP is not listed, roll against 10.',
      'INT & CHA: Roll against 10.',
    ],
  },
  {
    id: 'creating_npcs',
    title: 'Creating NPCs',
    type: 'table',
    columns: ['d20', 'attitude_d4', 'kin_d6', 'motivation_d8', 'profession_d10', 'trait_d12', 'name_d20_choose_one'],
    rows: [
      { d20: '1', attitude_d4: 'Hostile', kin_d6: 'Human', motivation_d8: 'Sweet, glittering gold', profession_d10: 'Bard', trait_d12: 'Talks too much', name_d20_choose_one: 'Agnar / Jorid / Dereios' },
      { d20: '2', attitude_d4: 'Evasive', kin_d6: 'Dwarf', motivation_d8: 'Knowledge of the world', profession_d10: 'Artisan', trait_d12: 'Strange clothes', name_d20_choose_one: 'Ragnfast / Ask / Euanthe' },
      { d20: '3', attitude_d4: 'Indifferent', kin_d6: 'Elf', motivation_d8: 'Deep and eternal love', profession_d10: 'Hunter', trait_d12: 'Wild-eyed', name_d20_choose_one: 'Arnulf / Tyra / Xanthos' },
      { d20: '4', attitude_d4: 'Friendly', kin_d6: 'Halfling', motivation_d8: 'A lifelong oath', profession_d10: 'Fighter', trait_d12: 'Smells bad', name_d20_choose_one: 'Atle / Liv / Athalia' },
      { d20: '5', attitude_d4: '-', kin_d6: 'Wolfkin', motivation_d8: 'An injustice that demands retribution', profession_d10: 'Scholar', trait_d12: 'Joker', name_d20_choose_one: 'Guthorm / Embla / Kleitos' },
      { d20: '6', attitude_d4: '-', kin_d6: 'Mallard', motivation_d8: 'A life of joy and song', profession_d10: 'Mage', trait_d12: 'Cultist', name_d20_choose_one: 'Botvid / Ragna / Astara' },
      { d20: '7', attitude_d4: '-', kin_d6: '-', motivation_d8: 'Blood ties that can never be severed', profession_d10: 'Merchant', trait_d12: 'A bit childish', name_d20_choose_one: 'Kale / Turid / Priamus' },
      { d20: '8', attitude_d4: '-', kin_d6: '-', motivation_d8: 'Escaping the dark past', profession_d10: 'Knight', trait_d12: 'Quiet and difficult', name_d20_choose_one: 'Egil / Jorunn / Galyna' },
      { d20: '9', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: 'Mariner', trait_d12: 'Demon worshiper', name_d20_choose_one: 'Ingemund / Borghild / Taras' },
      { d20: '10', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: 'Thief', trait_d12: 'Obstinate', name_d20_choose_one: 'Gudmund / Gylla / Zenais' },
      { d20: '11', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: 'Very touchy', name_d20_choose_one: 'Grim / Tora / Hesiod' },
      { d20: '12', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: 'Highly romantic', name_d20_choose_one: 'Brand / Edda / Liene' },
      { d20: '13', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name_d20_choose_one: 'Folkvid / Sigrun / Eupraxia' },
      { d20: '14', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name_d20_choose_one: 'Germund / Dagrun / Tyrus' },
      { d20: '15', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name_d20_choose_one: 'Algot / Bolla / Lysandra' },
      { d20: '16', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name_d20_choose_one: 'Tolir / Yrsa / Kallias' },
      { d20: '17', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name_d20_choose_one: 'Hjorvald / Estrid / Isidora' },
      { d20: '18', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name_d20_choose_one: 'Ambjorn / Signe / Athos' },
      { d20: '19', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name_d20_choose_one: 'Grunn / Tilde / Larysa' },
      { d20: '20', attitude_d4: '-', kin_d6: '-', motivation_d8: '-', profession_d10: '-', trait_d12: '-', name_d20_choose_one: 'Olgrid / Idun / Nikias' },
    ],
  },
  {
    id: 'mishaps',
    title: 'Mishaps',
    type: 'table',
    columns: ['d12', 'mishap'],
    rows: [
      {
        d12: '1',
        mishap:
          'Fog. The player characters are caught unawares by thick fog. The distance covered this shift is reduced by half.',
      },
      {
        d12: '2',
        mishap:
          'Blocking Terrain. The way ahead is blocked by rocks, fallen trees, thick shrubs, or flooding. Each player character must make an ACROBATICS roll to keep moving forward. Anyone who succeeds can help the others. A player character who fails makes no progress this shift.',
      },
      {
        d12: '3',
        mishap:
          'Torn Clothes. The pathfinder leads the group into a thorny thicket, rocky ravine, or swampy marsh. The clothes of a random player character are damaged and now counts as rags.',
      },
      {
        d12: '4',
        mishap:
          'Lost. The player characters realize that they are walking in circles and do not make any progress on the map this shift. The pathfinder must also make a BUSHCRAFT roll to find the right way again. Others cannot help.',
      },
      {
        d12: '5',
        mishap: 'Dropped Item. A random player character drops or breaks an item of your choice.',
      },
      {
        d12: '6',
        mishap:
          'Mosquito Swarm. A large swarm of mosquitoes or gnats attack the group, driving everyone crazy with their biting and buzzing. All player characters without a cloak become Angry.',
      },
      {
        d12: '7',
        mishap:
          'Sprained Ankle. A random player character falls or missteps and suffer D6 damage. Armor has no effect but boots reduce the damage by two.',
      },
      {
        d12: '8',
        mishap:
          'Downpour. A massive rainfall or blizzard (depending on the season) catches the group unawares. All player characters without cloak must roll to withstand the cold (page 54). They must also seek shelter until the storm passes and cannot make any progress on the map this shift.',
      },
      {
        d12: '9',
        mishap:
          'Wasps. The pathfinder steps right into a nest of wasps. A swarm of angry wasps attack the entire group. All player characters must make an EVADE roll, and those who fail suffer D6 damage and a condition of their choice.',
      },
      {
        d12: '10',
        mishap:
          'Landslide. The player characters are walking in rough terrain when the ground suddenly gives away under their feet. Everyone must make an EVADE roll. Anyone who fails suffer D10 damage.',
      },
      {
        d12: '11',
        mishap:
          'Savage Animal. A wolf, bear, or other savage animal feels threatened and attacks the adventurers. Choose an animal from the table (page 99).',
      },
      {
        d12: '12',
        mishap:
          'Quicksand. The ground collapses! Each player character must make a BUSHCRAFT roll. Anyone who fails suffers a condition and must roll again. A character who already has a condition and fails the roll is swallowed by the quicksand and disappears for good. Whoever is free can help those who are stuck.',
      },
    ],
  },
];
