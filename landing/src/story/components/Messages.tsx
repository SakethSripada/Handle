import React from 'react';
import { COPY, T, Typing, kbStateAt, pressedAt } from '../timeline';
import { clamp01, lerp, prog, springAt } from '../anim';
import { HomeIndicator, SCREEN_H, SCREEN_W, StatusBar } from './Phone';
import { Keyboard, KB_H } from './Keyboard';
import { ArrowUp, ChevronLeft, ChevronRight, MicOutline, Plus, VideoOutline } from './Icons';
import { HandleAvatar } from './Brand';

const BLUE_TOP = '#2f95ff';
const BLUE_BOT = '#0a7cff';
const GREY = '#E9E9EB';

type Item =
  | { kind: 'ts'; at: number; strong: string; rest: string }
  | { kind: 'msg'; at: number; me: boolean; text: string }
  | { kind: 'typing'; at: number; until: number };

const ITEMS: Item[] = [
  { kind: 'ts', at: -99, strong: 'Yesterday', rest: ' 6:12 PM' },
  { kind: 'msg', at: -99, me: false, text: 'Done! United refunded your $48 seat fee ✈️' },
  { kind: 'msg', at: -99, me: true, text: 'You’re a lifesaver 🙌' },
  { kind: 'ts', at: T.send1, strong: 'Today', rest: ' 9:41 AM' },
  { kind: 'msg', at: T.send1, me: true, text: COPY.msg1 },
  { kind: 'typing', at: T.typingInd1, until: T.reply1 },
  { kind: 'msg', at: T.reply1, me: false, text: COPY.reply1 },
  { kind: 'msg', at: T.approval, me: false, text: COPY.question },
  { kind: 'msg', at: T.send2, me: true, text: COPY.msg2 },
  { kind: 'typing', at: T.typingInd2, until: T.out1 },
  { kind: 'msg', at: T.out1, me: false, text: COPY.out1 },
  { kind: 'typing', at: T.out1 + 0.45, until: T.out2 },
  { kind: 'msg', at: T.out2, me: false, text: COPY.out2 },
];

const Tail: React.FC<{ me: boolean }> = ({ me }) => (
  <>
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        [me ? 'right' : 'left']: -7,
        width: 20,
        height: 21,
        background: me ? BLUE_BOT : GREY,
        [me ? 'borderBottomLeftRadius' : 'borderBottomRightRadius']: '16px 14px',
        zIndex: 0,
      }}
    />
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        [me ? 'right' : 'left']: -10,
        width: 10,
        height: 21,
        background: '#fff',
        [me ? 'borderBottomLeftRadius' : 'borderBottomRightRadius']: 10,
        zIndex: 1,
      }}
    />
  </>
);

const Bubble: React.FC<{ me: boolean; text: string; tail: boolean }> = ({ me, text, tail }) => {
  const emojiOnly = false;
  return (
    <div
      style={{
        position: 'relative',
        maxWidth: 282,
        padding: '7px 13px 7.5px',
        borderRadius: 19,
        background: me ? `linear-gradient(180deg, ${BLUE_TOP}, ${BLUE_BOT})` : GREY,
        backgroundAttachment: 'fixed',
        color: me ? '#fff' : '#000',
        fontSize: emojiOnly ? 40 : 17,
        lineHeight: '22px',
        letterSpacing: -0.25,
        overflowWrap: 'break-word',
      }}
    >
      {tail && <Tail me={me} />}
      <span style={{ position: 'relative', zIndex: 2 }}>{text}</span>
    </div>
  );
};

const TypingBubble: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ position: 'relative', width: 66, height: 38 }}>
    <div style={{ position: 'absolute', left: -3, bottom: -1, width: 13, height: 13, borderRadius: 7, background: GREY }} />
    <div style={{ position: 'absolute', left: -9, bottom: -7, width: 6.5, height: 6.5, borderRadius: 4, background: GREY }} />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 19,
        background: GREY,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
      }}
    >
      {[0, 1, 2].map((i) => {
        const ph = (t * 2.4 - i * 0.18) % 1;
        const a = Math.max(0, Math.sin(ph * Math.PI * 2));
        return <div key={i} style={{ width: 9, height: 9, borderRadius: 5, background: '#8E8E93', opacity: 0.35 + 0.55 * a }} />;
      })}
    </div>
  </div>
);

/** Collapsible row whose height animates without measuring (grid fr trick). */
const Grow: React.FC<{ h: number; children: React.ReactNode }> = ({ h, children }) => (
  <div style={{ display: 'grid', gridTemplateRows: `${clamp01(h)}fr` }}>
    <div style={{ minHeight: 0, overflow: h < 0.999 ? 'hidden' : 'visible' }}>{children}</div>
  </div>
);

function suggestionsFor(ty: Typing, draft: string): [string, string, string] {
  const words = ty.text.split(' ');
  const typed = draft.split(' ');
  const idx = typed.length - 1;
  const partial = typed[idx] ?? '';
  const clean = (w: string) => (w ?? '').replace(/[.,?!]/g, '');
  const target = clean(words[idx]);
  if (!partial) {
    if (idx === 0) return ['I', 'The', 'My'];
    const next = clean(words[idx]);
    return ['the', next || 'I', 'and'];
  }
  if (/[$0-9]/.test(partial)) return ['', '', ''];
  const alt = target.length > 3 ? target.slice(0, -1) + (target.endsWith('s') ? '' : 's') : 'the';
  return [`“${partial}”`, target, alt === target ? 'the' : alt];
}

export const MessagesScreen: React.FC<{ t: number }> = ({ t }) => {
  // which typing session is relevant
  const ty = t < T.callStart ? T.typing1 : T.typing2;
  const kbs = kbStateAt(ty, t);
  const sendAt = ty === T.typing1 ? T.send1 : T.send2;
  const draft = t >= sendAt ? '' : kbs.draft;
  const pressed = t < sendAt ? pressedAt(ty, t) : null;

  // keyboard visibility
  const kbIn = t < T.callStart ? T.kbUp1 : T.kbUp2;
  const kbOutAt = t < T.callStart ? 999 : T.back2Call;
  const kbP =
    t >= T.outScreen - 0.2 ? 0 : clamp01(springAt(t, kbIn, { damping: 26, stiffness: 210 })) * (t > kbOutAt ? 0 : 1);
  const kbOffset = lerp(0, KB_H, kbP);
  const bottomInset = Math.max(34, kbOffset);

  const callActive = t > T.ringStart && t < T.callEnd;
  const typingNow = t > ty.start - 0.25 && t < ty.end + 0.15;
  const caretOn = kbP > 0.5 && (typingNow || Math.floor(t * 1.9) % 2 === 0);

  // send button
  const sendPress = prog(t, sendAt - 0.12, sendAt - 0.02) * (1 - prog(t, sendAt, sendAt + 0.12));

  // visible items
  const visible = ITEMS.filter((it) => it.at <= t && !(it.kind === 'typing' && t > it.until + 0.2));
  const msgs = visible.filter((i) => i.kind !== 'typing');
  const lastMsg = msgs[msgs.length - 1];
  const typingVisible = visible.some((i) => i.kind === 'typing' && t < i.until);

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', overflow: 'hidden' }}>
      <StatusBar callPill={callActive ? 1 : 0} />

      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: bottomInset, display: 'flex', flexDirection: 'column' }}>
      {/* conversation */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          paddingBottom: 8,
          overflow: 'hidden',
        }}
      >
        {visible.map((it, i) => {
          const p = it.at < 0 ? 1 : springAt(t, it.at, { damping: 19, stiffness: 190 });
          const next = visible.slice(i + 1).find((x) => x.kind !== 'typing' || t < x.until);
          if (it.kind === 'ts') {
            return (
              <Grow key={i} h={p}>
                <div style={{ textAlign: 'center', fontSize: 12, color: '#8E8E93', padding: '14px 0 8px', opacity: clamp01(p) }}>
                  <b style={{ fontWeight: 600 }}>{it.strong}</b>
                  {it.rest}
                </div>
              </Grow>
            );
          }
          if (it.kind === 'typing') {
            const out = prog(t, it.until - 0.05, it.until + 0.15);
            const h = clamp01(p) * (1 - out);
            return (
              <Grow key={i} h={h}>
                <div style={{ padding: '10px 0 2px 22px' }}>
                  <div style={{ transform: `scale(${(0.5 + 0.5 * p) * (1 - out * 0.4)})`, transformOrigin: 'bottom left', opacity: 1 - out }}>
                    <TypingBubble t={t} />
                  </div>
                </div>
              </Grow>
            );
          }
          const sameNext = next && next.kind === 'msg' && next.me === it.me;
          const prev = visible[i - 1];
          const samePrev = prev && prev.kind === 'msg' && prev.me === it.me;
          const showDelivered = it === lastMsg && it.me && !typingVisible;
          const delP = prog(t, it.at + 0.55, it.at + 0.85);
          const fly = it.me ? clamp01(p) : p;
          return (
            <Grow key={i} h={p}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: it.me ? 'flex-end' : 'flex-start',
                  padding: it.me ? '0 18px 0 60px' : '0 60px 0 18px',
                  marginTop: samePrev ? 2 : 10,
                }}
              >
                <div
                  style={{
                    transform: it.me
                      ? `translateY(${(1 - fly) * 46}px) scale(${0.9 + 0.1 * fly})`
                      : `scale(${0.55 + 0.45 * p})`,
                    transformOrigin: it.me ? 'bottom right' : 'bottom left',
                    opacity: it.me ? 1 : clamp01(p * 2),
                  }}
                >
                  <Bubble me={it.me} text={it.text} tail={!sameNext} />
                </div>
                {showDelivered && it.at > 0 && (
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#8E8E93', marginTop: 4, marginRight: 4, opacity: delP }}>
                    Delivered
                  </div>
                )}
              </div>
            </Grow>
          );
        })}
      </div>

      {/* input bar */}
      <div
        style={{
          flex: 'none',
          padding: '7px 12px 8px 10px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 9,
          background: '#fff',
          zIndex: 15,
        }}
      >
        <div
          style={{
            width: 35,
            height: 35,
            borderRadius: 18,
            background: '#EDEDEF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Plus size={16} color="#7C7C82" />
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 35,
            borderRadius: 18,
            border: '1px solid #D1D1D6',
            padding: '6px 40px 6px 13px',
            boxSizing: 'border-box',
            position: 'relative',
            fontSize: 17,
            lineHeight: '22px',
            letterSpacing: -0.25,
            color: '#000',
          }}
        >
          {draft ? (
            <span>
              {draft}
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 21,
                  marginBottom: -4,
                  marginLeft: 1,
                  background: '#007AFF',
                  borderRadius: 1,
                  opacity: caretOn ? 1 : 0,
                }}
              />
            </span>
          ) : (
            <span style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: -1,
                  top: 1,
                  width: 2,
                  height: 21,
                  background: '#007AFF',
                  borderRadius: 1,
                  opacity: caretOn ? 1 : 0,
                }}
              />
              <span style={{ color: '#B4B4B9' }}>iMessage</span>
            </span>
          )}
          <div style={{ position: 'absolute', right: 3, bottom: 2.5 }}>
            {draft ? (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: sendPress > 0 ? '#0062d1' : '#0A84FF',
                  transform: `scale(${1 - 0.12 * sendPress})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowUp size={15} />
              </div>
            ) : (
              <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MicOutline size={19} color="#9A9AA0" />
              </div>
            )}
          </div>
        </div>
      </div>

      </div>
      {/* header */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 134,
          background: 'rgba(247,247,248,0.86)',
          backdropFilter: 'blur(24px) saturate(1.8)',
          borderBottom: '0.5px solid rgba(0,0,0,0.16)',
          zIndex: 20,
        }}
      >
        <div style={{ position: 'absolute', left: 14, top: 70 }}>
          <ChevronLeft size={22} />
        </div>
        <div style={{ position: 'absolute', right: 18, top: 72 }}>
          <VideoOutline />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 56, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <HandleAvatar size={52} />
          <div style={{ marginTop: 5, fontSize: 11.5, color: '#000', display: 'flex', alignItems: 'center', gap: 3, letterSpacing: -0.1 }}>
            Handle <ChevronRight size={8} />
          </div>
        </div>
      </div>

      {/* keyboard */}
      <div style={{ position: 'absolute', left: 0, top: SCREEN_H - kbOffset, width: SCREEN_W, zIndex: 16 }}>
        <Keyboard
          mode={t >= sendAt ? 'abc' : kbs.mode}
          shift={t >= sendAt ? true : kbs.shift}
          pressed={pressed}
          suggestions={t >= sendAt ? ['I', 'The', 'I’m'] : suggestionsFor(ty, kbs.draft)}
        />
      </div>
      <HomeIndicator />
    </div>
  );
};
