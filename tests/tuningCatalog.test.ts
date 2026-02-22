import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getTuningById,
  getTuningsForInstrument,
  normalizeSelection,
  TUNING_CATALOG,
} from "../src/domain/music/tuningCatalog.js";

describe("tuningCatalog", () => {
  it("contains all required scoped tunings", () => {
    assert.equal(TUNING_CATALOG.length, 6);
    assert.equal(getTuningsForInstrument("guitar").length, 4);
    assert.equal(getTuningsForInstrument("bass").length, 1);
    assert.equal(getTuningsForInstrument("ukulele").length, 1);
  });

  it("returns known tuning by id", () => {
    const tuning = getTuningById("gtr_drop_d");
    assert.equal(tuning.instrument, "guitar");
    assert.equal(tuning.strings[0]?.label, "D2");
  });

  it("normalizes invalid instrument+tuning combinations", () => {
    const normalized = normalizeSelection({
      instrument: "bass",
      tuning: "gtr_standard",
    });

    assert.equal(normalized.instrument, "bass");
    assert.equal(normalized.tuning, "bass_standard_4");
  });
});
