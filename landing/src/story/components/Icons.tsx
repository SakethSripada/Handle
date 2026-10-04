import React from 'react';

type P = { size?: number; color?: string; style?: React.CSSProperties };

export const Signal: React.FC<P> = ({ color = '#000' }) => (
  <svg width={19} height={12} viewBox="0 0 19 12">
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={i * 5} y={9 - i * 3} width={3.2} height={3 + i * 3} rx={0.9} fill={color} />
    ))}
  </svg>
);

export const Wifi: React.FC<P> = ({ color = '#000' }) => (
  <svg width={17} height={12} viewBox="0 0 17 12">
    <path
      d="M8.5 2.3c2.4 0 4.6.9 6.3 2.5l1.2-1.2C14 1.6 11.4.5 8.5.5S3 1.6 1 3.6l1.2 1.2C3.9 3.2 6.1 2.3 8.5 2.3z"
      fill={color}
    />
    <path d="M8.5 5.6c1.5 0 2.9.6 3.9 1.5l1.2-1.2C12.3 4.6 10.5 3.9 8.5 3.9s-3.8.7-5.1 2l1.2 1.2c1-1 2.4-1.5 3.9-1.5z" fill={color} />
    <path d="M8.5 8.9c.7 0 1.3.3 1.7.7L8.5 11.4 6.8 9.6c.4-.4 1-.7 1.7-.7z" fill={color} />
  </svg>
);

export const Battery: React.FC<P & { level?: number }> = ({ color = '#000', level = 1 }) => (
  <svg width={27} height={13} viewBox="0 0 27 13">
    <rect x={0.5} y={0.5} width={23} height={12} rx={3.8} fill="none" stroke={color} strokeOpacity={0.4} />
    <rect x={2} y={2} width={20 * level} height={9} rx={2.5} fill={color} />
    <path d="M25 4.4v4.2c.8-.3 1.4-1.1 1.4-2.1s-.6-1.8-1.4-2.1z" fill={color} fillOpacity={0.45} />
  </svg>
);

export const ChevronLeft: React.FC<P> = ({ size = 22, color = '#007AFF' }) => (
  <svg width={size * 0.6} height={size} viewBox="0 0 12 21">
    <path d="M10.5 1.5L1.8 10.5l8.7 9" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronRight: React.FC<P> = ({ size = 9, color = '#8E8E93' }) => (
  <svg width={size * 0.6} height={size} viewBox="0 0 6 10">
    <path d="M1 1l4 4-4 4" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const VideoOutline: React.FC<P> = ({ color = '#007AFF' }) => (
  <svg width={28} height={19} viewBox="0 0 28 19">
    <rect x={1} y={1.5} width={18} height={16} rx={4} fill="none" stroke={color} strokeWidth={1.8} />
    <path d="M20.5 7.2l5.2-3.4c.6-.4 1.3 0 1.3.7v10c0 .7-.7 1.1-1.3.7l-5.2-3.4z" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
  </svg>
);

export const Plus: React.FC<P> = ({ size = 16, color = '#8E8E93' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16">
    <path d="M8 1.5v13M1.5 8h13" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </svg>
);

export const MicOutline: React.FC<P> = ({ color = '#8E8E93', size = 20 }) => (
  <svg width={size * 0.7} height={size} viewBox="0 0 14 20">
    <rect x={3.7} y={1} width={6.6} height={11.2} rx={3.3} fill="none" stroke={color} strokeWidth={1.7} />
    <path d="M1 9.2c0 3.3 2.7 6 6 6s6-2.7 6-6M7 15.2V19" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
  </svg>
);

export const ArrowUp: React.FC<P> = ({ size = 16, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16">
    <path d="M8 14V2.6M2.8 7.6L8 2.4l5.2 5.2" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ShiftIcon: React.FC<P & { filled?: boolean }> = ({ filled, color = '#000' }) => (
  <svg width={20} height={19} viewBox="0 0 20 19">
    <path
      d="M10 1.3L1.6 10h4.6v6.4c0 .8.6 1.4 1.4 1.4h4.8c.8 0 1.4-.6 1.4-1.4V10h4.6z"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  </svg>
);

export const DeleteIcon: React.FC<P> = ({ color = '#000' }) => (
  <svg width={25} height={18} viewBox="0 0 25 18">
    <path d="M8 1.2h13.5c1.4 0 2.5 1.1 2.5 2.5v10.6c0 1.4-1.1 2.5-2.5 2.5H8L1.2 9z" fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    <path d="M11.5 5.4l7 7.2M18.5 5.4l-7 7.2" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
  </svg>
);

export const Smiley: React.FC<P> = ({ color = '#50555C' }) => (
  <svg width={27} height={27} viewBox="0 0 27 27">
    <circle cx={13.5} cy={13.5} r={11.6} fill="none" stroke={color} strokeWidth={1.7} />
    <circle cx={9.6} cy={11} r={1.6} fill={color} />
    <circle cx={17.4} cy={11} r={1.6} fill={color} />
    <path d="M8 15.6c1.2 2.4 3.2 3.6 5.5 3.6s4.3-1.2 5.5-3.6" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
  </svg>
);

// ---- call screen (SF Symbols-like, filled) ----
export const SpeakerFill: React.FC<P> = ({ color = '#fff' }) => (
  <svg width={34} height={28} viewBox="0 0 34 28">
    <path d="M2 9.5h4.6L13.8 3c1-.9 2.5-.2 2.5 1.1v19.8c0 1.3-1.5 2-2.5 1.1L6.6 18.5H2c-.6 0-1-.4-1-1v-7c0-.6.4-1 1-1z" fill={color} />
    <path d="M21 9c1.4 1.3 2.2 3 2.2 5s-.8 3.7-2.2 5M25.5 5c2.6 2.3 4 5.5 4 9s-1.4 6.7-4 9" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  </svg>
);

export const VideoFill: React.FC<P> = ({ color = '#fff' }) => (
  <svg width={34} height={22} viewBox="0 0 34 22">
    <rect x={1} y={1.5} width={22} height={19} rx={5} fill={color} />
    <path d="M25 8l6.4-4.2c.7-.4 1.6.1 1.6.9v12.6c0 .8-.9 1.3-1.6.9L25 14z" fill={color} />
  </svg>
);

export const MicSlashFill: React.FC<P> = ({ color = '#fff' }) => (
  <svg width={26} height={32} viewBox="0 0 26 32">
    <rect x={8} y={1} width={10} height={18} rx={5} fill={color} />
    <path d="M4 14.5c0 5 4 9 9 9s9-4 9-9M13 23.5V30M8.5 30h9" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    <path d="M3 3l20 26" stroke="#3b3d44" strokeWidth={5} strokeLinecap="round" opacity={0} />
    <path d="M3 3l20 26" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  </svg>
);

export const PersonPlus: React.FC<P> = ({ color = '#fff' }) => (
  <svg width={34} height={28} viewBox="0 0 34 28">
    <circle cx={12} cy={8} r={6} fill={color} />
    <path d="M1 25c0-5.5 4.9-9 11-9s11 3.5 11 9c0 .6-.4 1-1 1H2c-.6 0-1-.4-1-1z" fill={color} />
    <path d="M28 8v10M23 13h10" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
  </svg>
);

export const PhoneDownFill: React.FC<P> = ({ color = '#fff', size = 38 }) => (
  <svg width={size} height={size * 0.42} viewBox="0 0 38 16">
    <path
      d="M19 1C11.4 1 4.8 3.2 1.9 6.3.7 7.5.8 9.4 1.6 10.8l1.1 1.9c.6 1 1.9 1.4 3 1l4.6-1.6c1-.4 1.6-1.4 1.5-2.4l-.3-2.6C13.6 6.2 16.2 5.8 19 5.8s5.4.4 7.5 1.3l-.3 2.6c-.1 1 .5 2 1.5 2.4l4.6 1.6c1.1.4 2.4 0 3-1l1.1-1.9c.8-1.4.9-3.3-.3-4.5C33.2 3.2 26.6 1 19 1z"
      fill={color}
    />
  </svg>
);

export const KeypadFill: React.FC<P> = ({ color = '#fff' }) => (
  <svg width={28} height={34} viewBox="0 0 28 34">
    {[0, 1, 2, 3].flatMap((r) =>
      [0, 1, 2].map((c) => (r === 3 && c !== 1 ? null : <circle key={`${r}${c}`} cx={4 + c * 10} cy={4 + r * 8.7} r={3.4} fill={color} />)),
    )}
  </svg>
);

export const MessagesAppIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.225,
      background: 'linear-gradient(180deg,#67FF81 0%,#01B41F 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <svg width={size * 0.72} height={size * 0.62} viewBox="0 0 26 22">
      <path d="M13 1C6.4 1 1 5.2 1 10.4c0 3 1.8 5.6 4.6 7.3-.3 1.4-1.1 2.6-2.2 3.4 2.2.1 4.2-.6 5.7-1.9 1.2.3 2.5.5 3.9.5 6.6 0 12-4.2 12-9.3S19.6 1 13 1z" fill="#fff" />
    </svg>
  </div>
);
