import React from 'react';

export const GREEN = '#183d2e';
export const GREEN_2 = '#234e36';
export const LIME = '#d7efa5';
export const CREAM = '#f6f6f0';
export const BRAND_FONT = `'Manrope Variable', Manrope, sans-serif`;

/** The Handle glyph: a carrying-handle arch sheltering a dot (the "." of the wordmark). */
export const HandleGlyph: React.FC<{ size?: number; arch?: string; dot?: string }> = ({ size = 40, arch = LIME, dot = LIME }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
    <path d="M26 80 V49 A24 24 0 0 1 74 49 V80" fill="none" stroke={arch} strokeWidth={17} strokeLinecap="round" />
    <circle cx={50} cy={70} r={10.5} fill={dot} />
  </svg>
);

/** Contact photo used for Handle in Messages / notifications. */
export const HandleAvatar: React.FC<{ size?: number }> = ({ size = 52 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      background: `radial-gradient(circle at 30% 22%, #2f6447 0%, ${GREEN} 72%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <HandleGlyph size={size * 0.68} />
  </div>
);

/** App-icon style mark: lime squircle with the green glyph. */
export const HandleMark: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 40, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.27,
      background: `linear-gradient(160deg, #e6f7c2 0%, ${LIME} 55%, #c4e48a 100%)`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `inset 0 ${size * 0.01}px 0 rgba(255,255,255,0.6), 0 ${size * 0.08}px ${size * 0.25}px rgba(0,0,0,0.25)`,
      ...style,
    }}
  >
    <HandleGlyph size={size * 0.72} arch={GREEN} dot={GREEN} />
  </div>
);

/** Official-style Gmail "M" logo. */
export const GmailLogo: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size * 0.75} viewBox="52 42 88 66">
    <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
    <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
    <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
    <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
    <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
  </svg>
);
