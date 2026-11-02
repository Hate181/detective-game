/* English texts for the game reference data (see content.js for the Russian originals and the meaning of each list).
   Keys must stay the same as in content.js: only the words change. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DetectiveContentEn = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TAGS = {
    smoker:   { label: 'Smokes', habit: 'Smokes', clues: ['Fresh ash and a cigarette butt were found at the scene. The culprit smokes.', 'The room smells of tobacco, though the victim never smoked. The culprit smokes.', 'Three identical cigarette butts lie in the grass under the window. The culprit smokes.'] },
    lefty:    { label: 'Left-handed', habit: 'Left-handed', clues: ['The blow came from a left hand. The culprit is left-handed.', 'The prints on the door handle were left by a left hand. The culprit is left-handed.', 'The lock was picked the way a left-hander would do it. The culprit is left-handed.'] },
    late:     { label: 'Night owl', habit: 'Never sleeps at night', clues: ['The light in the window burned until dawn. The culprit is used to staying up all night.', 'The culprit knew that at that dead hour nobody would be awake or expecting visitors. The culprit is a night owl.', 'The night watchman heard footsteps in the quietest hour. The culprit stays up at night.'] },
    quiet:    { label: 'Moves silently', habit: 'Moves without a sound', clues: ['Nobody heard any footsteps. The culprit can move silently.', 'Not a single floorboard creaked. The culprit moves without a sound.'] },
    perfume:  { label: 'Heavy perfume', habit: 'Wears heavy perfume', clues: ['A trail of heavy perfume hung in the room. The culprit wears it.', 'A handkerchief by the door still smells of heavy perfume. The culprit wears it.'] },
    french:   { label: 'Knows French', habit: 'Speaks French', clues: ['A note in French lay next to the body. The culprit knows the language.', 'A scrap of a French sentence was found on the desk. The culprit speaks French.'] },
    strong:   { label: 'Physically strong', habit: 'Unusually strong', clues: ['The body was moved, and that is heavy work. The culprit had the strength for it.', 'A blow like that takes strength. The culprit has it.'] },
    tools:    { label: 'Good with tools', habit: 'Handy with anything', clues: ['The lock was opened by someone who knew what they were doing. The culprit is good with tools.', 'The hinges were taken off neatly, with no sign of forcing. The culprit is handy with tools.'] },
    cane:     { label: 'Walks with a cane', habit: 'Walks with a cane', clues: ['Round dents from a cane were left in the carpet. The culprit walks with a cane.', 'The tap of a cane was heard in the corridor ten minutes before the scream. The culprit walks with a cane.'] },
    gloves:   { label: 'Wears gloves', habit: 'Never takes off their gloves', clues: ['Not one fingerprint on the handles or the glasses. The culprit never takes off their gloves.', 'A leather glove left a smear on the glass. The culprit wears gloves.'] },
    whistle:  { label: 'Whistles', habit: 'Whistles tunes', clues: ['Someone behind the wall was softly whistling an unfamiliar tune. The culprit whistles.', 'A witness remembered a snatch of a tune someone was whistling. The culprit likes to whistle.'] },
    candy:    { label: 'Carries sweets', habit: 'Always has boiled sweets on them', clues: ['A sweet wrapper was found in the ashtray. The culprit carries sweets.', 'A sticky toffee wrapper glinted on the floor. The culprit always has sweets.'] },
    limp:     { label: 'Limps', habit: 'Walks with a limp', clues: ['The footprints are uneven: one foot came down harder than the other. The culprit limps.', 'The trail to the door belongs to someone favouring one leg. The culprit limps.'] },
    glasses:  { label: 'Wears glasses', habit: 'Wears thick glasses', clues: ['An arm from a pair of thick glasses was found under the table. The culprit wears glasses like that.', 'A dropped lens lay on the floor. The culprit wears glasses.'] },
    safe:     { label: 'Knows the safe code', clues: ['The safe was opened without force. The culprit knew the code.', 'The safe lock is intact, but the contents are gone. The culprit knew the combination.'] },
    keys:     { label: 'Has keys', clues: ['The door was not forced. The culprit had keys.', 'The lock was opened with its own key, not a pick. The culprit had keys.'] },
    medic:    { label: 'Knows poisons', clues: ['Death came neatly, leaving almost no trace. The culprit knows poisons and anatomy.', 'The dose was measured exactly. The culprit knows medicine.'] },
    tech:     { label: 'Good with machines', clues: ['The lights went out at exactly the right moment. The culprit knows machinery.', 'The wire was cut as if someone knew the wiring. The culprit knows machinery.'] },
    cash:     { label: 'Access to money', clues: ['A large sum went missing from the till. The culprit had access to the money.', 'The money left quietly and the books look clean. The culprit had access to the money.'] },
    passages: { label: 'Knows service passages', clues: ['The tracks lead to a service passage. The culprit knows the back ways.', 'The escape route ran through a corridor closed to guests. The culprit knows the service passages.'] },
    driver:   { label: 'Can drive', clues: ['The tyre tracks by the back door are fresh. The culprit can drive.'] },
    sched:    { label: 'Knows the schedule', clues: ['The timing matched the rounds exactly. The culprit knows the schedule.'] },
  };

  const TRAITS = {
    profession: 'Profession',
    habit: 'Trait',
    relation: 'Tie to the victim',
    motive: 'Motive',
    alibi: 'Alibi',
    secret: 'Secret',
    goal: 'Personal goal',
  };

  const RELATIONS = [
    'A distant relative on the mother\'s side', 'Business partners for more than ten years', 'An old friendship that cracked',
    'Worked in the victim\'s household', 'Owed the victim money', 'Was owed money by the victim',
    'A long business rivalry', 'Neighbours with friends in common', 'An affair that ended in a scandal',
    'Worked on a project together', 'Shared an inheritance', 'Knew each other from university',
    'Served together years ago', 'A shared secret from twenty years back', 'Guaranteed someone else\'s loan together',
    'Was taught by the victim', 'Worked under the victim', 'The same lawyer and the same lawsuits',
    'A correspondence that broke off long ago', 'Both quit the same club',
    'A recent quarrel over nothing', 'A trip together nobody likes to talk about', 'The same godparent',
    'Partners in a deal that fell through', 'Friends in common who fell out for good', 'Saw the same doctor',
    'Rents premises from the victim', 'Lets a room to the victim', 'Worked at the same factory when young',
    'Years of favours back and forth', 'A partnership that ended without a word', 'Met through the same charity',
    'A chance meeting that turned into a long acquaintance', 'A dispute over a property line', 'The victim once helped with housing',
    'The victim refused to write a reference', 'Both collect the same things', 'Was a witness at the victim\'s wedding',
    'An old rivalry at the polls', 'A failed match the victim tried to arrange',
  ];
  const MOTIVES = [
    'The victim threatened to expose them', 'A debt the victim wanted back', 'A share of the estate under the will',
    'The victim wrecked the deal of a lifetime', 'An old grudge never settled', 'A compromising letter the victim kept',
    'The victim was about to have them fired', 'Jealousy', 'The victim stole their idea',
    'A forged signature the victim knew about', 'A career ruined by the victim', 'The victim refused the one favour that mattered',
    'An insurance payout after the victim\'s death', 'A secret about their birth that the victim knew', 'Money lost to the victim',
    'Public humiliation by the victim', 'The victim meant to sell the shared business', 'A position the victim took from them',
    'The victim found out about a large embezzlement', 'A lawsuit lost because of the victim\'s testimony', 'An inheritance the victim took away',
    'Rumours the victim spread', 'The victim was going to change the will', 'The victim gave away a family secret',
    'A promise the victim never kept', 'A manuscript the victim stole', 'An appointment the victim blocked',
    'The victim refused to return something that wasn\'t theirs', 'Blackmail by the victim', 'The victim exposed an old fraud',
    'Ruined by following the victim\'s advice', 'An old family feud', 'The victim broke a business agreement',
    'The victim refused to testify in their defence', 'The victim meant to reopen an old case', 'A bet lost because of the victim',
    'The victim learned about their double life', 'The victim threatened to withdraw their patronage', 'A long dispute over the rights to an invention',
    'The victim flatly refused an alliance',
  ];
  const SECRET_LOC = [
    'eavesdropping on someone else\'s conversation', 'a secret call to a blackmailer', 'hiding a stolen item', 'falling asleep on duty',
    'drinking on the quiet', 'losing at cards', 'reading someone else\'s letters', 'rehearsing a confession alone',
    'a secret meeting with a journalist', 'passing a note to a competitor', 'sneaking out for cigarettes', 'looking for a lost letter',
    'searching someone\'s belongings at night', 'a secret date', 'trying to repay a debt behind everyone\'s back', 'going through someone else\'s papers',
    'talking to a lawyer with no witnesses', 'burning papers', 'meeting an unknown messenger', 'quietly searching someone\'s study',
  ];
  const SECRET_PLAIN = [
    'A conviction in their youth, kept quiet', 'Secretly writing a book about this whole story', 'Secretly working for an insurance company',
    'Serious debts nobody knows about', 'A forged reference letter when they were hired', 'Years of reading other people\'s post',
    'Secret money from the victim\'s competitors', 'No diploma, though everyone thinks they have one', 'A made-up past on their CV',
    'A second address in another city', 'Owes money to a loan shark', 'Secret letters to an ex',
    'Related to one of the guests and hiding it', 'An award that really belongs to someone else', 'A forbidden passion for gambling',
    'A secret deal to sell part of the property', 'A letter planted in someone else\'s luggage', 'A forged document in their personnel file',
    'Took money to keep quiet', 'Lived under a different name in the past', 'An illness hidden from the family',
    'A deal hidden from their partners', 'A hidden link to a competitor', 'An old subscription to a paper nobody should admit to reading',
  ];
  const GENERIC_PROFESSIONS = [
    { name: 'House guest', tags: [] }, { name: 'Old friend of the family', tags: [] }, { name: 'Journalist', tags: ['french'] },
    { name: 'Collector', tags: ['cash'] }, { name: 'Insurance agent', tags: ['safe'] }, { name: 'Neighbour', tags: [] },
    { name: 'Student', tags: ['tech'] }, { name: 'Musician', tags: ['quiet'] }, { name: 'Photographer', tags: ['tech'] },
    { name: 'Pensioner', tags: [] },
    { name: 'Teacher', tags: ['french'] }, { name: 'Pharmacist', tags: ['medic'] }, { name: 'Sales rep', tags: ['cash'] },
    { name: 'Engineer', tags: ['tech', 'tools'] }, { name: 'Taxi driver', tags: ['driver'] }, { name: 'Priest', tags: ['quiet'] },
  ];

  const CARDS = {
    warrant:   { name: 'Search', desc: 'Secretly look at one hidden line on a player\'s card.' },
    advocate:  { name: 'Lawyer', desc: 'Cancel one vote against you when you are about to be voted out.' },
    confront:  { name: 'Face-off', desc: 'Put two players face to face: both reveal their alibi, tie to the victim or motive to everyone, your choice.' },
    testimony: { name: 'Testimony', desc: 'Make a player reveal one specific line.' },
    swap:      { name: 'Planted Clue', desc: 'Secretly swap the next clue to be found: it will point at the player you choose.' },
    lab:       { name: 'Forensics', desc: 'Secretly check one of the clues found so far: genuine or planted.' },
    trail:     { name: 'False Trail', desc: 'Works by itself, once: when a Search would have given you away, it shows a clean result instead.' },
  };
  const AWARDS = {
    liar:     { title: 'Best Liar' },
    sherlock: { title: 'Sherlock' },
    self:     { title: 'Gave Themselves Away' },
    framer:   { title: 'Framed an Innocent' },
  };
  const CARDS_NPC = {
    warrant: 'Secretly look at one hidden line on a character\'s card. Only you see it.',
    confront: 'Put two characters face to face: both reveal their alibi, tie to the victim or motive to everyone.',
    testimony: 'Make a character reveal one specific line to everyone.',
    swap: 'From round two, secretly swap the next clue: it will point at the character you choose.',
    lab: 'Secretly check one of the clues found so far: genuine or planted.',
    trail: 'Held by one of the culprits: the first Search that would give them away shows a clean result.',
  };
  const PROMPTS = {
    profession: 'Tell everyone what you do and how it ties you to this place.',
    habit: 'Show yourself: when has this habit given you away?',
    relation: 'How did you meet the victim, and what was between you?',
    motive: 'Why might people suspect you? Explain it yourself.',
    alibi: 'Where were you at the time of the murder, and who can confirm it?',
    secret: 'You decided to come clean. Tell the whole story.',
    free: 'Tell us about yourself: what you did tonight, who you saw, what seemed off.',
  };
  const BOT_NAMES = ['Inspector Grey', 'Miss Marple', 'Sam Spade', 'Vera Kholodnaya', 'Count Orloff', 'Doctor Watson', 'Irene Adler', 'Philip Marlowe', 'Lisa Korf', 'Inspector Maigret'];

  /* Names for the six suspects in the 2–5 mode, by era. Built from first names and surnames,
     with a handful of joke names mixed in, as in the Russian lists. */
  function mix(firsts, lasts, jokes, n) {
    const out = [];
    const seen = new Set();
    let i = 0;
    while (out.length < n - jokes.length && i < firsts.length * lasts.length) {
      const f = firsts[(i * 7) % firsts.length];
      const l = lasts[(i * 13 + Math.floor(i / firsts.length)) % lasts.length];
      const name = f + ' ' + l;
      if (!seen.has(name)) { seen.add(name); out.push(name); }
      i++;
    }
    jokes.forEach((j, k) => out.splice(Math.min(out.length, 3 + k * 8), 0, j));
    return out.slice(0, n);
  }
  const NPC_NAMES = {
    classic: mix(
      ['Ada', 'Albert', 'Agatha', 'Arthur', 'Beatrice', 'Bernard', 'Clara', 'Cecil', 'Dorothy', 'Edmund', 'Edith', 'Felix', 'Florence', 'Frederick', 'Grace', 'Gilbert', 'Harriet', 'Horace', 'Irene', 'Jasper', 'Josephine', 'Leopold', 'Lillian', 'Mabel', 'Montague', 'Margaret', 'Nigel', 'Olive', 'Oswald', 'Penelope', 'Percival', 'Rosalind', 'Rupert', 'Sybil', 'Theodore', 'Violet', 'Walter', 'Winifred', 'Ambrose', 'Eleanor', 'Cornelius', 'Hattie', 'Lionel', 'Marguerite', 'Silas', 'Vera'],
      ['Ashcombe', 'Blackwood', 'Carrington', 'Davenport', 'Ellsworth', 'Fairfax', 'Granger', 'Hartley', 'Ingram', 'Jessop', 'Kendall', 'Langley', 'Marlowe', 'Northcott', 'Osgood', 'Pemberton', 'Quill', 'Radcliffe', 'Sinclair', 'Thorne', 'Underwood', 'Vance', 'Whitlock', 'Abernathy', 'Bellamy', 'Crowther', 'Dunmore', 'Everett', 'Finch', 'Grimsby', 'Holloway', 'Lockhart', 'Moreau', 'Nash', 'Prescott', 'Rowe', 'Stirling', 'Templeton', 'Wexford', 'Vogel', 'Brenner', 'Lindqvist', 'Delacroix', 'Ferrante'],
      ['Bartholomew Muffin', 'Apollo Crumpet', 'Lettice Scone', 'Jacques Croissant', 'Eustace Pudding', 'Agnes Blancmange', 'Barnaby Biscuit', 'Prudence Treacle', 'Fitzwilliam Jam', 'Ernest Dumpling', 'Clementine Trifle', 'Horatio Teacake', 'Hyacinth Custard', 'Cuthbert Crumble', 'Mildred Marmalade', 'Archibald Kipper', 'Gertrude Gingersnap', 'Algernon Toast', 'Wilhelmina Fudge', 'Reginald Sponge', 'Ophelia Tart', 'Ignatius Bun', 'Philippa Pancake', 'Cyril Sausage', 'Euphemia Waffle', 'Godfrey Gravy', 'Dulcie Doughnut', 'Montgomery Muffet', 'Lavinia Lemoncurd', 'Ebenezer Eclair', 'Tabitha Truffle', 'Sebastian Shortbread', 'Persephone Pie', 'Bertram Bloater', 'Isadora Icing', 'Thaddeus Tapioca', 'Minerva Meringue', 'Ptolemy Parsnip'],
      300),
    modern: mix(
      ['Abby', 'Adam', 'Alex', 'Amber', 'Ben', 'Bella', 'Caleb', 'Chloe', 'Dan', 'Daisy', 'Ethan', 'Ella', 'Finn', 'Freya', 'Gabe', 'Grace', 'Harry', 'Hannah', 'Isaac', 'Isla', 'Jack', 'Jade', 'Kai', 'Kate', 'Leo', 'Lily', 'Max', 'Maya', 'Nate', 'Nina', 'Owen', 'Olivia', 'Priya', 'Ryan', 'Ruby', 'Sam', 'Sophie', 'Tom', 'Tara', 'Zoe', 'Luca', 'Mia', 'Noah', 'Ava', 'Ravi', 'Yuki', 'Omar', 'Lena'],
      ['Adams', 'Bailey', 'Brooks', 'Carter', 'Chen', 'Cole', 'Dawson', 'Diaz', 'Ellis', 'Fisher', 'Foster', 'Grant', 'Hayes', 'Hughes', 'Jensen', 'Khan', 'Kim', 'Lane', 'Lopez', 'Marsh', 'Miller', 'Morgan', 'Novak', 'Owens', 'Patel', 'Price', 'Quinn', 'Reed', 'Reyes', 'Shaw', 'Stone', 'Tanaka', 'Turner', 'Walsh', 'Ward', 'West', 'Young', 'Silva', 'Murphy', 'Rossi', 'Kowalski', 'Nguyen'],
      ['Tommy Tiktoker', 'Sam Subscribe', 'Leo Lootbox', 'Glen Sigma', 'Karen Cringe', 'Ollie Overcharge', 'Hashtag Harper', 'Tyler Toxic', 'Reese Reels', 'Avery Avatar', 'Benny Boomer', 'Mila Memelord', 'Ziggy Ziplock', 'Lola Loading', 'Parker Patchnotes', 'Dex Debuff', 'Riley Ringlight', 'Skye Skincare', 'Cody Clickbait', 'Nova Noscope', 'Wren Wifi', 'Brody Bluecheck', 'Jett Jetlag', 'Mason Mukbang', 'Piper Ping', 'Sasha Selfie', 'Rory Ragequit', 'Gigi Gigabyte', 'Kev Keyboard', 'Tess Thumbsup', 'Vinnie Vlog', 'Callie Cooldown', 'Dusty Drama', 'Fern Filter', 'Hank Hotfix', 'Izzy Influencer', 'Molly Mute'],
      300),
  };

  const PLAYER_HINT = (label) => `The culprit has a tell: ${String(label).toLowerCase()}.`;

  return { TAGS, TRAITS, RELATIONS, MOTIVES, SECRET_LOC, SECRET_PLAIN, GENERIC_PROFESSIONS, CARDS, AWARDS, CARDS_NPC, PROMPTS, BOT_NAMES, NPC_NAMES, tell: PLAYER_HINT };
});
