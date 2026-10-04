import React, { useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import { T } from './story/timeline';
import { PHONE_H } from './story/components/Phone';
import { BlurWords, PhoneStage, useViewport } from './lib';

const STEPS = [
  {
    title: 'Tell it what happened.',
    body: 'Text Handle like you’d text a friend. No forms, no app, no account numbers.',
    range: [T.kbUp1 - 0.3, T.reply1 + 1.4],
  },
  {
    title: 'It makes the call.',
    body: 'Handle dials, sits through the hold music, and talks to a real agent in a natural voice.',
    range: [T.callStart, T.lines[1].at + T.lines[1].dur + 0.6],
  },
  {
    title: 'It asks before it spends.',
    body: 'Anything that costs money or changes your plan waits for your OK. Reply, and the call carries on.',
    range: [T.approval - 0.4, T.send2 + 0.9],
  },
  {
    title: 'It texts you when it’s fixed.',
    body: 'The outcome, the money saved, and the time you didn’t lose. Every case is kept for next time.',
    range: [T.outScreen - 0.1, T.out2 + 1.4],
  },
] as const;

const smoothstep = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export const HowItWorks: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const vp = useViewport();
  const wide = vp.w >= 1000;
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => setP(v));

  const n = STEPS.length;
  const idx = Math.min(n - 1, Math.floor(p * n));
  const raw = p * n - idx;
  const local = Math.min(1, raw / 0.82);
  const [a, b] = STEPS[idx].range;
  const t = a + (b - a) * local;
  const edge = Math.min(raw / 0.06, (1 - raw) / 0.06, 1);
  const dip = idx === 0 && raw < 0.5 ? 1 : idx === n - 1 && raw > 0.5 ? 1 : smoothstep(edge);
  const pad = Math.min(56, Math.max(24, vp.h * 0.045));
  const scale = wide ? Math.min(0.82, (vp.h - 64 - pad * 2) / PHONE_H) : Math.min(0.56, (vp.h - 64 - 300) / PHONE_H);

  return (
    <section id="how" style={{ position: 'relative' }}>
      <div className="wrap section" style={{ paddingBottom: 'clamp(24px, 5vh, 56px)', textAlign: 'center' }}>
        <h2 className="display h2">
          <BlurWords text="You send one text." />
          <br />
          <BlurWords text="Handle does the rest." className="grad-silver" delay={0.2} />
        </h2>
      </div>

      <div ref={ref} style={{ height: `${n * 110}vh`, position: 'relative' }}>
        <div style={{ position: 'sticky', top: 'var(--nav)', height: 'calc(100vh - var(--nav))', overflow: 'hidden' }}>
          <div
            className="wrap"
            style={{
              height: '100%',
              display: 'grid',
              gridTemplateColumns: wide ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr',
              gridTemplateRows: wide ? '1fr' : 'auto 1fr',
              alignItems: 'center',
              justifyItems: 'center',
              gap: wide ? 'clamp(32px, 5vw, 96px)' : 20,
              paddingTop: wide ? 0 : 24,
            }}
          >
            <div
              style={{
                position: 'relative',
                opacity: 0.25 + 0.75 * dip,
                filter: `blur(${(1 - dip) * 8}px)`,
                transform: `scale(${0.97 + 0.03 * dip})`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '-12% -30%',
                  background: 'radial-gradient(50% 50% at 50% 50%, rgba(52,92,68,0.35), transparent 70%)',
                  zIndex: -1,
                }}
              />
              <PhoneStage t={t} scale={scale} />
            </div>

            <div style={{ position: 'relative', alignSelf: wide ? 'center' : 'start', justifySelf: wide ? 'start' : 'center', width: '100%', maxWidth: 520 }}>
              {wide ? (
                <div style={{ position: 'relative', paddingLeft: 36 }}>
                  <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 2, borderRadius: 2, background: '#1c1c1e' }}>
                    <div style={{ width: '100%', height: `${p * 100}%`, borderRadius: 2, background: 'linear-gradient(180deg,#d7efa5,#8fc45a)' }} />
                  </div>
                  {STEPS.map((s, i) => {
                    const on = i === idx;
                    return (
                      <div key={s.title} style={{ padding: 'clamp(12px, 2.2vh, 22px) 0', transition: 'opacity .6s cubic-bezier(.2,.8,.2,1)', opacity: on ? 1 : 0.22 }}>
                        <h3 style={{ margin: 0, fontSize: 'clamp(28px, min(2.6vw, 5vh), 40px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{s.title}</h3>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateRows: on ? '1fr' : '0fr',
                            transition: 'grid-template-rows .7s cubic-bezier(.2,.8,.2,1)',
                          }}
                        >
                          <div style={{ minHeight: 0, overflow: 'hidden' }}>
                            <p className="lede" style={{ marginTop: 14, fontSize: 20 }}>{s.body}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '0 8px' }}>
                  <motion.div key={idx} initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.6 }}>
                    <h3 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>{STEPS[idx].title}</h3>
                    <p className="lede" style={{ marginTop: 10, fontSize: 17 }}>{STEPS[idx].body}</p>
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
