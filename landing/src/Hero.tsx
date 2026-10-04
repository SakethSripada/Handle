import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import { T } from './story/timeline';
import { prog } from './story/anim';
import { HandleMark, BRAND_FONT, LIME } from './story/components/Brand';
import { MessagesAppIcon } from './story/components/Icons';
import { PHONE_H } from './story/components/Phone';
import { BlurWords, Chevron, EASE, PhoneStage, useLoopClock, useViewport } from './lib';
import { DataCard, TranscriptCard } from './context';

export const Wordmark: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <span style={{ fontFamily: BRAND_FONT, fontWeight: 800, fontSize: size, letterSpacing: '-0.055em', color: '#f5f7e9', lineHeight: 1 }}>
    handle
  </span>
);

export const Nav: React.FC = () => {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: EASE, delay: 0.2 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 'var(--nav)',
        background: solid ? '#000' : 'rgba(0,0,0,0)',
        boxShadow: solid ? '0 1px 0 #161617' : 'none',
        transition: 'background .4s, box-shadow .4s',
      }}
    >
      <div style={{ width: 'min(1560px, calc(100% - 2 * var(--gutter)))', margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HandleMark size={28} />
          <Wordmark size={23} />
        </a>
        <nav className="nav-links" style={{ display: 'flex', gap: 36, fontSize: 14, color: '#a1a1a6', fontWeight: 500 }}>
          <a href="#how" className="nav-a">How it works</a>
          <a href="#features" className="nav-a">Features</a>
          <a href="#gallery" className="nav-a">Gallery</a>
        </nav>
      </div>
    </motion.header>
  );
};

const LOOP_FROM = T.kbUp1 - 1.1;
const LOOP_TO = T.out2 + 4.8;
const CARD_W = 300;

export const Hero: React.FC = () => {
  const vp = useViewport();
  const wide = vp.w >= 1080;
  const navH = 64;
  const pad = Math.min(64, Math.max(28, vp.h * 0.05));
  const scale = wide
    ? Math.max(0.6, Math.min(1.12, ((vp.h - navH - pad) / PHONE_H) * 1.1))
    : Math.max(0.5, Math.min(0.68, (vp.h * 0.72) / PHONE_H));
  const phoneW = 433 * scale;
  const showCards = false;
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    if (sectionRef.current) io.observe(sectionRef.current);
    return () => io.disconnect();
  }, []);
  const t = useLoopClock(LOOP_FROM, LOOP_TO, visible);
  const loopFade = Math.min(prog(t, LOOP_FROM, LOOP_FROM + 0.7), 1 - prog(t, LOOP_TO - 0.7, LOOP_TO));

  // pointer-driven tilt + glow
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-1, 1], [4, -4]), { stiffness: 60, damping: 18 });
  const ry = useSpring(useTransform(mx, [-1, 1], [-6, 6]), { stiffness: 60, damping: 18 });
  const gx = useSpring(useTransform(mx, [-1, 1], [55, 80]), { stiffness: 40, damping: 20 });
  const gy = useSpring(useTransform(my, [-1, 1], [35, 65]), { stiffness: 40, damping: 20 });
  const glow = useTransform(
    [gx, gy],
    ([x, y]) => `radial-gradient(48% 70% at ${x}% ${y}%, rgba(60,110,78,0.40) 0%, rgba(24,61,46,0.20) 40%, rgba(0,0,0,0) 74%)`,
  );

  // scroll-away
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const h1Size = wide ? 'min(10.9cqi, 15vh, 160px)' : 'clamp(44px, 12vw, 76px)';

  return (
    <section
      id="top"
      ref={sectionRef}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
        my.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      style={{
        position: 'relative',
        height: wide ? '100vh' : 'auto',
        minHeight: wide ? 640 : undefined,
        overflow: 'hidden',
      }}
    >
      <motion.div style={{ position: 'absolute', inset: 0, background: glow }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(36% 40% at 88% 8%, rgba(41,151,255,0.09), transparent 70%), radial-gradient(60% 40% at 30% 110%, rgba(215,239,165,0.05), transparent 70%)',
        }}
      />
      <div
        style={{
          width: 'min(1560px, calc(100% - 2 * var(--gutter)))',
          margin: '0 auto',
          position: 'relative',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: wide ? 'minmax(0, 1fr) auto' : '1fr',
          alignItems: 'center',
          columnGap: 'clamp(40px, 4.5vw, 88px)',
          rowGap: 56,
          paddingTop: wide ? navH : navH + 56,
          paddingBottom: wide ? 0 : 72,
        }}
      >
        <motion.div style={{ y: textY, opacity: fade, textAlign: wide ? 'left' : 'center', containerType: 'inline-size' }}>
          <h1 className="display" style={{ fontSize: h1Size, lineHeight: 1.02, fontWeight: 600, letterSpacing: '-0.034em' }}>
            <BlurWords style={{ whiteSpace: 'nowrap' }} text="Just text it." immediate delay={0.25} />
            <br />
            <BlurWords style={{ whiteSpace: 'nowrap' }} text="Handle makes the call." className="tone-2" immediate delay={0.45} />
          </h1>
          <motion.p
            className="lede"
            style={{ marginTop: 'clamp(24px, 4vh, 40px)', maxWidth: wide ? '30em' : 460, marginInline: wide ? 0 : 'auto', fontSize: wide ? 'clamp(20px, min(2.5cqi, 3.2vh), 27px)' : undefined }}
            initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.2, ease: EASE, delay: 1.0 }}
          >
            Handle calls customer support for you, waits on hold, and texts you when it’s fixed.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: EASE, delay: 1.2 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 28,
              marginTop: 'clamp(28px, 4.4vh, 44px)',
              justifyContent: wide ? 'flex-start' : 'center',
              flexWrap: 'wrap',
            }}
          >
            <a href="#how" className="btn-primary" style={{ paddingInline: 26 }}>
              See how it works
            </a>
            <a href="#features" className="link">
              Explore features <Chevron />
            </a>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, delay: 1.6 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 'clamp(28px, 5vh, 52px)',
              color: '#6e6e73',
              fontSize: 14,
              justifyContent: wide ? 'flex-start' : 'center',
            }}
          >
            <MessagesAppIcon size={20} />
            Lives in iMessage. Nothing to download.
          </motion.div>
        </motion.div>

        <motion.div
          style={{
            y: phoneY,
            position: 'relative',
            justifySelf: wide ? 'end' : 'center',
            alignSelf: wide ? 'end' : undefined,
            marginBottom: wide ? -(PHONE_H * scale - (vp.h - navH - pad)) : 0,
            perspective: 1800,
            width: phoneW,
          }}
          initial={{ opacity: 0, y: 100, filter: 'blur(20px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.8, ease: EASE, delay: 0.35 }}
        >
          <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d', opacity: loopFade, width: phoneW }}>
            <PhoneStage t={t} scale={scale} />
          </motion.div>
          {showCards && (
            <>
              <div style={{ position: 'absolute', left: phoneW - 110, top: '12%', zIndex: 5 }}>
                <TranscriptCard t={t} width={CARD_W} />
              </div>
              <div style={{ position: 'absolute', left: phoneW - 110, top: '57%', zIndex: 5 }}>
                <DataCard t={t} />
              </div>
            </>
          )}
        </motion.div>
      </div>
      {wide && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '16vh',
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 92%)',
            pointerEvents: 'none',
          }}
        />
      )}
    </section>
  );
};
