# Mustang Showroom

Mustang Showroom is a 1969 Ford Mustang SportsRoof — a Mach 1 dressed in the John Wick "Boss 429" look — standing under its own spotlights on a turntable in a dark, polished dealership at night. It opens straight into the showroom: orbit the car, change the paint, open the hood, doors and trunk, drag the explode slider to pull it apart into its parts, click any part to read about it while the rest of the car turns glass-clear around it, switch on the headlights, and start the engine. Play the [live demo](https://ronpicard.github.io/mustang-showroom/) — it works on both phones and desktops.

There is no game and no scoring: it is a car to look at and take apart.

## What you can do

- Orbit, pan-free, and zoom around the car on its turntable, or jump to fixed views (front, rear three-quarter, side, top, engine bay, interior, wheel).
- Change the paint between the film car's charcoal and seven genuine 1969 Ford colours.
- Inspect glossy clearcoat paint, lightly tinted glass, textured rubber and cabin materials, and low-profile street tires on polished five-spoke wheels. Broad studio fill lights show the body contours without washing out the chrome.
- Curved fender shoulders and rear quarters, close panel joints, recessed quad headlights and a fine metal grille give the body a more natural shape. Deep gunmetal charcoal, twin satin-black rally stripes, a compact black scoop and front/rear spoilers give it a John Wick–inspired finish. The stripes stay black across paint choices and move with their panels.
- Open the hood, both doors and the trunk, individually or all at once.
- Drag the explode slider to pull every panel, trim piece, wheel, chassis component and engine part apart along its own path, staggered so the outer panels move first.
- Click any part of the car — inside or out, open or exploded — to select it, fly the camera to it, and read its name, group, description and specs in the side panel.
- Switch the headlights and taillights on, and start the engine: a real V8's solenoid clunks and starter cranks, it catches and settles into a recorded, lumpy idle, shaking the engine bay as it does; hold Space to rev it (a recorded blip, with a 1969 Mustang 302 layered on hard revs) and it winds down with a couple of pops when you switch it off.
- Toggle the turntable's rotation and read the car's history in the About panel.

## Keyboard

| Key | Action |
| --- | --- |
| `1` | Camera: Showcase |
| `2` | Camera: Front |
| `3` | Camera: Rear ¾ |
| `4` | Camera: Side |
| `5` | Camera: Rear |
| `6` | Camera: Top |
| `7` | Camera: Engine |
| `8` | Camera: Interior |
| `9` | Camera: Wheel |
| `E` | Toggle explode (0 ↔ 100) |
| `H` | Toggle the hood |
| `D` | Toggle both doors |
| `T` | Toggle the trunk |
| `L` | Toggle the headlights |
| `S` | Start or stop the engine |
| `Space` (hold) | Rev the engine, while it is running |
| `R` | Toggle the turntable |
| `P` | Next paint |
| `M` | Mute |
| `?` or `I` | About |
| `Escape` | Close About, else deselect the part |

Keys are ignored while an input or select element has focus.

## The car

The showroom models a 1969 Ford Mustang SportsRoof (fastback) from its published dimensions: the body panels, quad headlights, three-bar taillights, 17-inch five-spoke wheels, the unibody floor and suspension underneath, a big-block V8 in the engine bay, and the dashboard, seats and console inside. Its charcoal paint, black rally stripes, scoop, hood pins and spoilers are inspired by the John Wick film car rather than a factory-correct Boss 429 restoration. Some mechanical detail is simplified (single representative parts stand in for full assemblies such as the exhaust or the front suspension) so the whole car stays light enough to explode and orbit smoothly.

## Tech stack

- React 19 and TypeScript (strict) for the toolbar, parts, info and about panels
- Plain three.js for the showroom, the car and every material: physically based paint with clearcoat, chrome, glass and a reflective floor, lit by long soft light panels and bloom on the fixtures
- The car is built in code, no 3D model: its geometry is generated from named dimensions. The engine plays four short field recordings (start, idle loop, two rev blips, see [Sound credits](#sound-credits)) pitch-shifted through Web Audio to follow an rpm model; if they fail to load, the same model drives a V8 synthesised at start-up as looping exhaust-pulse waveforms (a cross-plane firing order through two pipe resonators). The latch, explode and light sounds are synthesised
- Vite for building and development
- Node's built-in test runner (`node:test`), no separate test framework
- No backend — paint choice, mute and turntable settings live in `localStorage`
- GitHub Actions and GitHub Pages for continuous deployment

## Project layout

The car's data and maths are kept separate from rendering, so the parts catalogue, dimensions and explode/hinge maths can be unit tested without a browser or a canvas:

```text
src/car/     the parts catalogue, dimensions, paint rack, facts and the explode/hinge maths — framework-free, no three.js, no DOM
src/render/  the three.js engine and its public API, the car builders (body, trim, wheels, chassis, engine bay, interior), materials, assembly and the showroom
src/audio.ts the Web Audio engine (starter, catch, idle, rev and shutdown, from the recordings or the synthesised loops) and the latch, explode and light sounds
src/engineSound.ts offline synthesis of the fallback V8 loops and the starter, pure maths with unit tests
public/sounds/ the engine recordings, cut to a start clip, a seamless idle loop and two rev blips
src/ui/      React components for the toolbar, parts panel, info panel, about panel, and settings storage
src/App.tsx  application state and wiring; src/main.tsx is the entry point
```

## Development

Requires Node >= 22.12.

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server |
| `npm test` | Run the car data, dimensions, explode-maths, car-body, UI and engine-sound tests |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |

Add `?quality=high` or `?quality=low` to the address to pin the rendering cost; otherwise the engine steps it down by itself when frames stay slow.

## Deployment

The workflow in `.github/workflows/deploy.yml` runs on every push to `main`: it installs dependencies, runs the test suite, builds the production bundle, and publishes the `dist` output to GitHub Pages.

Vite is configured with a relative `base` in `vite.config.ts`, so the built asset paths resolve correctly whether the site is served from the domain root or from a repository subpath like `/mustang-showroom/`.

## Sound credits

The engine recordings under `public/sounds/` are cut from these Freesound clips:

- `engine-start.wav` (crank and catch) from [Studebaker V8 start](https://freesound.org/people/lonemonk/sounds/201988/) by lonemonk, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- `engine-idle.wav` and `engine-rev.wav` (idle loop and throttle blip) from [Chev 350 idle and revs](https://freesound.org/people/lonemonk/sounds/123685/) by lonemonk, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- `mustang-rev.wav` (hard-rev layer) from [1969 Mustang 302 rev](https://freesound.org/people/FlaxGod/sounds/653226/) by FlaxGod, [CC0](https://creativecommons.org/publicdomain/zero/1.0/)

Each was decoded from Freesound's preview encoding, trimmed, and written as mono 16-bit WAV; no other processing.

## License

[MIT](LICENSE)
