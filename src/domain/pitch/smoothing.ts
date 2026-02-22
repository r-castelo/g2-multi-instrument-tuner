import type { PitchDetection } from "../../types/contracts";

export interface PitchSmootherOptions {
  medianWindow: number;
  alpha: number;
  attackAlpha: number;
  releaseAlpha: number;
  fastChangeHz: number;
  staleMs: number;
}

const DEFAULT_OPTIONS: PitchSmootherOptions = {
  medianWindow: 3,
  alpha: 0.5,
  attackAlpha: 0.78,
  releaseAlpha: 0.42,
  fastChangeHz: 1.5,
  staleMs: 400,
};

export class PitchSmoother {
  private readonly options: PitchSmootherOptions;
  private readonly history: number[] = [];
  private emaFrequency: number | null = null;
  private lastTsMs = 0;

  constructor(options: Partial<PitchSmootherOptions> = {}) {
    const merged = { ...DEFAULT_OPTIONS, ...options };

    // Backward-compatible behavior: when alpha is explicitly provided and
    // attack/release values are not, use that alpha for both.
    if (options.alpha !== undefined) {
      if (options.attackAlpha === undefined) {
        merged.attackAlpha = options.alpha;
      }
      if (options.releaseAlpha === undefined) {
        merged.releaseAlpha = options.alpha;
      }
    }

    this.options = merged;
  }

  reset(): void {
    this.history.length = 0;
    this.emaFrequency = null;
    this.lastTsMs = 0;
  }

  next(input: PitchDetection | null, tsMs: number): PitchDetection | null {
    if (input) {
      this.history.push(input.frequencyHz);
      if (this.history.length > this.options.medianWindow) {
        this.history.shift();
      }

      const median = calculateMedian(this.history);
      if (this.emaFrequency === null) {
        this.emaFrequency = median;
      } else {
        const deltaHz = Math.abs(median - this.emaFrequency);
        const alpha = deltaHz >= this.options.fastChangeHz
          ? this.options.attackAlpha
          : this.options.releaseAlpha;
        this.emaFrequency = alpha * median + (1 - alpha) * this.emaFrequency;
      }

      this.lastTsMs = tsMs;

      return {
        frequencyHz: this.emaFrequency,
        confidence: input.confidence,
        rms: input.rms,
      };
    }

    if (this.emaFrequency === null) {
      return null;
    }

    if (tsMs - this.lastTsMs > this.options.staleMs) {
      this.reset();
      return null;
    }

    return {
      frequencyHz: this.emaFrequency,
      confidence: 0,
      rms: 0,
    };
  }
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    const left = sorted[middle - 1] ?? 0;
    const right = sorted[middle] ?? 0;
    return (left + right) / 2;
  }

  return sorted[middle] ?? 0;
}
