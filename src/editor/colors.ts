export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = ((h % 1) + 1) % 1
  const ss = clamp01(s)
  const vv = clamp01(v)

  const i = Math.floor(hh * 6)
  const f = hh * 6 - i
  const p = vv * (1 - ss)
  const q = vv * (1 - f * ss)
  const t = vv * (1 - (1 - f) * ss)

  const m = i % 6
  const [r, g, b] =
    m === 0
      ? [vv, t, p]
      : m === 1
        ? [q, vv, p]
        : m === 2
          ? [p, vv, t]
          : m === 3
            ? [p, q, vv]
            : m === 4
              ? [t, p, vv]
              : [vv, p, q]

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

export function rgbCss(rgb: { r: number; g: number; b: number }, a = 1): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}
