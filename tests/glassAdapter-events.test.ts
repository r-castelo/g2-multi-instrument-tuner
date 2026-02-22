import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OsEventTypeList } from "@evenrealities/even_hub_sdk";
import { GlassAdapterImpl } from "../src/adapters/glassAdapter.js";

describe("GlassAdapter event mapping", () => {
  it("ignores audio-only events", () => {
    const adapter = new GlassAdapterImpl() as unknown as {
      mapEventToGesture: (event: unknown) => unknown;
    };

    const gesture = adapter.mapEventToGesture({
      audioEvent: {
        audioPcm: new Uint8Array([0, 1, 2, 3]),
      },
    });

    assert.equal(gesture, null);
  });

  it("maps undefined event type to TAP only when input payload exists", () => {
    const adapter = new GlassAdapterImpl() as unknown as {
      mapEventToGesture: (event: unknown) => unknown;
    };

    const gesture = adapter.mapEventToGesture({
      sysEvent: {
        eventType: undefined,
      },
    }) as { kind?: string } | null;

    assert.ok(gesture);
    assert.equal(gesture?.kind, "TAP");
  });

  it("maps scroll bottom to SCROLL_FWD", () => {
    const adapter = new GlassAdapterImpl() as unknown as {
      mapEventToGesture: (event: unknown) => unknown;
    };

    const gesture = adapter.mapEventToGesture({
      textEvent: {
        eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT,
      },
    }) as { kind?: string } | null;

    assert.ok(gesture);
    assert.equal(gesture?.kind, "SCROLL_FWD");
  });
});
