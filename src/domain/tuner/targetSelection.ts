import { centsBetween } from "../music/notes";
import type { TuningDefinition } from "../../types/contracts";

const HARMONIC_FACTORS = [1, 2, 0.5] as const;

export interface TargetSelectionResult {
  stringIndex: number;
  stringLabel: string;
  targetFrequencyHz: number;
  cents: number;
  harmonic: number;
}

export function selectTargetString(
  detectedFrequencyHz: number,
  tuning: TuningDefinition,
): TargetSelectionResult {
  let best: TargetSelectionResult | null = null;

  for (let index = 0; index < tuning.strings.length; index += 1) {
    const entry = tuning.strings[index];
    if (!entry) continue;

    for (const harmonic of HARMONIC_FACTORS) {
      const referenceHz = entry.frequencyHz * harmonic;
      const cents = centsBetween(detectedFrequencyHz, referenceHz);
      const score = Math.abs(cents);

      if (!best || score < Math.abs(best.cents)) {
        best = {
          stringIndex: index,
          stringLabel: entry.label,
          targetFrequencyHz: entry.frequencyHz,
          cents,
          harmonic,
        };
      }
    }
  }

  if (!best) {
    throw new Error("No strings available for target selection");
  }

  return best;
}
