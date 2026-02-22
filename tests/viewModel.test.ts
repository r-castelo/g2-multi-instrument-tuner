import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTuningById } from "../src/domain/music/tuningCatalog.js";
import { buildTunerViewModel } from "../src/domain/tuner/viewModel.js";

describe("buildTunerViewModel", () => {
  it("renders no-reading state", () => {
    const tuning = getTuningById("gtr_standard");

    const model = buildTunerViewModel({
      selection: { instrument: "guitar", tuning: "gtr_standard" },
      tuning,
      reading: null,
      status: { kind: "idle" },
      needsAudioEnable: false,
      tunedStrings: new Set<string>(),
      activeTarget: null,
    });

    assert.ok(model.content.includes("[ GTR | Standard 6 ]"));
    assert.ok(model.content.includes("No stable note detected"));
    assert.ok(model.content.includes("FLAT ["));
    assert.ok(model.content.includes("Hint: Pluck a string and let it ring"));
    assert.ok(model.status.includes("Waiting for signal"));
    assert.ok(model.content.length <= 1000);
  });

  it("renders tuned reading", () => {
    const tuning = getTuningById("uke_standard_c6");

    const model = buildTunerViewModel({
      selection: { instrument: "ukulele", tuning: "uke_standard_c6" },
      tuning,
      reading: {
        detectedFrequencyHz: 440,
        detectedNote: "A4",
        targetStringName: "A4",
        targetFrequencyHz: 440,
        cents: 0.2,
        inTune: true,
        quality: "good",
        source: "web_mic",
      },
      status: { kind: "web_active", source: "web_mic" },
      needsAudioEnable: false,
      tunedStrings: new Set<string>(["G4", "C4", "A4"]),
      activeTarget: "A4",
    });

    assert.ok(model.content.includes("[ UKE | Standard 4 ]"));
    assert.ok(model.content.includes("[G*]"));
    assert.ok(model.content.includes("[C*]"));
    assert.ok(model.content.includes(">A*<"));
    assert.ok(model.content.includes("NOTE: A4"));
    assert.ok(model.content.includes("Hint: Locked in. Move to next string"));
    assert.ok(model.status.includes("Phone Mic: live"));
  });
});
