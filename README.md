# Pitch Perfect Towing

A small browser game for practising towing a caravan or trailer with a car. You see the rig from above, steer with an on-screen wheel, and use live door mirrors and a windscreen view, just as you would when reversing onto a pitch or taking a tight farm-lane bend.

**Play it online: [paulbarber.github.io/pitch-perfect-towing](https://paulbarber.github.io/pitch-perfect-towing/)**

It is a single HTML file with no libraries or server. Open `index.html` in any modern browser, on a phone or a computer. You can also download the repository and open `index.html` in any modern browser, on a phone or a computer.

## Features

- Eight levels: three reversing pitches, four forward bends of increasing tightness, and a lane-then-pitch finale
- Drag-to-turn steering wheel (1½ turns each way), D/R gears and a hold-to-drive GAS pedal
- Live left and right door mirrors and a windscreen view, each of which can be tapped to enlarge
- Guide lines that predict where the caravan will go, a hitch-angle meter and jackknife warning
- Bump markers that show exactly what hit what
- An **Auto** demo that drives each level and explains the steering at each key point, with take-over at any moment
- Settings for right- or left-hand drive, wheel on the left or right of the screen, and a map-fixed or car-points-up overhead view
- Stars and best times saved on the device

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Steer | Drag the wheel (double-tap to centre) | ← → (C to centre) |
| Drive / reverse | D / R buttons | D, or R to swap |
| Accelerate | Hold GAS | ↑, W or Space |

Tap **?** in the game for full help and settings.

## How the Auto demo works

Each level has a pre-solved route stored in `index.html` as a short list of moves: about 1 m in D or R, with the wheel heading for one of nine positions. The game replays the route through its own physics, so the demo is exact and starts instantly.

The routes are produced offline by the solver in `tools/demo-solver/`. It is a beam search over the same car-and-caravan model, guided by a distance map from the target. If you change a level's layout, regenerate its route:

```sh
cd tools/demo-solver
node offline.js ../../index.html 3      # re-solve level 4 (levels are numbered from 0); writes routes/plans-3.json
node verify.js ../../index.html         # replays every stored route with collision checks
node inject.js ../../index.html         # writes the routes into the game
```

Requires Node.js 18 or later. Solving one level takes from a few seconds to a few minutes.

## Version

1.1

## Licence

Released under the [MIT License](LICENSE). © 2026 PR Barber.
