# Changelog

All notable changes to Mustang Showroom are documented in this file, following the [Keep a Changelog](https://keepachangelog.com/) format.

## [Unreleased]

### Added

- Selecting a part now turns the rest of the car into faint matte glass, with its chrome and clearcoat sparkle turned down, so the chosen part stands out wherever it sits, even deep in the engine bay or under the floor. Hovering another part shows it solid again, and deselecting restores the car.

### Changed

- Realism pass: the side walls now carry long lightboxes at belt height, with a cool rim light from the back wall, so the door and quarter skins show a broad highlight gradient instead of a flat tone; an ambient occlusion pass darkens the wheel wells, grille mouth and panel gaps on the two highest quality steps, and each tyre gets its own contact patch on the turntable.
- The body has the 1969 hip: the quarter panels swell outward over the rear wheels, fading in behind the door seam so the doors stay flush, and the fender line crowns over the headlights before dropping to the nose.
- The rear spoiler is a thin cambered blade with turned-up end plates on two swept pedestals instead of a full-width shelf.
- Chrome MUSTANG block letters on the tail panel and front fenders, MACH 1 lettering on the quarters, Sports Slats over the fastback glass, and amber turn indicators on the back of the hood scoop. The new pieces are selectable parts (Badges and lettering, Rear window slats) and explode with the rest of the trim.
- Raised white sidewall lettering is back on the low-profile tyres, and the wheels carry a deeper dish.
- The side profile follows the SportsRoof: the roof stays level over the whole door glass and the fastback falls from the B-pillar, so the quarter windows are small sloped-top panes under a wide sail panel. A satin-black Mach 1 side stripe runs low along the fenders, doors and quarters between the wheel openings, and the rocker sill now runs from arch to arch on the body's own curve instead of a box under the doors alone.
- The tail now follows the 1969 car: the quarter panels round into a recessed tail panel with a rolled lip, two three-lens taillight clusters sit on that face with a chrome bezel around each lens and cluster, the pop-open fuel cap sits between them, and the licence plate and round backup lights hang in the valance under the chrome bumper.
- The car's reflections now come from a photographer's studio dome, bright overhead and fading to a soft horizon band, so the paint carries a highlight line along the fender tops and a gradient down the doors instead of mirroring a black room. The default charcoal is a lighter gunmetal and metallic paints reflect more, so the body reads in the same tones as the real film car.
- Low-profile tyres on 17-inch polished five-spoke wheels in the Torq Thrust style replace the tall F60-15s and Magnum 500s, with a deep machined lip and gunmetal spokes, and the raised white sidewall letters are gone.
- Fuller, smoothly curved body panels, tighter seams and slimmer window trim replace the slab-like sides. The nose wraps around its headlights, the lower valance rolls underneath, and a fine recessed grille carries a small horse emblem.
- John Wick–inspired deep gunmetal paint, twin satin-black rally stripes, a compact black hood scoop and front/rear spoilers replace the plain grey finish. Softer fender shoulders and clearcoat reflections reduce the raised, wing-like look around the hood. Stripes follow their panels when opened or exploded.
- More realistic surface finishes: deeper clearcoat paint, softer chrome reflections, lightly tinted glass, textured rubber, cast metal, upholstery and woodgrain. Broad studio lights keep the body readable without the previous glare.
- Tires now have rounded sidewalls, shallower street tread, readable raised lettering and continuous sculpted wheel spokes. Wheel openings follow smooth curves instead of stepped mesh cut-outs, and the contact shadow follows the car's footprint.
- The car is lit by its own three-spot rig (key, fill and rim) so it reads brightly from every angle while the showroom around it stays dark, and a soft contact shadow grounds it on the turntable.
- The engine sounds like a V8: a solenoid clunk, a labouring starter crank, the catch with a burst of pops and an rpm flare that settles into a lumpy idle, a rev that climbs through the rev range, and a shutdown that winds down with two pops. The engine bay lurches while cranking, shudders on the catch and settles into its running rattle in time with the sound.
- Smoother edges: the render passes are multisampled.
- The engine now plays real V8 recordings: a crank-and-catch start, a seamless idle loop that pitch-shifts through the rev range, a throttle blip on each rev and a 1969 Mustang 302 layered on hard revs (credits under Controls in the About panel and in the README). The synthesised V8 stays as the fallback if the recordings fail to load.

### Fixed

- Zooming all the way out no longer turns the view black when orbiting toward the tail: the camera now stops short of the showroom walls in whichever direction it is backing up, instead of passing through the wall behind the car.
- The taillight lenses rendered as black squares because the cluster's backing plate sat in front of them; the backing is now a chrome reflector behind the lenses, so they read red even unlit. The rear frame rails also stopped poking through the valance beside the exhaust tips.
- From the Top view, the ceiling softbox's frame drew a solid black bar straight across the hood and cabin. The frame is now a flat outline that only shows its underside, like the light panel it surrounds.
- The hood scoop was a flat, knife-edged plate that seemed to float over the stripes. It now rises from the hood as a rounded dome that blends into the skin at the rear, with a full mouth at the front, and it and the hood pins sit on the crowned hood surface instead of the centreline height.
- Rear quarter windows now sit in real openings instead of over opaque bodywork.
- The air-cleaner seal now lies flat, and the radiator sits below the closed hood. Wheelhouse liners face outward so assembled wheel openings no longer expose the mechanical parts behind them.
- The display placard sits near the wall, keeping the showcase view clear on phones.
- The floor no longer mirrors the car's chrome edges as flickering scribbles in front of the turntable; the car is left out of the floor's reflection pass, and the contact shadow sits clear of the platform.
- The dark inner-fender panels behind the wheels stopped at the platform instead of the sill, so from a low angle they hung beneath the nose and tail and flickered as the turntable turned. They now end at the rocker line.
- The front valance's turn-signal cut-outs were open holes onto the suspension, which read as a dark shape jittering at the car's front corners as it turned. They now carry amber lenses in chrome bezels.
- On load the camera no longer dollies up from beneath the nose: the car is fitted to the bare viewport before the toolbars and panels report their size, and that first refit now snaps into place. The oil pan also no longer hangs below the valance line, so nothing dark shows under the front from a low angle.
- The radiator fan spun around the car's origin instead of its own hub, so while the engine cranked, caught or shut down (and for the first second after loading) the fan and belt drive whirled out through the front of the body as a dark shape at the front corners. It now turns in place on its hub, its speed follows the engine smoothly, and nothing shakes on load.

### Removed

- The start screen. The showroom loads straight in, and the keyboard reference now lives in the About panel under Controls.

## [1.0.0] - 2026-09-26

### Added

- A 1969 Ford Mustang SportsRoof on a turntable in a dark, polished showroom: physically based paint with clearcoat, real chrome and glass, a reflective floor, long soft light panels streaking along the bodywork, and bloom on the fixtures.
- Free orbit and zoom around the turntable, plus fixed camera views: showcase, front, rear three-quarter, side, rear, top, engine bay, interior and wheel.
- Eight paints to choose from, the film car's charcoal and seven genuine 1969 Ford colours, kept between visits.
- A hood, two doors and a trunk that open on their real hinges, individually or together.
- An explode slider that pulls every panel, trim piece, wheel, chassis component and engine part apart along its own path, staggered so the outer panels move first, with a whoosh and a reassembly click.
- A clickable parts catalogue: hover or click any part of the car to see its name, group, a description and its specs, and to fly the camera to it.
- Headlights and taillights that switch on, and an engine that starts with a starter crank and settles into a synthesised V8 idle, with a shake through the engine bay and a rev on demand.
- An About panel with the car's history: the 1969 restyle, the Mach 1, the Boss 429, the year's engine line-up, and the John Wick film car.
- Full keyboard control, and touch controls sized for phones.
- Synthesised sound effects throughout, with a mute toggle; everything is built in code, with no model or audio files.
- Deployed to GitHub Pages on every push to `main`.
