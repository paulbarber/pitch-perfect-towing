# Pitch Perfect Towing

A small browser game for practising towing a caravan or trailer with a car. You see the rig from above, steer with an on-screen wheel, and use live door mirrors and a windscreen view, just as you would when reversing onto a pitch or taking a tight farm-lane bend.

**Play it online: [paulbarber.github.io/pitch-perfect-towing](https://paulbarber.github.io/pitch-perfect-towing/)**

It is a single HTML file with no libraries or server. You can also download the repository and open `index.html` in any modern browser, on a phone or a computer.

## Features

- Eight levels: three reversing pitches, four forward bends of increasing tightness, and a lane-then-pitch finale
- Drag-to-turn steering wheel (1½ turns each way), D/R gears and a hold-to-drive GAS pedal
- Live left and right door mirrors and a windscreen view, each of which can be tapped to enlarge
- Guide lines that predict where the caravan will go, a hitch-angle meter and jackknife warning
- Bump markers that show exactly what hit what
- An **Auto** demo that drives each level the careful way, keeping as far from obstacles as the level allows, and explains the steering at each key point, with take-over at any moment
- Settings for right- or left-hand drive, wheel on the left or right of the screen, and a map-fixed or car-points-up overhead view
- Scoring for careful driving: a live **Gap** readout shows the room to the nearest hedge, post or van, and stars reward no bumps and keeping each level's target gap. Time only breaks ties. Best results are saved on the device

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Steer | Drag the wheel (double-tap to centre) | ← → (C to centre) |
| Drive / reverse | D / R buttons | D, or R to swap |
| Accelerate | Hold GAS | ↑, W or Space |

Tap **?** in the game for full help and settings.

## How the Auto demo works

The routes are planned for careful driving. For each level the solver finds the largest gap the car and caravan can keep from every hedge, post and van all the way to the target, then the cleanest route that keeps it. That gap also sets the level's star targets. Each level has its pre-solved route stored in `index.html` as a short list of moves: about 1 m in D or R, with the wheel heading for one of nine positions. The game replays the route through its own physics, so the demo is exact and starts instantly.

The routes are produced offline by the solver in `tools/demo-solver/`. It is a beam search over the same car-and-caravan model, guided by a distance map from the target. If you change a level's layout, regenerate its route:

```sh
cd tools/demo-solver
node optimise.js ../../index.html 3     # re-plan level 4 (levels are numbered from 0); writes routes/plans-3.json
node verify.js ../../index.html         # replays every stored route with collision checks
node inject.js ../../index.html         # writes the routes into the game
```

Requires Node.js 18 or later. Solving one level takes from a few seconds to a few minutes.

## Version

1.2

## Licence

Released under the [MIT License](LICENSE). © 2026 PR Barber.
