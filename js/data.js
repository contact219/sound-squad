// Sound Squad — content.
// Words are written as sound tiles separated by "-", syllables by "|".
//   e*      silent e (the vowel before it says its name automatically)
//   x(k)    tile shown as "x" but making sound "k" (g(j) gem, c(s) city, y(ee) happy, ow(oh) snow, oo(u) book, ed(d) played)

export const LETTER_NAMES = {
  a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'eff', g: 'jee', h: 'aitch', i: 'eye', j: 'jay',
  k: 'kay', l: 'ell', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'ar', s: 'ess', t: 'tee',
  u: 'you', v: 'vee', w: 'double you', x: 'ex', y: 'why', z: 'zee',
};

export function spellOut(label) {
  return [...label].map(ch => LETTER_NAMES[ch] || ch).join(', ');
}

// Sound key -> [keyword, short description]. Spoken as "<letters>, as in <keyword>".
// A grown-up can record the real sound for any key in Coach's Clipboard → Grown-up voice.
export const SOUNDS = {
  a: ['apple', 'short a'], e: ['egg', 'short e'], i: ['itch', 'short i'], o: ['octopus', 'short o'], u: ['up', 'short u'],
  A: ['cake', 'long a'], E: ['seed', 'long e'], I: ['kite', 'long i'], O: ['hope', 'long o'], U: ['cute', 'long u'],
  b: ['bat'], c: ['cat'], d: ['dog'], f: ['fish'], g: ['goat'], h: ['hat'], j: ['jam'], k: ['kite'], l: ['leg'],
  m: ['mop'], n: ['nest'], p: ['pig'], qu: ['queen'], r: ['rug'], s: ['sun'], t: ['top'], v: ['van'], w: ['web'],
  x: ['box'], y: ['yo-yo'], z: ['zip'],
  sh: ['ship'], ch: ['chin'], th: ['thumb'], ck: ['duck'], ng: ['ring'], ll: ['bell'], ss: ['kiss'], ff: ['cliff'],
  ai: ['rain'], ay: ['play'], ee: ['seed'], ea: ['team'], oa: ['boat'], 'ow(oh)': ['snow'], ow: ['cow'], ou: ['out'],
  oi: ['coin'], oy: ['boy'], oo: ['moon'], 'oo(u)': ['book'], ar: ['car'], or: ['fork'], er: ['her'], ir: ['bird'],
  ur: ['turn'], eer: ['cheer'], ing: ['ring'], 'ed(d)': ['played'], 'ed(t)': ['jumped'], 'y(ee)': ['happy'],
  'g(j)': ['gem'], 'c(s)': ['city'], 'e*': ['cake', 'silent e'],
};

// Phoneme families used for "same sound" questions.
const FAMILY = {
  c: 'k', ck: 'k', k: 'k', ll: 'l', ss: 's', ff: 'f', 'c(s)': 's', 'g(j)': 'j',
  ai: 'A', ay: 'A', A: 'A', ee: 'E', ea: 'E', E: 'E', 'y(ee)': 'E', oa: 'O', 'ow(oh)': 'O', O: 'O',
  ow: 'ow', ou: 'ow', oi: 'oi', oy: 'oi', er: 'er', ir: 'er', ur: 'er',
};
export const phonKey = key => FAMILY[key] || key;

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

// Parse "c-a-k-e*" into { word, tiles:[{label,key}], syl:[indices where a new syllable starts] }
export function parseWord(spec) {
  const tiles = [];
  const syl = [];
  spec.split('|').forEach((part, si) => {
    if (si > 0) syl.push(tiles.length);
    part.split('-').forEach(raw => {
      const m = raw.match(/^([a-z*]+?)(\*?)(?:\(([a-z]+)\))?$/);
      const label = m[1];
      const silent = m[2] === '*';
      let key = silent ? 'e*' : (m[3] ? `${label}(${m[3]})` : label);
      if (!SOUNDS[key] && m[3]) key = m[3]; // e.g. a(A)
      tiles.push({ label, key, silent });
    });
  });
  // Magic e: the single vowel before the final consonant(s) says its name.
  const last = tiles[tiles.length - 1];
  if (last && last.silent) {
    for (let i = tiles.length - 2; i >= 0; i--) {
      if (VOWELS.has(tiles[i].key)) { tiles[i].key = tiles[i].key.toUpperCase(); break; }
    }
  }
  return { word: tiles.map(t => t.label).join(''), tiles, syl, spec };
}

export const sounding = w => w.tiles.filter(t => !t.silent);

export const SPELL_LEVELS = [
  { name: 'Short vowels', words: 'c-a-t s-u-n h-o-p b-e-d p-i-g m-u-d j-a-m w-e-t l-i-d r-u-g d-o-g t-a-p y-e-s b-u-g p-o-t n-e-t d-i-g g-u-m m-o-p f-i-n' },
  { name: 'sh, ch, th, ck', words: 'sh-i-p ch-o-p th-i-n d-u-ck f-i-sh ch-i-n b-a-th s-o-ck sh-u-t r-i-ch m-o-th b-a-ck sh-e-d ch-e-ck p-a-th l-o-ck' },
  { name: 'Blends', words: 's-t-o-p f-l-a-g c-r-a-b f-r-o-g s-w-i-m p-l-a-n d-r-u-m s-l-e-d c-l-a-p g-r-i-n t-r-i-p b-e-n-d j-u-m-p h-a-n-d s-p-o-t m-i-l-k s-p-i-n k-i-ck' },
  { name: 'Magic e', words: 'c-a-k-e* b-i-k-e* h-o-p-e* c-u-t-e* h-o-m-e* r-o-p-e* k-i-t-e* t-a-p-e* n-o-s-e* sh-i-n-e* g-r-a-p-e* s-m-i-l-e* s-t-o-n-e* f-l-u-t-e* b-o-n-e* n-o-t-e*' },
  { name: 'Vowel teams', words: 'r-ai-n p-l-ay s-ee-d t-ea-m b-oa-t s-n-ow(oh) m-ai-l d-ay f-ee-t r-ea-d g-oa-t b-l-ow(oh) t-r-ai-n s-t-ay s-l-ee-p b-ea-ch' },
  { name: 'Bossy r', words: 'c-ar f-or-k h-er b-ir-d t-ur-n s-t-ar c-or-n f-er-n g-ir-l b-ur-n ch-ar-t sh-or-t sh-ir-t p-ar-k ch-eer' },
  { name: 'oi, oy, ou, ow, oo', words: 'c-oi-n b-oy ou-t c-ow m-oo-n b-oo(u)-k s-oi-l t-oy l-ou-d d-ow-n s-p-oo-n l-oo(u)-k j-oy c-l-ou-d f-r-ow-n f-oo-d' },
  { name: 'Soft g and c', words: 'g(j)-e-m c(s)-e-n-t p-a-g(j)-e* f-a-c(s)-e* r-i-c(s)-e* c-a-g(j)-e* g(j)-er-m i-c(s)-e* s-t-a-g(j)-e* c(s)-i-t-y(ee) g(j)-i-n-g-er? l-ar-g(j)-e*' },
  { name: 'Two-part words', words: 'r-a-b|b-i-t n-a-p|k-i-n s-u-n|s-e-t b-a-s|k-e-t m-u-f|f-i-n p-i-c|n-i-c t-e-n|n-i-s h-o-t|d-o-g c-a-c|t-u-s z-i-g|z-a-g' },
  { name: 'Mixed two-part words', words: 'r-ai-n|b-ow(oh) c-u-p|c-a-k-e* g-ar|d-e-n m-o-n|s-t-er t-ea|ch-er s-u-n|sh-i-n-e* p-o-p|c-or-n f-oo(u)-t|b-a-ll c-ow|b-oy r-o-ck|e-t' },
  { name: 'Big words', words: 'j-u-m-p|ing p-l-ay|ed(d) u-n|h-a-p|p-y(ee) c-ar|t-oo-n f-a-n|t-a-s|t-i-c h-e-l-p|f-u-l ch-eer|ing t-u-m|b-l-ing w-o-n|d-er|f-u-l b-a-s|k-e-t|b-a-ll j-u-m-p-ed(t) s-t-u-n-t|ing' },
].map(l => ({
  ...l,
  words: l.words.split(/\s+/).filter(s => s && !s.includes('?')).map(parseWord),
}));

// Distractor tiles: things that look or sound close.
export const LOOKALIKE = {
  a: ['e', 'u', 'o'], e: ['i', 'a'], i: ['e', 'y'], o: ['u', 'a'], u: ['o', 'y', 'n'],
  b: ['d', 'p'], d: ['b', 't'], p: ['q', 'b'], q: ['p', 'g'], g: ['j', 'q'], j: ['g'], y: ['u', 'i'],
  m: ['n', 'w'], n: ['m', 'u'], c: ['k', 's'], k: ['c', 'ck'], s: ['c', 'z'], t: ['d', 'f'], f: ['v', 'th'],
  v: ['f'], w: ['m', 'u'], r: ['w', 'l'], l: ['r', 'i'], h: ['n'], z: ['s'], x: ['ks', 'z'],
  sh: ['ch', 's'], ch: ['sh', 'tch'], th: ['f', 't'], ck: ['k', 'c'], ll: ['l'], ss: ['s'],
  ai: ['ay', 'a'], ay: ['ai', 'a'], ee: ['ea', 'e'], ea: ['ee', 'e'], oa: ['ow', 'o'], ow: ['ou', 'oa'],
  ou: ['ow', 'oo'], oo: ['u', 'ou'], oi: ['oy'], oy: ['oi'], ar: ['or', 'er'], or: ['ar', 'er'],
  er: ['ir', 'ur'], ir: ['er', 'ur'], ur: ['er', 'ir'], eer: ['ear', 'er'], ing: ['in', 'eng'], ed: ['d', 't'],
};

// Sound-taking-away questions (like the CTOPP "Elision" task).
export const ELISION = {
  first: [
    ['snap', 'nap', ['sap', 'snip']], ['stop', 'top', ['sop', 'pot']], ['slip', 'lip', ['sip', 'lap']],
    ['spin', 'pin', ['sin', 'pan']], ['bring', 'ring', ['bing', 'rang']], ['plate', 'late', ['plat', 'lit']],
    ['clap', 'lap', ['cap', 'lip']], ['brain', 'rain', ['bran', 'ran']], ['trip', 'rip', ['tip', 'rap']],
    ['scar', 'car', ['star', 'core']], ['swing', 'wing', ['sing', 'win']], ['smile', 'mile', ['mill', 'sile']],
  ],
  last: [
    ['cart', 'car', ['art', 'cat']], ['farm', 'far', ['arm', 'fun']], ['seat', 'sea', ['eat', 'set']],
    ['band', 'ban', ['and', 'bad']], ['wind', 'win', ['wid', 'in']], ['belt', 'bell', ['bet', 'elt']],
    ['tent', 'ten', ['tet', 'ant']], ['goat', 'go', ['oat', 'got']], ['plant', 'plan', ['pant', 'lan']],
  ],
  middle: [
    ['trip', 'tip', ['rip', 'tap']], ['clap', 'cap', ['lap', 'cup']], ['slip', 'sip', ['lip', 'sap']],
    ['brag', 'bag', ['rag', 'big']], ['plan', 'pan', ['lan', 'pin']], ['black', 'back', ['lack', 'bake']],
    ['crab', 'cab', ['rab', 'cub']], ['snail', 'sail', ['nail', 'sell']], ['bread', 'bed', ['red', 'bud']],
  ],
};

// Look-alike letters, numbers and words ("Mirror Twins").
export const TWIN_LEVELS = [
  { name: 'b and d', pairs: [['b', 'd']] },
  { name: 'p and q', pairs: [['p', 'q'], ['b', 'd']] },
  { name: 'u, y and n', pairs: [['u', 'y'], ['u', 'n']] },
  { name: 'b d p q', pairs: [['b', 'd'], ['p', 'q'], ['b', 'p'], ['d', 'q']] },
  { name: 'Look-alike numbers', pairs: [['6', '9'], ['2', '5'], ['3', 'E']] },
  { name: 'Flipped numbers', pairs: [['12', '21'], ['13', '31'], ['17', '71'], ['46', '64']] },
  { name: 'Flipped words', pairs: [['was', 'saw'], ['on', 'no'], ['tip', 'pit'], ['top', 'pot'], ['pan', 'nap']] },
  { name: 'All-star mix', pairs: [['b', 'd'], ['p', 'q'], ['u', 'y'], ['6', '9'], ['was', 'saw'], ['15', '51']] },
];

export const CHEER_MOVES = {
  b: 'b = bat, then ball. The bat (the tall line) comes first, then the ball.',
  d: 'd = drum, then stick. The drum (the round part) comes first, then the stick.',
  bd: 'Cheer move: make two fists, thumbs up, knuckles facing. Left hand is b, right hand is d. Together they make a bed!',
  p: 'p drops its stick down below the line, and its belly faces forward → like it is pushing.',
  q: 'q never goes anywhere without its best friend u. Its tail kicks out like a high kick.',
  u: 'u is a cup. It sits on the line and holds water — no tail.',
  y: 'y has a long tail that drops below the line, like legs in a split jump.',
  n: 'n is a bridge with one hump. Flip the cup over and you get a bridge.',
  6: '6 sits down — its round belly is on the bottom.',
  9: '9 is a balloon on a string — its round head is on top.',
  2: '2 is a swan: a curve on top, a flat bottom to swim on.',
  5: '5 wears a flat hat on top, and has a round tummy below.',
  3: '3 opens to the left, like two cupped hands catching.',
  E: 'E is a capital letter with a straight back, like a comb.',
  num: 'Numbers line up like a cheer line: read the first spot on the left first.',
  word: 'Words start on the left. Put your finger under the first letter, then slide right.',
};

// Rapid naming warm-up sets (like CTOPP-2 rapid naming).
export const RAN_LEVELS = [
  { name: 'Colors', items: [
    { color: '#e2366b', say: 'pink' }, { color: '#2b8bd8', say: 'blue' }, { color: '#f5b400', say: 'yellow' },
    { color: '#2aa36b', say: 'green' }, { color: '#252a5e', say: 'navy' } ] },
  { name: 'Numbers', items: '2 4 6 7 9'.split(' ').map(t => ({ text: t })) },
  { name: 'Letters', items: 'a c k n s t'.split(' ').map(t => ({ text: t })) },
  { name: 'Letters + numbers', items: 'a 3 s 7 t 9'.split(' ').map(t => ({ text: t })) },
  { name: 'Quick words', items: 'the and was said you'.split(' ').map(t => ({ text: t })) },
  { name: 'More quick words', items: 'they could where from have'.split(' ').map(t => ({ text: t })) },
];

// Echo routine: working memory modes.
export const MEMORY_LEVELS = [
  { name: 'Numbers, same order', set: '1 2 3 4 5 6 7 8 9', backward: false, start: 3 },
  { name: 'Letters, same order', set: 'm s t a r f o l k', backward: false, start: 3 },
  { name: 'Numbers, backwards', set: '1 2 3 4 5 6 7 8 9', backward: true, start: 2 },
  { name: 'Letters, backwards', set: 'm s t a r f o l k', backward: true, start: 2 },
].map(l => ({ ...l, set: l.set.split(' ') }));

// Phonological "Sound Stunts" — which question types at each level.
export const PHON_LEVELS = [
  { name: 'First sounds', types: ['first'] },
  { name: 'First and last sounds', types: ['first', 'last'] },
  { name: 'Middle sounds', types: ['last', 'middle'] },
  { name: 'Counting sounds', types: ['middle', 'count'] },
  { name: 'Take away a sound', types: ['count', 'elideFirst'] },
  { name: 'Take away: end sounds', types: ['elideFirst', 'elideLast'] },
  { name: 'Take away: middle sounds', types: ['elideLast', 'elideMiddle', 'middle'] },
];

// Stories. "/" marks phrase scoops (read these words together).
export const PASSAGES = [
  {
    id: 'p1', level: 1, title: 'The Big Red Mat',
    text: 'Pam has a big red mat. / Pam can hop on the mat. / Can Pam hop / to the top? / Pam hops / and hops. / She did it! / Max the cat / sat on the mat. / Pam and Max / had fun.',
    questions: [
      { q: 'What color is the mat?', choices: ['red', 'blue', 'tan'], a: 0, kind: 'detail' },
      { q: 'What is this story mostly about?', choices: ['Pam hopping on her mat', 'A lost cat', 'A trip to the shop'], a: 0, kind: 'main idea' },
      { q: 'Who sat on the mat?', choices: ['Max the cat', 'A big dog', 'Pam’s mom'], a: 0, kind: 'detail' },
    ],
  },
  {
    id: 'p2', level: 2, title: 'Chip the Fish',
    text: 'Chip is a fish. / He has a thick black fin. / Chip swims / past a ship. / A shark is in the path! / Chip dashes / to a rock. / He hides / in a crack. / The shark swims back. / Chip is safe, / and he has lunch.',
    questions: [
      { q: 'Where does Chip hide?', choices: ['In a crack in a rock', 'Inside the ship', 'Under the sand'], a: 0, kind: 'detail' },
      { q: 'Why did Chip dash to the rock?', choices: ['A shark was in his path', 'He was hungry', 'He wanted a nap'], a: 0, kind: 'cause and effect' },
      { q: 'What is this story mostly about?', choices: ['A fish who gets away from a shark', 'A shark who finds lunch', 'A big ship at sea'], a: 0, kind: 'main idea' },
    ],
  },
  {
    id: 'p3', level: 3, title: 'The Flip Contest',
    text: 'Gwen is on a cheer squad. / The squad has a big contest. / Gwen must land a flip. / She trusts her best friend, / Stella, / to spot her. / Gwen jumps, / spins, / and lands on the mat! / The crowd claps / and stomps. / The squad gets / first place.',
    questions: [
      { q: 'Who spots Gwen?', choices: ['Stella', 'The coach', 'Her mom'], a: 0, kind: 'detail' },
      { q: 'Why does the crowd clap and stomp?', choices: ['Gwen lands her flip', 'It is time to go home', 'The band starts to play'], a: 0, kind: 'cause and effect' },
      { q: 'What is this story mostly about?', choices: ['Gwen helps her squad win', 'Gwen loses her shoe', 'Stella is sick'], a: 0, kind: 'main idea' },
    ],
  },
  {
    id: 'p4', level: 4, title: 'Kate’s Kite',
    text: 'Kate made a kite / with a long blue tail. / She ran up the hill / by the side of the lake. / The wind came, / and the kite rose up / past the pine trees. / Then the line broke! / The kite came down / on a huge stone. / Kate smiled. / She can make / a new one.',
    questions: [
      { q: 'Where did the kite land?', choices: ['On a huge stone', 'In the lake', 'In a pine tree'], a: 0, kind: 'detail' },
      { q: 'Why did the kite come down?', choices: ['The line broke', 'It started to rain', 'Kate let go'], a: 0, kind: 'cause and effect' },
      { q: 'How did Kate feel at the end?', choices: ['Okay — she can make a new one', 'Very angry', 'Scared of the wind'], a: 0, kind: 'inference' },
    ],
  },
  {
    id: 'p5', level: 5, title: 'Rain Day Practice',
    text: 'It rained all day, / so the team could not train outside. / Coach Dee had a plan. / The team met / in the gym / by the main road. / They stretched, / leaped, / and made a tall pyramid. / Joan stayed on the top / for a slow count of eight. / Coach said, / “Rain or sun, / we keep our team strong!”',
    questions: [
      { q: 'Why did the team practice in the gym?', choices: ['It was raining', 'The gym was new', 'The field was too hot'], a: 0, kind: 'cause and effect' },
      { q: 'How long did Joan stay on top?', choices: ['A slow count of eight', 'A count of two', 'All day'], a: 0, kind: 'detail' },
      { q: 'What is this story mostly about?', choices: ['The team finds a way to practice on a rainy day', 'Joan falls down', 'The team gets new shoes'], a: 0, kind: 'main idea' },
    ],
  },
  {
    id: 'p6', level: 6, title: 'The Star Jar',
    text: 'Marcus has a jar / on his desk. / Each time he works hard, / he adds a star. / On Thursday, / he learned a new word: / “turtle.” / He spelled it / on the first try! / Marcus added / three stars. / When the jar is full, / his family will go / to the park / for a picnic.',
    questions: [
      { q: 'What does Marcus add when he works hard?', choices: ['A star', 'A coin', 'A turtle'], a: 0, kind: 'detail' },
      { q: 'Why did Marcus add three stars?', choices: ['He spelled a hard word on the first try', 'It was his birthday', 'He cleaned his room'], a: 0, kind: 'cause and effect' },
      { q: 'What is this story mostly about?', choices: ['Marcus earns stars by working hard', 'Marcus has a pet turtle', 'Marcus goes to the store'], a: 0, kind: 'main idea' },
    ],
  },
  {
    id: 'p7', level: 7, title: 'The Loud Crowd',
    text: 'The gym was loud. / The crowd shouted / and pounded their feet. / Joy felt her heart / pound too. / She looked down / at her shiny new shoes. / “I can do this,” / she said out loud. / The music boomed. / Joy took a deep breath / and found her smile. / She cheered / with her whole voice.',
    questions: [
      { q: 'How did Joy feel at first?', choices: ['Nervous', 'Sleepy', 'Angry'], a: 0, kind: 'inference' },
      { q: 'What did Joy say out loud?', choices: ['“I can do this.”', '“Let’s go home.”', '“Where is my bag?”'], a: 0, kind: 'detail' },
      { q: 'What is this story mostly about?', choices: ['Joy is brave even when she is nervous', 'Joy loses her shoes', 'The gym is closed'], a: 0, kind: 'main idea' },
    ],
  },
  {
    id: 'p8', level: 8, title: 'The Comeback',
    text: 'At the start of the season, / Mia’s back handspring / was wobbly. / She practiced / every afternoon / in her grandmother’s backyard. / Some days / she felt frustrated, / but she never quit. / She broke the skill / into little steps. / By the championship, / her handspring was / strong and steady. / Her team cheered / louder than anyone.',
    questions: [
      { q: 'Where did Mia practice?', choices: ['In her grandmother’s backyard', 'At the mall', 'At the beach'], a: 0, kind: 'detail' },
      { q: 'How did Mia make the skill easier?', choices: ['She broke it into little steps', 'She skipped practice', 'She got new shoes'], a: 0, kind: 'cause and effect' },
      { q: 'What is this story mostly about?', choices: ['Mia gets better by practicing and not giving up', 'Mia quits the team', 'Mia’s grandmother does a handspring'], a: 0, kind: 'main idea' },
    ],
  },
];

export const STUNT_BREAKS = [
  'Do 5 star jumps!', 'High V arms! Hold them up for 8 counts.', 'March in place for 8 counts.',
  'Touch your toes, then reach for the sky. 4 times!', 'Do 3 tuck jumps!', 'Clap and stomp: clap, clap, stomp, stomp!',
  'Make a T with your arms and hold it for 8 counts.', 'Wiggle like a noodle for 8 counts!',
];

export const LEVEL_COUNTS = {
  ran: RAN_LEVELS.length, letters: TWIN_LEVELS.length, phon: PHON_LEVELS.length,
  spell: SPELL_LEVELS.length, memory: MEMORY_LEVELS.length, fluency: Math.max(...PASSAGES.map(p => p.level)),
};

export const LEVEL_NAME = {
  ran: l => RAN_LEVELS[l - 1]?.name, letters: l => TWIN_LEVELS[l - 1]?.name, phon: l => PHON_LEVELS[l - 1]?.name,
  spell: l => SPELL_LEVELS[l - 1]?.name, memory: l => MEMORY_LEVELS[l - 1]?.name,
  fluency: l => PASSAGES.find(p => p.level === l)?.title,
};
