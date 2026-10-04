export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// ---------- copy ----------
export const COPY = {
  msg1: 'My Xfinity bill jumped from $65 to $92 for no reason. Can you get it fixed?',
  reply1: 'On it 👍 Calling Xfinity now. I’ll text you if I need your OK on anything.',
  question:
    'Quick check before I agree to anything: Xfinity can restore your $65/mo rate, but it needs a new 12-month agreement. No other fees. Accept?',
  msg2: 'Yes, accept it. No extra charges.',
  out1: '✅ Fixed! Your plan is back to $65/mo, locked in for 12 months. Xfinity also credited this month’s $27 overcharge.',
  out2: 'That’s $324 saved this year, and 32 minutes you didn’t spend on hold.',
};

// ---------- deterministic randomness ----------
export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- typing engine ----------
export type KbMode = 'abc' | '123';
export type Tap = { t: number; key: string; ch?: string; display?: string };
export type KbState = { t: number; mode: KbMode; shift: boolean; draft: string };
export type Typing = { taps: Tap[]; states: KbState[]; start: number; end: number; text: string };

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function buildTyping(text: string, start: number, seed: number): Typing {
  const rnd = mulberry32(seed);
  let t = start;
  let mode: KbMode = 'abc';
  let shift = true;
  let draft = '';
  const taps: Tap[] = [];
  const states: KbState[] = [];
  const push = (key: string, ch?: string, display?: string) => {
    if (ch !== undefined) draft += ch;
    taps.push({ t, key, ch, display });
    states.push({ t, mode, shift, draft });
  };
  const gap = () => 0.046 + rnd() * 0.04 + (rnd() < 0.06 ? 0.07 : 0);

  for (const c of text) {
    const lower = c.toLowerCase();
    if (LETTERS.includes(lower)) {
      if (mode === '123') {
        mode = 'abc';
        push('mode');
        t += 0.11;
      }
      const upper = c !== lower;
      if (upper && !shift) {
        shift = true;
        push('shift');
        t += 0.11;
      }
      shift = false;
      push(lower, c, c);
      t += gap();
    } else if (c === ' ') {
      const endSentence = /[.?!]$/.test(draft);
      if (mode === '123') mode = 'abc';
      shift = endSentence;
      push('space', ' ');
      t += gap() + 0.025;
    } else {
      if (mode === 'abc') {
        mode = '123';
        push('mode');
        t += 0.11;
      }
      shift = false;
      push(c, c, c);
      t += gap();
    }
  }
  return { taps, states, start, end: t, text };
}

export function kbStateAt(ty: Typing, t: number): KbState {
  let s: KbState = { t: -1, mode: 'abc', shift: true, draft: '' };
  for (const st of ty.states) {
    if (st.t <= t) s = st;
    else break;
  }
  return s;
}

export function pressedAt(ty: Typing, t: number): Tap | null {
  let p: Tap | null = null;
  for (const tap of ty.taps) {
    if (tap.t <= t && t < tap.t + 0.1) p = tap;
  }
  return p;
}

// ---------- call transcript ----------
export type Line = { who: 'handle' | 'agent'; text: string; at: number; dur: number };
const dur = (s: string) => s.split(' ').length * 0.2 + 0.4;

// ---------- master timeline (seconds) ----------
function build() {
  const t1In = 0.35;
  const t1Out = 3.25;
  const t2In = 3.75;
  const t2Out = 6.35;
  const phoneIn = 6.25;
  const kbUp1 = 8.35;
  const zoomType = 8.25;
  const type1Start = 9.55;
  const typing1 = buildTyping(COPY.msg1, type1Start, 11);
  const send1 = typing1.end + 0.35;
  const typingInd1 = send1 + 1.25;
  const reply1 = typingInd1 + 1.35;
  const callStart = reply1 + 2.5;
  const ringStart = callStart + 0.5;
  const connected = ringStart + 3.75;
  const holdEnd = connected + 2.7;

  const lines: Line[] = [];
  let c = holdEnd + 0.25;
  const add = (who: Line['who'], text: string, pause = 0.3) => {
    const l = { who, text, at: c, dur: dur(text) };
    lines.push(l);
    c += l.dur + pause;
    return l;
  };
  add('agent', 'Thanks for calling Xfinity, this is Maya. How can I help?');
  add('handle', 'Hi Maya, this is Alex Chen. My bill jumped from $65 to $92 without any notice.');
  add('agent', 'I can look into that. Can you verify your account number and your original offer?', 0.2);
  const gmailStart = c;
  c += 5.4;
  const gmailEnd = c;
  add('handle', 'Sure. Account ending in 4821. My welcome email guarantees $65 a month through March 2027.');
  add('agent', 'You’re right, the lock dropped at renewal. I can restore $65, but it needs a new 12-month agreement.');
  add('handle', 'Hmm, let me check on that. One moment.', 0);
  const approval = c + 0.45;
  const bannerTap = approval + 1.9;
  const kbUp2 = bannerTap + 1.35;
  const type2Start = kbUp2 + 0.75;
  const typing2 = buildTyping(COPY.msg2, type2Start, 23);
  const send2 = typing2.end + 0.3;
  const back2Call = send2 + 1.35;
  c = back2Call + 0.75;
  add('handle', 'Okay, I’ll accept the 12-month agreement, as long as there are no added fees.');
  add('agent', 'No added fees. You’re all set at $65 a month, and I’ve credited back the $27.');
  add('handle', 'Perfect. Thanks so much, Maya!', 0);
  const callEnd = c + 0.35;
  const outScreen = callEnd + 1.4;
  const typingInd2 = outScreen + 0.7;
  const out1 = typingInd2 + 1.3;
  const out2 = out1 + 1.6;
  const stats = out1 + 0.5;
  const outroStart = out2 + 3.4;
  const outText1 = outroStart + 0.55;
  const outText1Out = outText1 + 2.7;
  const justIn = outText1Out + 0.5;
  const endCard = justIn + 2.9;
  const total = endCard + 4.6;

  return {
    t1In, t1Out, t2In, t2Out, phoneIn, kbUp1, zoomType, type1Start, typing1, send1, typingInd1, reply1,
    callStart, ringStart, connected, holdEnd, lines, gmailStart, gmailEnd, approval, bannerTap, kbUp2, type2Start, typing2, send2,
    back2Call, callEnd, outScreen, typingInd2, out1, out2, stats, outroStart, outText1, outText1Out, justIn,
    endCard, total,
  };
}

export const T = build();
export const TOTAL_FRAMES = Math.ceil(T.total * FPS);

export const HOLD_SECONDS = 31 * 60 + 42;

/** Call clock in seconds (null while ringing). Hold time is fast-forwarded. */
export function callClock(t: number): number | null {
  if (t < T.connected) return null;
  if (t < T.holdEnd) {
    const p = (t - T.connected) / (T.holdEnd - T.connected);
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    return e * HOLD_SECONDS;
  }
  return HOLD_SECONDS + (Math.min(t, T.callEnd) - T.holdEnd);
}

export const fmtClock = (s: number) => {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
};
