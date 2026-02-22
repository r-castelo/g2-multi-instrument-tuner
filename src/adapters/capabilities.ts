import type { PlatformCapabilities } from "../types/contracts";

export function detectPlatformCapabilities(
  win: Window | undefined = typeof window !== "undefined" ? window : undefined,
): PlatformCapabilities {
  const ua = win?.navigator?.userAgent ?? "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  const webMicAvailable = Boolean(
    win?.navigator?.mediaDevices &&
    typeof win.navigator.mediaDevices.getUserMedia === "function",
  );

  // Bridge audio is considered available when running inside Even host or simulator.
  // We verify at runtime when calling bridge.audioControl.
  const bridgeAudioAvailable = Boolean(win);

  return {
    bridgeAudioAvailable,
    webMicAvailable,
    audioContextNeedsUserResume: isIOS,
  };
}
