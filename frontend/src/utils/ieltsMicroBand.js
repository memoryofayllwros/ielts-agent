/**
 * Map tagged-item accuracy (0–1) to an IELTS-style band on the 1–9 scale (0.5 steps).
 * This is a practice-derived estimate from item performance, not an official test result.
 */
export function accuracyToIeltsBand(accuracy) {
  const a = Math.min(1, Math.max(0, Number(accuracy) || 0));
  const raw = 1 + 8 * a;
  const half = Math.round(raw * 2) / 2;
  return Math.min(9, Math.max(1, half));
}

/** @param {number} band */
export function formatMicroSkillBand(band) {
  const b = Number(band);
  if (!Number.isFinite(b)) return "—";
  if (b % 1 === 0) return `Band ${b.toFixed(0)}`;
  return `Band ${b.toFixed(1)}`;
}

/** Delta in band units for a delta in accuracy (linear map 1→9). */
export function accuracyDeltaToBandDelta(deltaAccuracy) {
  return (Number(deltaAccuracy) || 0) * 8;
}
