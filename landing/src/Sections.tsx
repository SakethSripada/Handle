import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, useInView, useScroll, useTransform } from 'motion/react';
import { HandleMark, LIME } from './story/components/Brand';
import { BlurWords, EASE, Reveal, useViewport } from './lib';
import { Wordmark } from './Hero';

/* ---------------- Gallery (vertical scroll drives a horizontal rail) ---------------- */
const SHOTS = [
  { src: '/gallery/02-one-text-thats-it.jpg', cap: 'One text starts it.' },
  { src: '/gallery/03-just-text-handle.jpg', cap: 'Say it like you would to a friend.' },
  { src: '/gallery/04-live-call-transcript.jpg', cap: 'Handle talks to the agent.' },
  { src: '/gallery/05-handle-waits-on-hold.jpg', cap: 'It waits on hold for you.' },
  { src: '/gallery/06-gmail-context-mid-call.jpg', cap: 'Details pulled from Gmail.' },
  { src: '/gallery/07-asks-before-it-costs-you.jpg', cap: 'It asks before it commits.' },
  { src: '/gallery/08-resolved-money-and-time-saved.jpg', cap: 'Fixed, with the savings.' },
  { src: '/gallery/01-handle-brand.jpg', cap: 'Just Handle it.' },
];

export const Gallery: React.FC = () => {
  const outer = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const vp = useViewport();
  const [dist, setDist] = useState(0);
  useLayoutEffect(() => {
    if (track.current) setDist(Math.max(0, track.current.scrollWidth - window.innerWidth));
  }, [vp.w, vp.h]);
  const { scrollYProgress } = useScroll({ target: outer, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -dist]);
  const imgW = Math.min(vp.w * 0.8, vp.h * 0.6 * 1.5, 1100);
  return (
    <section id="gallery" className="section">
      <div className="wrap" style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 className="display h2">
          <BlurWords text="Every frame," />
          <br />
          <BlurWords text="start to fixed." className="grad-silver" delay={0.15} />
        </h2>
      </div>
      <div ref={outer} style={{ height: `${Math.max(180, (dist / vp.h) * 70 + 100)}vh`, position: 'relative' }}>
        <div style={{ position: 'sticky', top: 'var(--nav)', height: 'calc(100vh - var(--nav))', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <motion.div ref={track} style={{ x, display: 'flex', gap: 28, paddingInline: 'max(var(--gutter), calc((100vw - var(--maxw)) / 2))' }}>
            {SHOTS.map((s, i) => (
              <figure key={s.src} style={{ margin: 0, flexShrink: 0, width: imgW }}>
                <div className="shot" style={{ borderRadius: 28, overflow: 'hidden', border: '1px solid #232425', background: '#050505' }}>
                  <img src={`${import.meta.env.BASE_URL}${s.src.slice(1)}`} alt={s.cap} loading={i < 2 ? 'eager' : 'lazy'} style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover' }} />
                </div>
                <figcaption style={{ marginTop: 18, fontSize: 17, color: '#86868b', letterSpacing: '-0.01em' }}>{s.cap}</figcaption>
              </figure>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

/* ---------------- Finale ---------------- */
export const Finale: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  return (
    <section className="section" style={{ position: 'relative', paddingBottom: 'clamp(100px, 14vh, 160px)', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(50% 55% at 50% 60%, rgba(52,92,68,0.45) 0%, rgba(24,61,46,0.2) 40%, transparent 72%)',
        }}
      />
      <div ref={ref} className="wrap" style={{ position: 'relative', textAlign: 'center' }}>
        <h2 className="display" style={{ fontSize: 'clamp(56px, min(9vw, 17vh), 150px)', letterSpacing: '-0.045em' }}>
          <BlurWords text="Just" />{' '}
          <span style={{ position: 'relative', display: 'inline-block' }}>
            <motion.span
              className="grad-lime"
              style={{ display: 'inline-block', fontFamily: 'var(--brand)', fontWeight: 800, letterSpacing: '-0.055em', paddingBottom: '0.1em', marginBottom: '-0.1em' }}
              initial={{ opacity: 0, scale: 0.7, filter: 'blur(16px)' }}
              animate={inView ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : undefined}
              transition={{ type: 'spring', stiffness: 120, damping: 15, delay: 0.25 }}
            >
              Handle
            </motion.span>
            <svg viewBox="0 0 500 40" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, bottom: '-0.2em', width: '100%', height: '0.2em', overflow: 'visible' }}>
              <motion.path
                d="M12 26 C 140 10, 330 8, 488 20"
                fill="none"
                stroke={LIME}
                strokeWidth={9}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : undefined}
                transition={{ duration: 0.9, ease: EASE, delay: 0.75 }}
                style={{ filter: 'drop-shadow(0 0 14px rgba(215,239,165,0.55))' }}
              />
            </svg>
          </span>{' '}
          <BlurWords text="it." delay={0.45} />
        </h2>
        <Reveal delay={0.9}>
          <p className="lede" style={{ marginTop: 40 }}>Text Handle the next time a company wastes your afternoon.</p>
        </Reveal>
      </div>
    </section>
  );
};

export const Footer: React.FC = () => (
  <footer style={{ borderTop: '1px solid #161617', padding: '36px 0 48px' }}>
    <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <HandleMark size={24} />
        <Wordmark size={20} />
      </div>
      <span style={{ fontSize: 13, color: '#6e6e73' }}>Your time, back in your hands.</span>
    </div>
  </footer>
);
