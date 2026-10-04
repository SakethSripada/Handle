import { Easing, interpolate, spring } from 'remotion';
import { FPS } from './timeline';

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Apple-like ease in/out. */
export const smooth = Easing.bezier(0.65, 0, 0.35, 1);
/** Strong ease-out (expo-ish) for reveals. */
export const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
export const outQuart = Easing.bezier(0.25, 1, 0.5, 1);
export const inQuart = Easing.bezier(0.5, 0, 0.75, 0);

/** progress 0..1 between two times (s) with easing */
export const prog = (t: number, a: number, b: number, ease: (x: number) => number = smooth) =>
  ease(clamp01((t - a) / (b - a)));

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** iOS-ish spring from time `at` (s) */
export const springAt = (
  t: number,
  at: number,
  cfg: { damping?: number; stiffness?: number; mass?: number } = {},
) =>
  t < at
    ? 0
    : spring({
        frame: (t - at) * FPS,
        fps: FPS,
        config: { damping: cfg.damping ?? 20, stiffness: cfg.stiffness ?? 170, mass: cfg.mass ?? 1 },
      });

/** keyframed values: [[time, value], ...] with smooth easing per segment */
export function keyframes(t: number, kf: [number, number][], ease = smooth) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 0; i < kf.length - 1; i++) {
    const [ta, va] = kf[i];
    const [tb, vb] = kf[i + 1];
    if (t <= tb) {
      if (tb === ta) return vb;
      return interpolate(t, [ta, tb], [va, vb], { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    }
  }
  return kf[kf.length - 1][1];
}

/** visibility envelope: fades in over [a, a+fi], out over [b, b+fo] */
export const envelope = (t: number, a: number, b: number, fi = 0.4, fo = 0.4) =>
  Math.min(prog(t, a, a + fi), 1 - prog(t, b, b + fo));
