import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTuningById } from "../src/domain/music/tuningCatalog.js";
import { selectTargetString } from "../src/domain/tuner/targetSelection.js";

describe("selectTargetString", () => {
  it("matches direct target string", () => {
    const tuning = getTuningById("gtr_standard");
    const result = selectTargetString(110, tuning);

    assert.equal(result.stringLabel, "A2");
    assert.ok(Math.abs(result.cents) < 0.01);
  });

  it("supports harmonic matching", () => {
    const tuning = getTuningById("gtr_standard");
    const result = selectTargetString(164.8138, tuning); // E2 second harmonic

    assert.equal(result.stringLabel, "E2");
    assert.equal(result.harmonic, 2);
    assert.ok(Math.abs(result.cents) < 0.1);
  });

  it("matches ukulele A4", () => {
    const tuning = getTuningById("uke_standard_c6");
    const result = selectTargetString(440, tuning);

    assert.equal(result.stringLabel, "A4");
    assert.ok(Math.abs(result.cents) < 0.01);
  });
});
