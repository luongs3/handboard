# Handboard — plan your morning with your hands

A hands-first WebXR planning board for Meta Quest, built with the Immersive Web SDK (IWSDK).
Five morning tasks are physical cards. Pinch one, carry it, let go over a column — the column it
lands in is its new state. No controller, no keyboard, no menus.

**Live (WebXR, open in the Quest browser):** https://luongs3.github.io/handboard/

## What it does
- Three lanes: **To do · Doing · Done**. Each header shows card count and minutes in that lane.
- **WIP limit:** Doing holds at most 2 cards. Drop a third and it snaps back — the board enforces focus.
- Done cards are struck through; state persists in `localStorage`, so tomorrow you resume where you left.
- Works with hand pinch (near or far via ray) and, optionally, controllers.

## Run
```bash
npm install
npm test          # board rules (4 tests)
npm run typecheck
npm run dev       # IWSDK dev server + emulator (IWER)
npm run build     # static build -> dist/ (deployed to GitHub Pages)
```

## How it is built
- `src/board-model.ts` — pure state: columns, WIP limit, persistence. Unit-tested in Node.
- `src/board.ts` — ECS system: creates lanes, headers, card meshes (`DistanceGrabbable` + `RayInteractable`),
  detects release (the `Grabbed` tag goes away) and files the card into the nearest lane.
- Scene composition in `public/scenes/main.iwsdk.scene.json`; panel in `public/ui/welcome.uikitml`.

MIT licensed.
