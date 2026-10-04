import React from 'react';
import { Battery, Signal, Wifi } from './Icons';

export const SCREEN_W = 402;
export const SCREEN_H = 874;
const BEZEL = 11;
const FRAME = 4.5;
export const PHONE_W = SCREEN_W + 2 * (BEZEL + FRAME);
export const PHONE_H = SCREEN_H + 2 * (BEZEL + FRAME);
const R_OUT = 70;

export const SYS = `-apple-system, system-ui, "SF Pro Text", "Helvetica Neue", sans-serif`;

// Natural titanium: soft, low-contrast metal with thin specular edges.
const titanium =
  'linear-gradient(140deg,#7d7a74 0%,#a9a59e 9%,#8a8780 20%,#6a6862 42%,#5e5c57 58%,#77746e 78%,#a29e97 92%,#74716b 100%)';

const SideButton: React.FC<{ side: 'l' | 'r'; top: number; h: number }> = ({ side, top, h }) => (
  <div
    style={{
      position: 'absolute',
      top,
      [side === 'l' ? 'left' : 'right']: -2.6,
      width: 4,
      height: h,
      borderRadius: side === 'l' ? '2px 0 0 2px' : '0 2px 2px 0',
      background:
        side === 'l'
          ? 'linear-gradient(90deg,#4f4d49,#8f8b84 55%,#6f6c66)'
          : 'linear-gradient(270deg,#4f4d49,#8f8b84 55%,#6f6c66)',
    }}
  />
);

export const Phone: React.FC<{ children: React.ReactNode; glare?: number }> = ({ children, glare = 0 }) => (
  <div style={{ position: 'relative', width: PHONE_W, height: PHONE_H }}>
    <SideButton side="l" top={168} h={30} />
    <SideButton side="l" top={228} h={58} />
    <SideButton side="l" top={300} h={58} />
    <SideButton side="r" top={262} h={92} />
    <SideButton side="r" top={560} h={64} />
    {/* titanium band */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: R_OUT,
        background: titanium,
        boxShadow:
          '0 70px 120px -30px rgba(0,0,0,.7), 0 30px 60px -30px rgba(0,0,0,.55), inset 0 0 0 0.75px rgba(255,255,255,.22), inset 0 0 0 1.75px rgba(0,0,0,.35)',
      }}
    />
    {/* black glass bezel */}
    <div
      style={{
        position: 'absolute',
        inset: FRAME,
        borderRadius: R_OUT - FRAME,
        background: '#050505',
        boxShadow: '0 0 0 0.75px rgba(0,0,0,.9)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: BEZEL,
          top: BEZEL,
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: R_OUT - FRAME - BEZEL,
          // clip-path (not just border-radius) so backdrop-filter layers can't leak past the rounded corners
          clipPath: `inset(0 round ${R_OUT - FRAME - BEZEL}px)`,
          overflow: 'hidden',
          background: '#fff',
          fontFamily: SYS,
          WebkitFontSmoothing: 'antialiased',
          isolation: 'isolate',
        }}
      >
        {children}
        {/* Dynamic Island */}
        <div
          style={{
            position: 'absolute',
            top: 11,
            left: (SCREEN_W - 124) / 2,
            width: 124,
            height: 36.5,
            borderRadius: 20,
            background: '#000',
            zIndex: 100,
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: 22,
              top: 11.5,
              width: 13,
              height: 13,
              borderRadius: 7,
              background: 'radial-gradient(circle at 40% 35%,#2a3550 0%,#0b0e18 55%,#050505 100%)',
            }}
          />
        </div>
        {/* glass glare (screen only) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(115deg, rgba(255,255,255,0) 35%, rgba(255,255,255,${0.05 * glare}) 47%, rgba(255,255,255,0) 58%)`,
            pointerEvents: 'none',
            zIndex: 200,
          }}
        />
      </div>
    </div>
  </div>
);

export const StatusBar: React.FC<{ dark?: boolean; callPill?: number }> = ({ dark, callPill = 0 }) => {
  const c = dark ? '#fff' : '#000';
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 54,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 34px 0 50px',
        boxSizing: 'border-box',
        color: c,
      }}
    >
      <div style={{ position: 'relative', width: 54, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            position: 'absolute',
            inset: '-3px -9px',
            borderRadius: 14,
            background: '#34C759',
            opacity: callPill,
          }}
        />
        <span
          style={{
            position: 'relative',
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: -0.3,
            color: callPill > 0.5 ? '#fff' : c,
          }}
        >
          9:41
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6.5 }}>
        <Signal color={c} />
        <Wifi color={c} />
        <Battery color={c} level={0.82} />
      </div>
    </div>
  );
};

export const HomeIndicator: React.FC<{ dark?: boolean }> = ({ dark }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 8,
      left: (SCREEN_W - 140) / 2,
      width: 140,
      height: 5,
      borderRadius: 3,
      background: dark ? '#fff' : '#000',
      zIndex: 60,
    }}
  />
);
