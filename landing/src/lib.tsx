import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { T } from './story/timeline';
import { outExpo, prog, smooth } from './story/anim';
import { Phone, PHONE_H, PHONE_W } from './story/components/Phone';
import { MessagesScreen } from './story/components/Messages';
import { CallScreen } from './story/components/CallScreen';

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Real-time looping clock (seconds) between [from, to]. Pauses when `active` is false. */
export function useLoopClock(from: number, to: number, active = true, speed = 1) {
  const [t, setT] = useState(from);
  const state = useRef({ t: from, last: 0 });
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    state.current.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - state.current.last) / 1000);
      state.current.last = now;
      let next = state.current.t + dt * speed;
      if (next > to) next = from;
      state.current.t = next;
      setT(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, active, speed]);
  return t;
}

/** Seconds since the element first scrolled into view (keeps running while visible). */
export function useInViewTime<T extends Element>(amount = 0.35) {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { amount });
  const [t, setT] = useState(0);
  const acc = useRef(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      acc.current += Math.min(0.05, (now - last) / 1000);
      last = now;
      setT(acc.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView]);
  return [ref, t, inView] as const;
}

export function useViewport() {
  const [vp, setVp] = useState({ w: typeof window === 'undefined' ? 1440 : window.innerWidth, h: typeof window === 'undefined' ? 900 : window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return vp;
}

const lerpN = (a: number, b: number, p: number) => a + (b - a) * p;
const islandClip = (p: number) =>
  `inset(${lerpN(11, 0, p)}px ${lerpN(139, 0, p)}px ${lerpN(874 - 47.5, 0, p)}px ${lerpN(139, 0, p)}px round ${lerpN(19, 55, p)}px)`;
const bannerClip = (p: number) =>
  `inset(${lerpN(56, 0, p)}px ${lerpN(9, 0, p)}px ${lerpN(874 - 56 - 168, 0, p)}px ${lerpN(9, 0, p)}px round ${lerpN(24, 55, p)}px)`;

/** The real iPhone (same components as the film), showing the story at time `t`. */
export const PhoneStage: React.FC<{ t: number; scale: number }> = ({ t, scale }) => {
  let callP = 0;
  let callOnTop = true;
  let msgClip: string | undefined;
  let msgScale = 1;
  if (t >= T.callStart && t < T.bannerTap + 0.6) {
    callP = prog(t, T.callStart, T.callStart + 0.7, outExpo);
    if (t >= T.bannerTap) {
      callOnTop = false;
      const pb = prog(t, T.bannerTap + 0.02, T.bannerTap + 0.58, outExpo);
      msgClip = bannerClip(pb);
      msgScale = lerpN(0.96, 1, pb);
    }
  } else if (t >= T.back2Call && t < T.outScreen + 0.1) {
    callP = Math.min(prog(t, T.back2Call, T.back2Call + 0.7, outExpo), 1 - prog(t, T.outScreen - 0.55, T.outScreen + 0.05, smooth));
  }
  const showCall = callP > 0.001;
  return (
    <div style={{ width: PHONE_W * scale, height: PHONE_H * scale, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        <Phone glare={0.8}>
          {showCall && !callOnTop && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              <CallScreen t={t} />
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              clipPath: msgClip,
              transform: `scale(${msgScale})`,
              transformOrigin: '50% 15%',
              zIndex: 1,
              display: showCall && callOnTop && callP > 0.999 ? 'none' : 'block',
            }}
          >
            <MessagesScreen t={t} />
          </div>
          {showCall && callOnTop && (
            <div style={{ position: 'absolute', inset: 0, clipPath: islandClip(callP), zIndex: 90 }}>
              <div style={{ position: 'absolute', inset: 0, transform: `scale(${lerpN(0.9, 1, callP)})`, transformOrigin: '50% 0%' }}>
                <CallScreen t={t} />
              </div>
            </div>
          )}
        </Phone>
      </div>
    </div>
  );
};

/** Words rise out of a soft blur, staggered, when scrolled into view. */
export const BlurWords: React.FC<{
  text: string;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  stagger?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  immediate?: boolean;
}> = ({ text, className, style, delay = 0, stagger = 0.06, as = 'span', immediate }) => {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const show = immediate || inView;
  const Tag = motion[as] as typeof motion.span;
  return (
    <Tag ref={ref as React.Ref<HTMLSpanElement>} style={style}>
      {text.split(' ').map((w, i) => (
        <motion.span
          key={i}
          className={className}
          style={{ display: 'inline-block', whiteSpace: 'pre', paddingBottom: '0.08em', marginBottom: '-0.08em' }}
          initial={{ opacity: 0, y: '0.35em', filter: 'blur(14px)' }}
          animate={show ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
          transition={{ duration: 1.1, ease: EASE, delay: delay + i * stagger }}
        >
          {w}
          {i < text.split(' ').length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </Tag>
  );
};

/** Fades + lifts children when they scroll into view. */
export const Reveal: React.FC<{ children: React.ReactNode; delay?: number; y?: number; className?: string; style?: React.CSSProperties }> = ({
  children,
  delay = 0,
  y = 28,
  className,
  style,
}) => (
  <motion.div
    className={className}
    style={style}
    initial={{ opacity: 0, y, filter: 'blur(10px)' }}
    whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 1.1, ease: EASE, delay }}
  >
    {children}
  </motion.div>
);

export const Chevron: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg width={size * 0.6} height={size} viewBox="0 0 7 12" fill="none">
    <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
