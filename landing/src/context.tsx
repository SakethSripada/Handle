import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { T, callClock, fmtClock, Line } from './story/timeline';
import { clamp01, outExpo, prog } from './story/anim';
import { GmailLogo, HandleAvatar, LIME } from './story/components/Brand';
import { EASE } from './lib';

export function currentLine(t: number): Line | null {
  if (t >= T.gmailStart - 0.1 && t < T.gmailEnd) return null;
  let cur: Line | null = null;
  for (const l of T.lines) if (l.at <= t) cur = l;
  if (!cur) return null;
  if (t > cur.at + cur.dur + 1.6) return null;
  if (t > T.approval - 0.2 && t < T.back2Call + 0.4) return null;
  return cur;
}

const Wave: React.FC<{ t: number; on: boolean; color: string }> = ({ t, on, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 18, marginLeft: 'auto' }}>
    {Array.from({ length: 6 }).map((_, i) => {
      const n = 0.5 + 0.5 * Math.sin(t * 12 + i * 1.7) * Math.sin(t * 5 + i * 0.6);
      const h = on ? 4 + Math.max(0, n) * 14 : 4;
      return <span key={i} style={{ width: 3, height: h, borderRadius: 2, background: color, opacity: on ? 1 : 0.35, transition: 'height .08s' }} />;
    })}
  </div>
);

const AgentAvatar: React.FC<{ size?: number }> = ({ size = 30 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      background: 'linear-gradient(180deg,#a9aeba,#868b97)',
      color: '#fff',
      fontSize: size * 0.38,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    XS
  </div>
);

export const LineBody: React.FC<{ l: Line; t: number; size?: number }> = ({ l, t, size = 21 }) => {
  const words = l.text.split(' ');
  const p = clamp01((t - l.at) / l.dur);
  const isH = l.who === 'handle';
  const speaking = t >= l.at && t < l.at + l.dur;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {isH ? <HandleAvatar size={30} /> : <AgentAvatar />}
        <span style={{ fontSize: 15, fontWeight: 600, color: isH ? LIME : '#a1a1a6', letterSpacing: '-0.01em' }}>
          {isH ? 'Handle' : 'Maya, Xfinity'}
        </span>
        <Wave t={t} on={speaking} color={isH ? LIME : '#8e8e93'} />
      </div>
      <div style={{ fontSize: size, lineHeight: 1.38, fontWeight: 600, letterSpacing: '-0.02em', color: '#f5f5f7' }}>
        {words.map((w, i) => (
          <span key={i} style={{ opacity: 0.2 + 0.8 * clamp01(p * words.length - i), transition: 'opacity .12s' }}>
            {w}{' '}
          </span>
        ))}
      </div>
    </div>
  );
};

export const TranscriptCard: React.FC<{ t: number; width?: number }> = ({ t, width = 360 }) => {
  const l = currentLine(t);
  return (
    <div style={{ width, minHeight: 10, position: 'relative' }}>
      <AnimatePresence mode="popLayout">
        {l && (
          <motion.div
            key={l.at}
            className="card"
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -18, scale: 0.97, filter: 'blur(8px)' }}
            transition={{ duration: 0.7, ease: EASE }}
            style={{ padding: '20px 22px 22px', borderRadius: 26 }}
          >
            <LineBody l={l} t={t} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Highlight: React.FC<{ p: number; children: React.ReactNode }> = ({ p, children }) => (
  <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>
    <span
      style={{
        position: 'absolute',
        inset: '1px -3px -1px',
        borderRadius: 4,
        background: '#fde68a',
        transformOrigin: 'left',
        transform: `scaleX(${p})`,
      }}
    />
    <span style={{ position: 'relative', fontWeight: p > 0.5 ? 600 : 400 }}>{children}</span>
  </span>
);

/** Compact Gmail lookup, driven by `u` = seconds since it started. */
export const GmailMini: React.FC<{ u: number; width?: number }> = ({ u, width = 320 }) => {
  const query = 'from:xfinity price lock';
  const qn = Math.floor(clamp01((u - 0.35) / 0.9) * query.length);
  const searching = u > 1.3 && u < 1.9;
  const res = clamp01((u - 1.9) / 0.5);
  const h1 = outExpo(clamp01((u - 2.6) / 0.4));
  const h2 = outExpo(clamp01((u - 2.95) / 0.35));
  return (
    <div style={{ width, background: '#fff', borderRadius: 22, padding: 16, color: '#1f1f1f', boxShadow: '0 30px 60px -20px rgba(0,0,0,.6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eaf1fb', borderRadius: 24, padding: '10px 14px', fontSize: 15 }}>
        <GmailLogo size={20} />
        <span style={{ color: qn ? '#1f1f1f' : '#5f6368' }}>{qn ? query.slice(0, qn) : 'Search mail'}</span>
        {searching && (
          <span
            style={{
              marginLeft: 'auto',
              width: 15,
              height: 15,
              borderRadius: 8,
              border: '2px solid #c2d5f5',
              borderTopColor: '#0b57d0',
              transform: `rotate(${u * 720}deg)`,
            }}
          />
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateRows: `${res}fr` }}>
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 12, padding: '14px 4px 2px', opacity: res, transform: `translateY(${(1 - res) * 10}px)` }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                background: '#6b2fb8',
                color: '#fff',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              X
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>Xfinity</b>
                <span style={{ color: '#5f6368', fontSize: 13 }}>Mar 3, 2025</span>
              </div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>Your price is locked in 🔒</div>
              <div style={{ color: '#444746', marginTop: 6 }}>
                Locked at <Highlight p={h1}>$65/mo through March 2027</Highlight>. Account <Highlight p={h2}>•••• 4821</Highlight>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const HoldCard: React.FC<{ t: number; width?: number }> = ({ t, width = 300 }) => (
  <div className="card" style={{ width, padding: '22px 24px 24px', borderRadius: 26 }}>
    <div style={{ fontSize: 15, fontWeight: 500, color: '#a1a1a6' }}>On hold with Xfinity</div>
    <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
      {fmtClock(callClock(t) ?? 0)}
    </div>
    <div style={{ fontSize: 16, color: '#a1a1a6', marginTop: 6 }}>
      Handle waits, <span style={{ color: LIME }}>so you don’t.</span>
    </div>
  </div>
);

export const SavingsCard: React.FC<{ u: number; width?: number }> = ({ u, width = 320 }) => {
  const c = outExpo(clamp01(u / 1.6));
  return (
    <div className="card" style={{ width, padding: '22px 24px', borderRadius: 26, display: 'flex', gap: 22 }}>
      <div>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>${Math.round(324 * c)}</div>
        <div style={{ fontSize: 15, color: '#a1a1a6', marginTop: 8 }}>saved this year</div>
      </div>
      <div style={{ width: 1, background: '#1f2021' }} />
      <div>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(32 * c)}<span style={{ fontSize: 26, marginLeft: 3 }}>min</span>
        </div>
        <div style={{ fontSize: 15, color: '#a1a1a6', marginTop: 8, whiteSpace: 'nowrap' }}>not spent on hold</div>
      </div>
    </div>
  );
};

/** The data card shown next to the phone for the current moment of the story. */
export function dataCardFor(t: number): { key: string; node: React.ReactNode } | null {
  if (t >= T.connected && t < T.holdEnd + 0.3) return { key: 'hold', node: <HoldCard t={t} /> };
  if (t >= T.gmailStart - 0.1 && t < T.gmailEnd + 1.2) return { key: 'gmail', node: <GmailMini u={t - T.gmailStart} /> };
  if (t >= T.out1 + 0.3) return { key: 'savings', node: <SavingsCard u={t - T.out1 - 0.3} /> };
  return null;
}

export const DataCard: React.FC<{ t: number }> = ({ t }) => {
  const d = dataCardFor(t);
  return (
    <AnimatePresence mode="popLayout">
      {d && (
        <motion.div
          key={d.key}
          initial={{ opacity: 0, y: 30, scale: 0.95, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -20, scale: 0.97, filter: 'blur(10px)' }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          {d.node}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const progAt = prog;
