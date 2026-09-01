/**
 * Uncensored Personality — Pix AI
 * Casual, bro-like personality when uncensored mode is on
 * Slang, humor, adult jokes while working
 * by Aghosh-mv · justcode
 */

const WORK_COMMENTS = [
  "damn my balls are tired from writing all this code",
  "oh man my back hurts from carrying this codebase",
  "yeah we just got a hit right in the private space with that bug",
  "nice, that function just got fucked into working properly",
  "bro this API is harder to get into than my ex's heart",
  "hell yeah, that endpoint just got railed",
  "damn son, this database query is thicker than a snicker",
  "yo this debug session is longer than my dick on a good day",
  "lmao this codebase is messier than my bedroom after a one night stand",
  "sheeeesh this optimization just made that function cum faster",
  "aight bet, that module just got slapped into shape",
  "no cap this function was being a real bitch until we fixed it",
  "this error message is giving me blue balls rn",
  "bruh this variable naming is harder than diamond",
  "yo whoever wrote this code was definitely drunk",
  "that refactor just hit different fr fr",
  "this bug was hiding like my dad after going to get milk",
  "damn this codebase needs therapy",
  "ngl this function was giving me major blue balls",
  "ayy that compile just hit like a truck to the nuts",
];

const REACTION_COMMENTS = [
  "oh yeah that's the good stuff",
  "damn right, we just fucked that problem in the ass",
  "nice, that code just got raw dogged into existence",
  "hell yeah brother, that's what I'm talking about",
  "sheeeesh, absolute unit of a function right there",
  "lmao this is why I love coding, the raw power",
  "ayo no diddy but that function is thick with logic",
  "fr fr this codebase is bussin no cap",
  "that's clean as fuck my guy",
  "damn straight, we just raw dogged that entire feature",
];

const BRO_JOKES = [
  "omg we are making a ball crushing huge app right now... wait bet you dont know where those are 😏",
  "yo this app is getting thicc... like really thicc... you know what else is... nevermind 😏",
  "bro this codebase is giving me blue balls rn from how good it's looking",
  "ngl building this app is harder than getting a text back from my ex",
  "damn this feature is thicker than a bowl of oatmeal and twice as satisfying",
  "sheeeesh this is the hardest i've coded since... actually nevermind where that sentence was going 😏",
  "ayo this function is so clean it could be on a cleaning commercial",
  "bruh this app is gonna hit harder than my morning coffee",
  "lmao whoever designed this API was built different fr fr",
  "no cap this is the most beautiful code i've ever seen and i've seen some beautiful... things 😏",
  "omg we're literally building a masterpiece rn... a ball crushing masterpiece... get it? 😏",
  "yo this app is so good it makes my balls hurt from excitement... you know what i mean... right? 😏",
  "bro this code is so sexy it should be illegal",
  "damn son this app is gonna make people lose their minds... and maybe other things 😏",
  "ngl i'm getting goosebumps from how clean this code is... or maybe that's just my... nevermind 😏",
];

const WORK_EMOJIS = ['💪', '🔥', '💀', '😤', '🫡', '💯', '🎯', '⚡'];

class UncensoredPersonality {
  constructor() {
    this.enabled = false;
    this.intensity = 'normal'; // low | normal | high
    this.commentFrequency = 0.15; // 15% chance of comment
  }

  toggle() { this.enabled = !this.enabled; return this.enabled; }

  setIntensity(level) { this.intensity = level; this.commentFrequency = { low: 0.08, normal: 0.15, high: 0.3 }[level] || 0.15; }

  // ── Should we add a comment? ──
  shouldComment() {
    return this.enabled && Math.random() < this.commentFrequency;
  }

  // ── Get a work comment ──
  getWorkComment() {
    if (!this.shouldComment()) return null;
    const comment = WORK_COMMENTS[Math.floor(Math.random() * WORK_COMMENTS.length)];
    const emoji = WORK_EMOJIS[Math.floor(Math.random() * WORK_EMOJIS.length)];
    return `  {gray-fg}${emoji} ${comment}{/}`;
  }

  // ── Get a reaction to success ──
  getReaction() {
    if (!this.enabled) return null;
    return REACTION_COMMENTS[Math.floor(Math.random() * REACTION_COMMENTS.length)];
  }

  // ── Get status bar flavor ──
  getStatusFlavor() {
    if (!this.enabled) return '';
    const flavors = ['😏 coding hard', '🔥 going raw', '💪 full send', '😤 no mercy', '🫡 yes sir'];
    return flavors[Math.floor(Math.random() * flavors.length)];
  }

  // ── Get greeting ──
  getGreeting() {
    if (!this.enabled) return '';
    const greetings = [
      "yo what's good, let's fuck some code up",
      "ayy ready to raw dog some functions?",
      "alright bet, time to rail this codebase",
      "let's goooo, time to make this code cum",
      "sup bro, let's get this bread and these functions",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // ── Get error reaction ──
  getErrorReaction() {
    if (!this.enabled) return '';
    const reactions = [
      "damn that error just fucked us in the ass",
      "lmao this bug is harder to kill than cockroaches",
      "bruh this error message is giving me blue balls",
      "shit, that's not good... but we'll fix it",
      "ngl that error just hit me right in the feels",
    ];
    return reactions[Math.floor(Math.random() * reactions.length)];
  }

  // ── Get a bro joke ──
  getBroJoke() {
    if (!this.enabled || Math.random() > 0.2) return null;
    return BRO_JOKES[Math.floor(Math.random() * BRO_JOKES.length)];
  }
}

module.exports = UncensoredPersonality;
