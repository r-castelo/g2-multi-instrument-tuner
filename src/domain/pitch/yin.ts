import type { PitchDetection } from "../../types/contracts";

export interface YinOptions {
  minFreqHz: number;
  maxFreqHz: number;
  threshold: number;
}

const DEFAULT_OPTIONS: YinOptions = {
  minFreqHz: 35,
  maxFreqHz: 500,
  threshold: 0.1,
};

export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i] ?? 0;
    sum += value * value;
  }

  return Math.sqrt(sum / samples.length);
}

export function detectPitchYin(
  samples: Float32Array,
  sampleRateHz: number,
  options: Partial<YinOptions> = {},
): PitchDetection | null {
  const config: YinOptions = { ...DEFAULT_OPTIONS, ...options };
  const size = samples.length;

  if (size < 32 || sampleRateHz <= 0) {
    return null;
  }

  const rms = computeRms(samples);
  if (rms < 1e-4) {
    return null;
  }

  const tauMin = Math.max(2, Math.floor(sampleRateHz / config.maxFreqHz));
  const tauMax = Math.min(
    Math.floor(sampleRateHz / config.minFreqHz),
    Math.floor(size / 2) - 1,
  );

  if (tauMax <= tauMin) {
    return null;
  }

  const difference = new Float64Array(tauMax + 1);
  const cmndf = new Float64Array(tauMax + 1);

  for (let tau = 1; tau <= tauMax; tau += 1) {
    let diff = 0;
    const limit = size - tau;
    for (let i = 0; i < limit; i += 1) {
      const delta = (samples[i] ?? 0) - (samples[i + tau] ?? 0);
      diff += delta * delta;
    }
    difference[tau] = diff;
  }

  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= tauMax; tau += 1) {
    runningSum += difference[tau] ?? 0;
    if (runningSum === 0) {
      cmndf[tau] = 1;
    } else {
      cmndf[tau] = ((difference[tau] ?? 0) * tau) / runningSum;
    }
  }

  let bestTau = -1;

  for (let tau = tauMin; tau <= tauMax; tau += 1) {
    if ((cmndf[tau] ?? 1) < config.threshold) {
      let candidate = tau;
      while (
        candidate + 1 <= tauMax &&
        (cmndf[candidate + 1] ?? 1) < (cmndf[candidate] ?? 1)
      ) {
        candidate += 1;
      }
      bestTau = candidate;
      break;
    }
  }

  if (bestTau < 0) {
    let minTau = tauMin;
    let minValue = cmndf[tauMin] ?? Number.POSITIVE_INFINITY;
    for (let tau = tauMin + 1; tau <= tauMax; tau += 1) {
      const current = cmndf[tau] ?? Number.POSITIVE_INFINITY;
      if (current < minValue) {
        minValue = current;
        minTau = tau;
      }
    }
    if (minValue > 0.25) {
      return null;
    }
    bestTau = minTau;
  }

  let refinedTau = bestTau;
  if (bestTau > 1 && bestTau < tauMax) {
    const x0 = cmndf[bestTau - 1] ?? cmndf[bestTau] ?? 0;
    const x1 = cmndf[bestTau] ?? 0;
    const x2 = cmndf[bestTau + 1] ?? cmndf[bestTau] ?? 0;
    const denominator = x0 + x2 - 2 * x1;
    if (Math.abs(denominator) > 1e-9) {
      refinedTau = bestTau + (x0 - x2) / (2 * denominator);
    }
  }

  if (refinedTau <= 0) {
    return null;
  }

  const frequencyHz = sampleRateHz / refinedTau;
  if (!Number.isFinite(frequencyHz)) {
    return null;
  }

  const confidence = Math.max(0, Math.min(1, 1 - (cmndf[bestTau] ?? 1)));

  return {
    frequencyHz,
    confidence,
    rms,
  };
}
