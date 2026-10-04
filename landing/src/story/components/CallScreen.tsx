import React from 'react';
import { T, callClock, fmtClock } from '../timeline';
import { prog, springAt } from '../anim';
import { HomeIndicator, StatusBar } from './Phone';
import { KeypadFill, MessagesAppIcon, MicSlashFill, PersonPlus, PhoneDownFill, SpeakerFill, VideoFill } from './Icons';
import { HandleAvatar } from './Brand';
import { COPY } from '../timeline';

const Btn: React.FC<{ icon: React.ReactNode; label: string; red?: boolean; active?: boolean; dim?: number }> = ({
  icon,
  label,
  red,
  active,
  dim = 0,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 80, opacity: 1 - dim * 0.6 }}>
    <div
      style={{
        width: 78,
        height: 78,
        borderRadius: 39,
        background: red ? '#FF3B30' : active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.2)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </div>
    <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, letterSpacing: -0.1 }}>{label}</div>
  </div>
);

export const Banner: React.FC<{ t: number }> = ({ t }) => {
  const p = springAt(t, T.approval, { damping: 17, stiffness: 160 });
  const press = prog(t, T.bannerTap - 0.08, T.bannerTap + 0.05) * (1 - prog(t, T.bannerTap + 0.1, T.bannerTap + 0.3));
  const gone = prog(t, T.bannerTap + 0.12, T.bannerTap + 0.42);
  if (t < T.approval) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 9,
        right: 9,
        top: 56,
        transform: `translateY(${(1 - p) * -150}px) scale(${(1 - press * 0.035) * (1 + gone * 0.08)})`,
        opacity: 1 - gone,
        zIndex: 120,
        borderRadius: 24,
        padding: '13px 15px 14px 13px',
        background: 'rgba(242,242,244,0.84)',
        backdropFilter: 'blur(30px) saturate(1.8)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ position: 'relative', marginTop: 1 }}>
        <HandleAvatar size={38} />
        <div style={{ position: 'absolute', right: -4, bottom: -3, borderRadius: 6, border: '1.5px solid rgba(242,242,244,1)' }}>
          <MessagesAppIcon size={16} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#000', letterSpacing: -0.2 }}>Handle</span>
          <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.6)' }}>now</span>
        </div>
        <div
          style={{
            fontSize: 15,
            lineHeight: '20px',
            color: '#000',
            letterSpacing: -0.2,
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {COPY.question}
        </div>
      </div>
    </div>
  );
};

export const CallScreen: React.FC<{ t: number }> = ({ t }) => {
  const clock = callClock(t);
  const ended = t >= T.callEnd;
  const status = ended ? 'Call Ended' : clock === null ? 'calling…' : fmtClock(clock);
  const endDim = prog(t, T.callEnd, T.callEnd + 0.4);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background:
          'radial-gradient(120% 70% at 50% 0%, #5b6170 0%, #3a3e48 35%, #22252c 70%, #17191e 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(60% 40% at 20% 85%, rgba(90,110,140,0.35), transparent), radial-gradient(50% 35% at 85% 60%, rgba(120,100,130,0.25), transparent)',
        }}
      />
      <StatusBar dark />
      <div style={{ position: 'absolute', top: 104, left: 0, right: 0, textAlign: 'center', color: '#fff' }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            margin: '0 auto 16px',
            background: 'linear-gradient(180deg,#a9aeba,#868b97)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            fontWeight: 500,
            color: '#fff',
            letterSpacing: 0.5,
          }}
        >
          XS
        </div>
        <div style={{ fontSize: 17, color: 'rgba(235,235,245,0.62)', fontVariantNumeric: 'tabular-nums', letterSpacing: -0.1 }}>
          {status}
        </div>
        <div style={{ fontSize: 34, fontWeight: 500, marginTop: 2, letterSpacing: -0.6 }}>Xfinity Support</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 548,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 80px)',
          justifyContent: 'center',
          columnGap: 34,
          rowGap: 26,
        }}
      >
        <Btn icon={<SpeakerFill color={!ended && clock !== null ? "#1c1c1e" : "#fff"} />} label="speaker" active={!ended && clock !== null} dim={endDim} />
        <Btn icon={<VideoFill />} label="FaceTime" dim={endDim} />
        <Btn icon={<MicSlashFill />} label="mute" dim={endDim} />
        <Btn icon={<PersonPlus />} label="add" dim={endDim} />
        <Btn icon={<PhoneDownFill />} label="End" red dim={endDim} />
        <Btn icon={<KeypadFill />} label="keypad" dim={endDim} />
      </div>
      <Banner t={t} />
      <HomeIndicator dark />
    </div>
  );
};
