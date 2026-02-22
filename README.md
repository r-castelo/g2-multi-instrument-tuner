# G2 Multi Tuner

Cross-platform (iPhone + Android) multi-instrument tuner for Even Realities G2 smart glasses.

## Scope

- Instruments: Guitar, Bass, Ukulele
- Tunings:
  - Guitar: Standard, Drop D, Open G, DADGAD
  - Bass: Standard 4-string (E1 A1 D2 G2)
  - Ukulele: Standard C6 (G4 C4 E4 A4)
- Controls:
  - Glasses: tap to open instrument/tuning menus
  - Phone: instrument/tuning controls, audio retry, live readout
- Audio strategy:
  - Bridge-first (`audioControl` + `audioEvent`)
  - Fallback to Web mic (`getUserMedia` + `AudioContext`)

## Development

```bash
npm install
npm run dev
npm run sim
```

In a second terminal:

```bash
npm run test
npm run build
```

Generate QR for phone device testing:

```bash
npm run qr
```

Package `.ehpk`:

```bash
npm run pack
```

## Project structure

- `src/adapters/glassAdapter.ts` - EvenHub SDK rendering + events
- `src/adapters/audioInputAdapter.ts` - bridge-first audio with web fallback
- `src/adapters/capabilities.ts` - iPhone/Android capability detection
- `src/app/controller.ts` - app state orchestration
- `src/app/state.ts` - mode and selection state machine
- `src/domain/pitch/*` - YIN pitch detection + smoothing
- `src/domain/music/*` - notes and tuning catalog
- `src/domain/tuner/*` - string targeting and glass view model
- `src/phone/phoneUI.ts` - phone companion UI bindings
- `tests/*` - unit tests and fallback wiring checks

## Known G2 considerations

- `createStartUpPageContainer()` is called once, then `rebuildPageContainer()` for mode changes.
- `textContainerUpgrade()` is used for live tuning updates.
- SDK click quirk is handled (`CLICK_EVENT` may deserialize as `undefined`).
- Event routing checks `listEvent`, `textEvent`, and `sysEvent`.

## Open Source

This project is open source.

## License

Licensed under the MIT License. See `LICENSE`.
