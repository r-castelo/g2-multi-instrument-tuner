import type { PitchDetection } from "../../types/contracts";

export interface PitchSmootherOptions {
  medianWindow: number;
  alpha: number;
  staleMs: number;
}

const DEFAULT_OPTIONS: PitchSmootherOptions = {
  medianWindow: 5,
  alpha: 0.35,
  staleMs: 400,
};

export class PitchSmoother {
  private readonly options: PitchSmootherOptions;
  private readonly history: number[] = [];
  private emaFrequency: number | null = null;
  private lastTsMs = 0;

  constructor(options: Partial<PitchSmootherOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
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
        this.emaFrequency = this.options.alpha * median + (1 - this.options.alpha) * this.emaFrequency;
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
