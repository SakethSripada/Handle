import React from 'react';
import { DeleteIcon, MicOutline, ShiftIcon, Smiley } from './Icons';
import type { KbMode, Tap } from '../timeline';

export const KB_H = 336;
const PRED = 45;
const R0 = PRED + 7;
const PITCH_Y = 54;
const KH = 42.5;
const KW = 34.2;
const PX = 40.2;
const BG = '#D1D4D9';
const SPECIAL = '#ABB1BA';

type Key = { id: string; label: string; x: number; y: number; w: number; kind: 'char' | 'special' };

function layout(mode: KbMode, shift: boolean): Key[] {
  const keys: Key[] = [];
  const row = (chars: string, x0: number, r: number, pitch = PX, w = KW) =>
    [...chars].forEach((c, i) =>
      keys.push({ id: c, label: mode === 'abc' && shift ? c.toUpperCase() : c, x: x0 + i * pitch, y: R0 + r * PITCH_Y, w, kind: 'char' }),
    );
  if (mode === 'abc') {
    row('qwertyuiop', 3, 0);
    row('asdfghjkl', 3 + PX / 2, 1);
    row('zxcvbnm', 3 + 1.5 * PX, 2);
    keys.push({ id: 'shift', label: '', x: 3, y: R0 + 2 * PITCH_Y, w: 45, kind: 'special' });
  } else {
    row('1234567890', 3, 0);
    row('-/:;()$&@"', 3, 1);
    row(".,?!'", 3 + 1.5 * PX, 2, 56.3, 50.3);
    keys.push({ id: 'sym', label: '#+=', x: 3, y: R0 + 2 * PITCH_Y, w: 45, kind: 'special' });
  }
  keys.push({ id: 'delete', label: '', x: 402 - 3 - 45, y: R0 + 2 * PITCH_Y, w: 45, kind: 'special' });
  keys.push({ id: 'mode', label: mode === 'abc' ? '123' : 'ABC', x: 3, y: R0 + 3 * PITCH_Y, w: 88, kind: 'special' });
  keys.push({ id: 'space', label: 'space', x: 97, y: R0 + 3 * PITCH_Y, w: 208, kind: 'char' });
  keys.push({ id: 'return', label: 'return', x: 402 - 3 - 88, y: R0 + 3 * PITCH_Y, w: 88, kind: 'special' });
  return keys;
}

const Popup: React.FC<{ k: Key; ch: string }> = ({ k, ch }) => {
  const exL = Math.min(12, k.x - 1);
  const exR = Math.min(12, 402 - (k.x + k.w) - 1);
  const w = k.w;
  const top = -58;
  const r = 7;
  const L = -exL;
  const R = w + exR;
  const d = `M ${r} ${KH} L ${w - r} ${KH} Q ${w} ${KH} ${w} ${KH - r} L ${w} 6 C ${w} -4, ${R} -8, ${R} -20 L ${R} ${top + 10} Q ${R} ${top} ${R - 10} ${top} L ${L + 10} ${top} Q ${L} ${top} ${L} ${top + 10} L ${L} -20 C ${L} -8, 0 -4, 0 6 L 0 ${KH - r} Q 0 ${KH} ${r} ${KH} Z`;
  return (
    <div style={{ position: 'absolute', left: k.x, top: k.y, width: w, height: KH, zIndex: 10 }}>
      <svg
        width={w + exL + exR + 20}
        height={KH - top + 20}
        viewBox={`${L - 10} ${top - 10} ${w + exL + exR + 20} ${KH - top + 20}`}
        style={{ position: 'absolute', left: L - 10, top: top - 10, overflow: 'visible' }}
      >
        <defs>
          <filter id="pshadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.6" floodColor="#000" floodOpacity="0.32" />
          </filter>
        </defs>
        <path d={d} fill="#fff" filter="url(#pshadow)" />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: L,
          width: R - L,
          top: top + 2,
          height: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 35,
          fontWeight: 300,
          color: '#000',
        }}
      >
        {ch}
      </div>
    </div>
  );
};

export const Keyboard: React.FC<{
  mode: KbMode;
  shift: boolean;
  pressed: Tap | null;
  suggestions: [string, string, string];
}> = ({ mode, shift, pressed, suggestions }) => {
  const keys = layout(mode, shift);
  const pk = pressed ? keys.find((k) => k.id === pressed.key) : undefined;
  const popupKey = pk && pk.kind === 'char' && pk.id !== 'space' ? pk : undefined;
  return (
    <div style={{ position: 'relative', width: 402, height: KB_H, background: BG, overflow: 'visible' }}>
      {/* QuickType */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: PRED, display: 'flex', alignItems: 'center' }}>
        {suggestions.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div style={{ width: 1, height: 25, background: '#B6BAC1' }} />}
            <div
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 16.5,
                color: '#000',
                letterSpacing: -0.2,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                padding: '0 6px',
              }}
            >
              {s}
            </div>
          </React.Fragment>
        ))}
      </div>
      {keys.map((k) => {
        const isPressed = pk?.id === k.id;
        const isShiftOn = k.id === 'shift' && shift;
        let bg = k.kind === 'special' ? SPECIAL : '#fff';
        if (isShiftOn) bg = '#fff';
        if (isPressed && k.kind === 'special') bg = '#fff';
        if (isPressed && k.id === 'space') bg = SPECIAL;
        const hidden = popupKey?.id === k.id;
        return (
          <div
            key={k.id}
            style={{
              position: 'absolute',
              left: k.x,
              top: k.y,
              width: k.w,
              height: KH,
              borderRadius: 5.5,
              background: bg,
              boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              fontSize: k.label.length > 1 ? 16 : 23,
              fontWeight: k.label.length > 1 ? 400 : 400,
              letterSpacing: k.label.length > 1 ? -0.2 : 0,
              opacity: hidden ? 0 : 1,
            }}
          >
            {k.id === 'shift' ? (
              <ShiftIcon filled={shift} />
            ) : k.id === 'delete' ? (
              <DeleteIcon />
            ) : (
              <span style={{ marginTop: k.label.length > 1 ? 0 : -2 }}>{k.label}</span>
            )}
          </div>
        );
      })}
      {popupKey && pressed && <Popup k={popupKey} ch={pressed.display ?? popupKey.label} />}
      {/* emoji + dictation row */}
      <div style={{ position: 'absolute', left: 22, top: R0 + 4 * PITCH_Y + 2 }}>
        <Smiley />
      </div>
      <div style={{ position: 'absolute', right: 26, top: R0 + 4 * PITCH_Y + 1 }}>
        <MicOutline color="#50555C" size={27} />
      </div>
    </div>
  );
};
