import React from 'react';
import { T, fmtClock, HOLD_SECONDS } from './story/timeline';
import { clamp01, outExpo } from './story/anim';
import { Banner } from './story/components/CallScreen';
import { HandleAvatar, LIME } from './story/components/Brand';
import { BlurWords, Reveal, useInViewTime, useViewport } from './lib';
import { GmailMini, LineBody } from './context';

const Head: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div style={{ position: 'relative', zIndex: 2, maxWidth: 440 }}>
    <h3 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15 }}>{title}</h3>
    <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.45, color: '#a1a1a6', letterSpacing: '-0.01em' }}>{body}</p>
  </div>
);

const Card: React.FC<{ span: number; h: number; children: React.ReactNode; delay?: number; pad?: number; style?: React.CSSProperties }> = ({
  span,
  h,
  children,
  delay = 0,
  pad = 32,
  style,
}) => (
  <Reveal delay={delay} style={{ gridColumn: `span ${span}` }} className="bento-cell">
    <div className="card bento-card" style={{ height: h, padding: pad, display: 'flex', flexDirection: 'column', ...style }}>
      {children}
    </div>
  </Reveal>
);

const HoldVisual: React.FC = () => {
  const [ref, u] = useInViewTime<HTMLDivElement>();
  const cycle = u % 9;
  const p = outExpo(clamp01((cycle - 0.4) / 3.6));
  const secs = p * HOLD_SECONDS;
  return (
    <div ref={ref} style={{ marginTop: 'auto' }}>
      <div
        className="grad-silver"
        style={{ fontSize: 'clamp(80px, 9vw, 150px)', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}
      >
        {fmtClock(secs)}
      </div>
      <div style={{ marginTop: 34, height: 4, borderRadius: 2, background: '#1c1c1e', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p * 100}%`, borderRadius: 2, background: `linear-gradient(90deg, #3c6e4e, ${LIME})` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 15, color: '#6e6e73' }}>
        <span>Handle dialed</span>
        <span style={{ color: p > 0.995 ? LIME : '#6e6e73', transition: 'color .4s' }}>Agent picked up</span>
      </div>
    </div>
  );
};

const GmailVisual: React.FC = () => {
  const [ref, u] = useInViewTime<HTMLDivElement>();
  return (
    <div ref={ref} style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center' }}>
      <div style={{ transform: 'rotate(-2deg)', transformOrigin: 'center' }}>
        <GmailMini u={u % 7.5} width={380} />
      </div>
    </div>
  );
};

const AskVisual: React.FC = () => {
  const [ref, u] = useInViewTime<HTMLDivElement>();
  const c = u % 7;
  const bubble = clamp01((c - 2.2) / 0.5);
  return (
    <div ref={ref} style={{ marginTop: 'auto', position: 'relative', height: 270, marginInline: -32, marginBottom: -32, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 28%)', maskImage: 'linear-gradient(180deg, transparent 0%, #000 28%)' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(120% 90% at 50% 0%, #3d424d 0%, #22252c 60%, #15171b 100%)',
        }}
      />
      <div style={{ position: 'absolute', left: '50%', top: -24, width: 402, height: 300, transform: 'translateX(-50%) scale(0.94)', transformOrigin: 'top center' }}>
        <Banner t={T.approval + Math.min(c, 1.7)} />
        <div
          style={{
            position: 'absolute',
            right: 18,
            top: 240,
            opacity: bubble,
            transform: `translateY(${(1 - bubble) * 30}px) scale(${0.9 + 0.1 * bubble})`,
            transformOrigin: 'bottom right',
            background: 'linear-gradient(180deg,#2f95ff,#0a7cff)',
            color: '#fff',
            borderRadius: 19,
            padding: '8px 14px',
            fontSize: 17,
            letterSpacing: -0.25,
            fontFamily: 'var(--sys)',
          }}
        >
          Yes, accept it. No extra charges.
        </div>
      </div>
    </div>
  );
};

const VoiceVisual: React.FC = () => {
  const [ref, u] = useInViewTime<HTMLDivElement>();
  const line = T.lines[1];
  const c = u % (line.dur + 2.5);
  const t = line.at + c;
  const speaking = c < line.dur;
  return (
    <div ref={ref} style={{ marginTop: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 90, marginBottom: 26 }}>
        {Array.from({ length: 44 }).map((_, i) => {
          const env = Math.sin((i / 43) * Math.PI);
          const n = 0.5 + 0.5 * Math.sin(u * 9 + i * 0.55) * Math.sin(u * 3.7 + i * 0.21);
          const h = speaking ? 6 + env * n * 84 : 6;
          return (
            <span
              key={i}
              style={{ flex: 1, height: h, borderRadius: 3, background: i % 2 ? LIME : '#a8d46a', opacity: speaking ? 0.95 : 0.3, transition: 'height .09s linear, opacity .4s' }}
            />
          );
        })}
      </div>
      <LineBody l={line} t={t} size={19} />
    </div>
  );
};

const CASES = [
  { co: 'Xfinity', what: 'Price lock restored', amt: '$324/yr', color: '#6b2fb8' },
  { co: 'United', what: 'Seat fee refunded', amt: '$48', color: '#1a4fa0' },
  { co: 'Verizon', what: 'Late fee waived', amt: '$35', color: '#cd040b' },
  { co: 'Delta', what: 'Delayed bag claim', amt: '$150', color: '#0b2a5b' },
];

const MemoryVisual: React.FC = () => {
  const [ref, u] = useInViewTime<HTMLDivElement>();
  return (
    <div ref={ref} style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {CASES.map((c, i) => {
        const p = outExpo(clamp01((u - 0.2 - i * 0.14) / 0.9));
        return (
          <div
            key={c.co}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 14px',
              borderRadius: 18,
              background: '#151617',
              opacity: p,
              transform: `translateY(${(1 - p) * 18}px)`,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: c.color,
                color: '#fff',
                fontWeight: 600,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {c.co[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{c.co}</div>
              <div style={{ fontSize: 14, color: '#86868b' }}>{c.what}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: LIME, fontVariantNumeric: 'tabular-nums' }}>{c.amt}</div>
          </div>
        );
      })}
    </div>
  );
};

const Bub: React.FC<{ me?: boolean; children: React.ReactNode; p: number }> = ({ me, children, p }) => (
  <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' }}>
    <div
      style={{
        maxWidth: '78%',
        padding: '8px 14px',
        borderRadius: 19,
        background: me ? 'linear-gradient(180deg,#2f95ff,#0a7cff)' : '#e9e9eb',
        color: me ? '#fff' : '#000',
        fontSize: 16,
        lineHeight: 1.35,
        letterSpacing: -0.2,
        opacity: clamp01(p * 1.5),
        transform: `scale(${0.6 + 0.4 * Math.min(1, p)})`,
        transformOrigin: me ? 'bottom right' : 'bottom left',
      }}
    >
      {children}
    </div>
  </div>
);

const IMessageVisual: React.FC = () => {
  const [ref, u] = useInViewTime<HTMLDivElement>();
  const c = u % 8;
  const sp = (d: number) => {
    const x = clamp01((c - d) / 0.5);
    return x < 1 ? 1 - Math.pow(1 - x, 3) * Math.cos(x * 4) : 1;
  };
  return (
    <div ref={ref} style={{ marginTop: 'auto', background: '#fff', borderRadius: 24, padding: 18, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--sys)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid #ececee', marginBottom: 6 }}>
        <HandleAvatar size={32} />
        <span style={{ color: '#000', fontSize: 15, fontWeight: 600 }}>Handle</span>
      </div>
      <Bub me p={sp(0.4)}>Delta lost my bag. Get me whatever they owe me.</Bub>
      <Bub p={sp(1.6)}>On it. I’ll text you when it’s sorted.</Bub>
      <Bub p={sp(4.2)}>Done. $150 credit plus your bag arrives tonight ✈️</Bub>
    </div>
  );
};

const SavingsVisual: React.FC = () => {
  const [ref, u] = useInViewTime<HTMLDivElement>();
  const c = outExpo(clamp01((u - 0.2) / 2));
  return (
    <div ref={ref} style={{ marginTop: 'auto', display: 'flex', gap: 'clamp(28px, 4vw, 64px)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      {[
        { v: `$${Math.round(324 * c)}`, l: 'saved this year' },
        { v: `${Math.round(32 * c)} min`, l: 'not spent on hold' },
        { v: `${Math.round(2 * c)}`, l: 'texts from you' },
      ].map((s) => (
        <div key={s.l}>
          <div style={{ fontSize: 'clamp(48px, 4.4vw, 80px)', fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
          <div style={{ fontSize: 16, color: '#86868b', marginTop: 10 }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
};

export const Features: React.FC = () => {
  const vp = useViewport();
  const narrow = vp.w < 900;
  const H = (h: number) => (narrow ? undefined : h);
  return (
    <section id="features" className="section">
      <div className="wrap">
        <h2 className="display h2" style={{ textAlign: 'center' }}>
          <BlurWords text="Built to handle" />
          <br />
          <BlurWords text="the worst part of your day." className="grad-silver" delay={0.15} />
        </h2>
        <div className="bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 20, marginTop: 'clamp(56px, 9vh, 96px)' }}>
          <Card span={7} h={H(470) ?? 440}>
            <Head title="Hold music is its problem now." body="Handle waits in the queue for as long as it takes. You get on with your day." />
            <HoldVisual />
          </Card>
          <Card span={5} h={H(470) ?? 460} delay={0.08}>
            <Head title="Knows the details." body="Connect Gmail and Handle finds account numbers, receipts, and the fine print mid-call." />
            <GmailVisual />
          </Card>
          <Card span={4} h={H(450) ?? 440}>
            <Head title="Nothing costs you without a yes." body="Fees, contracts, plan changes. Handle texts you first." />
            <AskVisual />
          </Card>
          <Card span={4} h={H(450) ?? 420} delay={0.08}>
            <Head title="Sounds like a person." body="A natural voice that explains, pushes back, and stays polite." />
            <VoiceVisual />
          </Card>
          <Card span={4} h={H(450) ?? 460} delay={0.16}>
            <Head title="Remembers every case." body="Every call is logged, so the next one starts smarter." />
            <MemoryVisual />
          </Card>
          <Card span={5} h={H(420) ?? 440}>
            <Head title="Lives in iMessage." body="No app, no login. Just a contact you text." />
            <IMessageVisual />
          </Card>
          <Card span={7} h={H(420) ?? 400} delay={0.08} style={{ background: 'radial-gradient(120% 120% at 100% 100%, #17301f 0%, #0b0c0c 55%)' }}>
            <Head title="Money back. Time back." body="Every case ends with what you saved and the hours you didn’t lose." />
            <SavingsVisual />
          </Card>
        </div>
      </div>
    </section>
  );
};
