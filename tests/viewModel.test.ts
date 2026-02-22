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
    });

    assert.ok(model.content.includes("Pluck a string"));
    assert.ok(model.status.includes("IDLE"));
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
    });

    assert.ok(model.content.includes("IN TUNE"));
    assert.ok(model.status.includes("WEBMIC"));
  });
});
