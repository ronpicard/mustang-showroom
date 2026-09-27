import type { HingedPartId, PartGroup, PartId, PartInfo, Vec3 } from './types.ts'
import {
  BELT_Y,
  BODY_HALF_WIDTH,
  DECK_Y,
  DOOR_FRONT_Z,
  HOOD_REAR_Y,
  HOOD_REAR_Z,
  TRUNK_FRONT_Z,
} from './dimensions.ts'

/**
 * The parts catalogue: every part the showroom can name, highlight, explode and describe.
 * Directions are in car space (see `types.ts`); `explode.distance` is inches at full explode.
 * Parts whose builder returns a left and a right object (`mirrored`) explode with the X
 * component of `direction` flipped for the left-hand object.
 */

const FRONT_THREE_QUARTER: Vec3 = [-0.66, 0.4, 0.64]
const REAR_THREE_QUARTER: Vec3 = [-0.66, 0.4, -0.64]
const FROM_ABOVE_FRONT: Vec3 = [-0.2, 0.85, 0.5]
const FROM_LOW_SIDE: Vec3 = [-0.92, -0.2, 0.33]
const FROM_LOW_REAR: Vec3 = [-0.6, -0.25, -0.75]

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2])
  return [v[0] / length, v[1] / length, v[2] / length]
}

interface PartDraft extends Omit<PartInfo, 'explode'> {
  explode: { direction: Vec3; distance: number; order: number }
}

const DRAFTS: readonly PartDraft[] = [
  // ---------------------------------------------------------------------------------------
  // Body
  // ---------------------------------------------------------------------------------------
  {
    id: 'hood',
    name: 'Hood',
    group: 'body',
    description:
      'The long hood is the defining line of the 1969 car, stretched almost four inches over the 1968 model. It hinges at the cowl and is held at the front by the latch and, on the Mach 1 and Boss cars, a pair of hood pins. Under it sits the engine bay, hemmed in by the shock towers that made the big-block engines such a tight fit.',
    specs: [
      { label: 'Length', value: '72 in' },
      { label: 'Hinge', value: 'Rear, at the cowl' },
      { label: 'Material', value: 'Stamped steel' },
    ],
    explode: { direction: [0, 1, 0.25], distance: 34, order: 0 },
    hinge: { pivot: [0, HOOD_REAR_Y, HOOD_REAR_Z], axis: [1, 0, 0], openAngle: -0.8 },
    focus: { direction: FROM_ABOVE_FRONT },
  },
  {
    id: 'roof',
    name: 'Roof',
    group: 'body',
    description:
      'The SportsRoof, the name Ford gave its fastback from 1969, carries the roofline in one unbroken sweep from the windshield header to the tail. The pillars are welded to the body shell and the roof is a single stamping; there is no vinyl top on a Mach 1.',
    specs: [
      { label: 'Height', value: '50.3 in overall' },
      { label: 'Style', value: 'SportsRoof fastback' },
    ],
    explode: { direction: [0, 1, 0], distance: 44, order: 0.1 },
    focus: { direction: [-0.5, 0.7, 0.5] },
  },
  {
    id: 'cowl',
    name: 'Cowl',
    group: 'body',
    description:
      'The cowl panel bridges the hood and the windshield. Its grille lets air into the heater plenum and the wiper pivots poke through it. Because it doubles as a rain gutter, it is also where fifty-year-old Mustangs rust first.',
    specs: [{ label: 'Carries', value: 'Wiper pivots, fresh-air intake' }],
    explode: { direction: [0, 1, 0], distance: 14, order: 0.15 },
    focus: { direction: FROM_ABOVE_FRONT },
  },
  {
    id: 'fenderLeft',
    name: 'Front fender, driver side',
    group: 'body',
    description:
      'The front fenders bolt to the inner structure, so they were made to be replaced. The 1969 fender carries the outer headlight in its tip and the sharp crease along its top that frames the hood. A Mach 1 wears its reflective side stripe and name along the lower edge.',
    specs: [
      { label: 'Fixing', value: 'Bolted' },
      { label: 'Carries', value: 'Outer headlight' },
    ],
    explode: { direction: [-1, 0.35, 0.3], distance: 26, order: 0.2 },
    focus: { direction: FRONT_THREE_QUARTER },
  },
  {
    id: 'fenderRight',
    name: 'Front fender, passenger side',
    group: 'body',
    description:
      'The passenger-side twin of the driver fender, with its own outer headlight, crease line and Mach 1 stripe. Both fenders were the first panels swapped after a shunt, which is why so few survivors wear their originals.',
    specs: [
      { label: 'Fixing', value: 'Bolted' },
      { label: 'Carries', value: 'Outer headlight' },
    ],
    explode: { direction: [1, 0.35, 0.3], distance: 26, order: 0.2 },
    focus: { direction: [0.66, 0.4, 0.64] },
  },
  {
    id: 'doorLeft',
    name: 'Door, driver side',
    group: 'body',
    description:
      "The Mustang's doors are long, as a two-door coupe's must be, and hinge at the A-pillar. Inside are the frameless door glass and its winder mechanism; outside, the flush push-button handle and the racing mirror. The driver's door also carries the lock and, on a Mach 1, a courtesy lamp in its trim panel.",
    specs: [
      { label: 'Length', value: '41 in' },
      { label: 'Hinge', value: 'Front, at the A-pillar' },
      { label: 'Glass', value: 'Frameless, wind-down' },
    ],
    explode: { direction: [-1, 0.2, 0], distance: 32, order: 0.25 },
    hinge: {
      pivot: [-BODY_HALF_WIDTH + 1, (BELT_Y + 12) / 2, DOOR_FRONT_Z],
      axis: [0, 1, 0],
      openAngle: 1.0,
    },
    focus: { direction: [-0.9, 0.3, 0.3] },
  },
  {
    id: 'doorRight',
    name: 'Door, passenger side',
    group: 'body',
    description:
      'The passenger door mirrors the driver door: hinged at the front, frameless glass, and a push-button handle. With both doors open you can see how thin the B-pillar is on the fastback; the door glass and the quarter glass nearly meet.',
    specs: [
      { label: 'Length', value: '41 in' },
      { label: 'Hinge', value: 'Front, at the A-pillar' },
      { label: 'Glass', value: 'Frameless, wind-down' },
    ],
    explode: { direction: [1, 0.2, 0], distance: 32, order: 0.25 },
    hinge: {
      pivot: [BODY_HALF_WIDTH - 1, (BELT_Y + 12) / 2, DOOR_FRONT_Z],
      axis: [0, 1, 0],
      openAngle: -1.0,
    },
    focus: { direction: [0.9, 0.3, 0.3] },
  },
  {
    id: 'quarterLeft',
    name: 'Quarter panel, driver side',
    group: 'body',
    description:
      'The rear quarter panels are welded into the body shell and carry the kick-up behind the door that the 1969 restyle exaggerated. On the SportsRoof the quarter rises into the C-pillar and the small quarter window. The Mach 1 adds a simulated scoop just behind the door.',
    specs: [
      { label: 'Fixing', value: 'Welded' },
      { label: 'Carries', value: 'Quarter scoop, quarter glass' },
    ],
    explode: { direction: [-1, 0.3, -0.2], distance: 26, order: 0.3 },
    focus: { direction: REAR_THREE_QUARTER },
  },
  {
    id: 'quarterRight',
    name: 'Quarter panel, passenger side',
    group: 'body',
    description:
      'The passenger-side quarter panel, welded to the shell like its twin, with the kick-up, the C-pillar and the simulated scoop. Behind it, inside the trunk, is the fuel filler that feeds the tank under the trunk floor.',
    specs: [
      { label: 'Fixing', value: 'Welded' },
      { label: 'Carries', value: 'Quarter scoop, quarter glass' },
    ],
    explode: { direction: [1, 0.3, -0.2], distance: 26, order: 0.3 },
    focus: { direction: [0.66, 0.4, -0.64] },
  },
  {
    id: 'trunkLid',
    name: 'Trunk lid',
    group: 'body',
    description:
      'The deck lid on the SportsRoof is short, squeezed between the base of the fastback glass and the tail panel, and it lifts on torsion-bar hinges. Its rear edge kicks up slightly, the ducktail that a Mach 1 could top with an optional rear spoiler.',
    specs: [
      { label: 'Hinge', value: 'Front edge, torsion bars' },
      { label: 'Option', value: 'Rear deck spoiler' },
    ],
    explode: { direction: [0, 1, -0.3], distance: 30, order: 0.1 },
    hinge: { pivot: [0, DECK_Y, TRUNK_FRONT_Z], axis: [1, 0, 0], openAngle: 0.9 },
    focus: { direction: [-0.4, 0.7, -0.6] },
  },
  {
    id: 'rearPanel',
    name: 'Tail panel',
    group: 'body',
    description:
      'The tail panel is recessed between the quarter panels and holds the three-bar taillights that every Mustang has worn since 1964. The fuel filler sits in its centre; the Mach 1 covered it with a chrome pop-open cap. Below it hangs the rear valance and the bumper.',
    specs: [
      { label: 'Carries', value: 'Taillights, fuel cap' },
      { label: 'Finish', value: 'Body colour (black-out on Mach 1)' },
    ],
    explode: { direction: [0, 0.2, -1], distance: 24, order: 0.35 },
    focus: { direction: [0, 0.3, -1] },
  },
  {
    id: 'frontValance',
    name: 'Front valance',
    group: 'body',
    description:
      'The valance is the panel below the front bumper, carrying the turn signals and closing the gap under the grille. It is a separate bolt-on piece so that a low kerb does not cost you a fender.',
    specs: [{ label: 'Carries', value: 'Turn signals' }],
    explode: { direction: [0, -0.2, 1], distance: 22, order: 0.35 },
    focus: { direction: [-0.4, -0.1, 0.9] },
  },
  {
    id: 'rearValance',
    name: 'Rear valance',
    group: 'body',
    description:
      'The rear valance closes the body below the rear bumper. The Mach 1 and Boss cars had it cut for the twin exhaust tips of the dual-exhaust option, the tell-tale of a big engine from behind.',
    specs: [{ label: 'Carries', value: 'Exhaust tip cut-outs' }],
    explode: { direction: [0, -0.2, -1], distance: 22, order: 0.35 },
    focus: { direction: FROM_LOW_REAR },
  },

  // ---------------------------------------------------------------------------------------
  // Exterior trim
  // ---------------------------------------------------------------------------------------
  {
    id: 'grille',
    name: 'Grille',
    group: 'exterior',
    description:
      'The 1969 grille is a black honeycomb-style mesh set deep in the nose, with the running horse emblem off-centre on the driver side. The inner headlights sit inside it, which is what gives the 1969 car its unmistakable four-eyed face.',
    specs: [
      { label: 'Finish', value: 'Black-out, chrome surround' },
      { label: 'Emblem', value: 'Running horse, offset' },
    ],
    explode: { direction: [0, 0, 1], distance: 30, order: 0.4 },
    focus: { direction: [0, 0.15, 1] },
  },
  {
    id: 'headlights',
    name: 'Headlights',
    group: 'exterior',
    description:
      'Quad sealed-beam headlights, a one-year feature: the outer pair is set into the fender tips and the inner pair into the grille. Ford dropped the inner lights for 1970. All four are 5¾-inch sealed beams, high beams on the inner pair.',
    specs: [
      { label: 'Type', value: '5¾ in sealed beam, four' },
      { label: 'Years', value: '1969 only' },
    ],
    explode: { direction: [0, 0, 1], distance: 38, order: 0.45 },
    focus: { direction: [-0.3, 0.1, 0.95] },
  },
  {
    id: 'taillights',
    name: 'Taillights',
    group: 'exterior',
    description:
      'Three vertical lenses a side, the Mustang signature. The 1969 lenses sit in the recessed tail panel, each in its own chrome bezel inside a chrome cluster frame. Ford used sequential turn signals on the Cougar and Thunderbird; on the Mustang, all three bars flash together.',
    specs: [
      { label: 'Type', value: 'Three-bar, each side' },
      { label: 'Bezel', value: 'Chrome' },
    ],
    explode: { direction: [0, 0, -1], distance: 30, order: 0.45 },
    focus: { direction: [-0.3, 0.2, -0.95] },
  },
  {
    id: 'frontBumper',
    name: 'Front bumper',
    group: 'exterior',
    description:
      'A chromed steel blade that wraps the corners of the nose, with the licence plate mounted at its centre. Chrome bumpers were standard on every 1969 Mustang; the body-colour urethane bumpers came with the 1971 restyle.',
    specs: [
      { label: 'Material', value: 'Chrome-plated steel' },
      { label: 'Height', value: '3 in' },
    ],
    explode: { direction: [0, -0.1, 1], distance: 46, order: 0.5 },
    focus: { direction: [-0.4, 0, 0.9] },
  },
  {
    id: 'rearBumper',
    name: 'Rear bumper',
    group: 'exterior',
    description:
      'The rear bumper is a shallower chrome blade than the front, following the tail panel and wrapping around the rounded quarter ends. The licence plate and the round backup lights hang in the valance below it.',
    specs: [
      { label: 'Material', value: 'Chrome-plated steel' },
      { label: 'Height', value: '3 in' },
    ],
    explode: { direction: [0, -0.1, -1], distance: 40, order: 0.5 },
    focus: { direction: FROM_LOW_REAR },
  },
  {
    id: 'hoodScoop',
    name: 'Hood scoop',
    group: 'exterior',
    description:
      'This compact satin-black scoop follows the film-inspired styling of the showroom rather than reproducing a factory Boss 429 scoop. Its tapered shell and recessed mouth sit low over the air cleaner.',
    specs: [
      { label: 'Style', value: 'Film-inspired, satin black' },
      { label: 'Width', value: '17 in (model)' },
    ],
    explode: { direction: [0, 1, 0.2], distance: 48, order: 0.05 },
    focus: { direction: FROM_ABOVE_FRONT },
  },
  {
    id: 'hoodPins',
    name: 'Hood pins',
    group: 'exterior',
    description:
      'Twist-lock hood pins with cable-tethered clips at the hood\'s front corners, standard on the Mach 1 and the Boss cars. They keep the long hood from lifting at speed even if the latch lets go.',
    specs: [
      { label: 'Type', value: 'NASCAR-style, tethered' },
      { label: 'Standard on', value: 'Mach 1, Boss 302, Boss 429' },
    ],
    explode: { direction: [0, 1, 0.2], distance: 42, order: 0.05 },
    focus: { direction: FROM_ABOVE_FRONT, distanceFactor: 3 },
  },
  {
    id: 'sideScoops',
    name: 'Quarter scoops',
    group: 'exterior',
    description:
      'The Mach 1 carries a simulated scoop on each quarter panel behind the door, a body-colour blister that recalls the brake-cooling scoops of the 1965 Shelby GT350. It leads nowhere.',
    specs: [
      { label: 'Function', value: 'Decorative' },
      { label: 'Standard on', value: 'Mach 1' },
    ],
    explode: { direction: [1, 0.6, 0], distance: 18, order: 0.3 },
    focus: { direction: [-0.85, 0.3, -0.4], distanceFactor: 3 },
  },
  {
    id: 'badges',
    name: 'Badges and lettering',
    group: 'exterior',
    description:
      'Chrome MUSTANG block letters run the width of the tail panel and repeat, smaller, along each front fender just above the side stripe. MACH 1 lettering sits on the quarters near the tail, announcing the trim level to anyone behind the car.',
    specs: [
      { label: 'Material', value: 'Chrome-plated' },
      { label: 'Location', value: 'Tail panel, fenders, quarters' },
    ],
    explode: { direction: [0, 1, -0.3], distance: 20, order: 0.3 },
    focus: { direction: FROM_LOW_REAR, distanceFactor: 3 },
  },
  {
    id: 'rearLouvers',
    name: 'Rear window slats',
    group: 'exterior',
    description:
      'The SportSlats louvre was a period dealer-installed option that clipped over the fastback\'s sloped backlight, shading the rear seat from the sun. Eight satin-black slats stand just proud of the glass, angled open to admit light while blocking a straight-on view.',
    specs: [
      { label: 'Type', value: 'Bolt-on, satin black' },
      { label: 'Option', value: 'SportSlats dealer accessory' },
    ],
    explode: { direction: [0, 0.7, -0.7], distance: 24, order: 0.15 },
    focus: { direction: [-0.4, 0.6, -0.7] },
  },
  {
    id: 'mirrors',
    name: 'Racing mirrors',
    group: 'exterior',
    description:
      'Dual colour-keyed racing mirrors, bullet-shaped, one on each door. They were standard on the Mach 1, and the driver-side one adjusts by remote cable from inside the car.',
    specs: [
      { label: 'Type', value: 'Dual, colour-keyed' },
      { label: 'Adjustment', value: 'Remote cable (driver side)' },
    ],
    explode: { direction: [1, 0.5, 0], distance: 20, order: 0.3 },
    focus: { direction: [-0.8, 0.35, 0.5], distanceFactor: 3 },
  },
  {
    id: 'doorHandles',
    name: 'Door handles',
    group: 'exterior',
    description:
      'Chrome push-button handles: you pull the handle and press the button with your thumb. Every Mustang used this design from 1964 until the 1971 cars switched to a flush pull.',
    specs: [{ label: 'Type', value: 'Chrome, push-button' }],
    explode: { direction: [1, 0, 0], distance: 16, order: 0.35 },
    focus: { direction: [-0.9, 0.3, 0.3], distanceFactor: 3 },
  },
  {
    id: 'fuelCap',
    name: 'Fuel cap',
    group: 'exterior',
    description:
      'The Mach 1 covered its filler with a chrome pop-open cap in the centre of the tail panel, flipped up with a thumb. Lesser 1969 Mustangs had a plain twist cap with the running horse emblem.',
    specs: [
      { label: 'Type', value: 'Pop-open, chrome' },
      { label: 'Standard on', value: 'Mach 1' },
    ],
    explode: { direction: [0, 0, -1], distance: 20, order: 0.5 },
    focus: { direction: [-0.2, 0.2, -0.95], distanceFactor: 3 },
  },
  {
    id: 'exhaustTips',
    name: 'Exhaust tips',
    group: 'exterior',
    description:
      'Twin chrome tips through the rear valance, the visible end of the dual exhaust that came with every 390, 428 and Boss engine. A base Mach 1 with the 351 two-barrel had a single pipe and a plain valance.',
    specs: [
      { label: 'Type', value: 'Dual, chrome' },
      { label: 'Diameter', value: '2½ in' },
    ],
    explode: { direction: [0, -0.3, -1], distance: 24, order: 0.55 },
    focus: { direction: FROM_LOW_REAR, distanceFactor: 3 },
  },
  {
    id: 'wipers',
    name: 'Wipers',
    group: 'exterior',
    description:
      'Two-speed electric wipers with a washer were standard for 1969. Their pivots come through the cowl grille and the arms park along the base of the windshield.',
    specs: [{ label: 'Type', value: 'Two-speed electric, washer' }],
    explode: { direction: [0, 1, 0], distance: 20, order: 0.2 },
    focus: { direction: FROM_ABOVE_FRONT, distanceFactor: 3 },
  },

  // ---------------------------------------------------------------------------------------
  // Glass
  // ---------------------------------------------------------------------------------------
  {
    id: 'windshield',
    name: 'Windshield',
    group: 'glass',
    description:
      'Laminated safety glass, raked more steeply for 1969 than on earlier cars. Tinted glass was an option; the Mach 1 brochure car had it. It is bonded and clipped into the pinch-weld and finished with a chrome moulding.',
    specs: [
      { label: 'Type', value: 'Laminated, tint optional' },
      { label: 'Trim', value: 'Chrome moulding' },
    ],
    explode: { direction: [0, 0.7, 0.7], distance: 40, order: 0.15 },
    focus: { direction: [-0.4, 0.6, 0.7] },
  },
  {
    id: 'rearGlass',
    name: 'Rear glass',
    group: 'glass',
    description:
      'The great sloping backlight is what makes a fastback. It is tempered glass, almost flat and nearly horizontal, which is why Ford offered SportSlats, the louvered sun shade, to keep the rear seat from cooking.',
    specs: [
      { label: 'Type', value: 'Tempered' },
      { label: 'Option', value: 'SportSlats louvers' },
    ],
    explode: { direction: [0, 0.7, -0.7], distance: 40, order: 0.15 },
    focus: { direction: [-0.4, 0.6, -0.7] },
  },
  {
    id: 'doorGlass',
    name: 'Door glass',
    group: 'glass',
    description:
      'Frameless, curved door glass that winds fully into the door. With the window down and the quarter glass open, the fastback is a pillarless side from front to back, which is what the hardtop lacks.',
    specs: [{ label: 'Type', value: 'Tempered, frameless' }],
    explode: { direction: [1, 0.6, 0], distance: 34, order: 0.2 },
    focus: { direction: [-0.9, 0.3, 0.2] },
  },
  {
    id: 'quarterGlass',
    name: 'Quarter glass',
    group: 'glass',
    description:
      'Small fixed panes in the C-pillars behind the doors, the last echo of the vents that earlier fastbacks had there. For 1969 they are fixed, without the pivoting frames of the 1967 and 1968 cars.',
    specs: [{ label: 'Type', value: 'Tempered, fixed' }],
    explode: { direction: [1, 0.7, 0], distance: 30, order: 0.2 },
    focus: { direction: [-0.85, 0.4, -0.35], distanceFactor: 3 },
  },

  // ---------------------------------------------------------------------------------------
  // Wheels
  // ---------------------------------------------------------------------------------------
  {
    id: 'wheelFrontLeft',
    name: 'Front wheel, driver side',
    group: 'wheels',
    description:
      'A 17 x 8 polished five-spoke wheel in the American Racing Torq Thrust style: a deep machined lip around a gunmetal dish, with a small polished centre cap. Wrapped in a low-profile 245/45R17 tyre with a plain black sidewall.',
    specs: [
      { label: 'Wheel', value: '17 x 8 polished five-spoke' },
      { label: 'Tyre', value: '245/45R17' },
      { label: 'Diameter', value: '26 in' },
    ],
    explode: { direction: [-1, 0, 0], distance: 30, order: 0.4 },
    focus: { direction: [-1, 0.15, 0.25], distanceFactor: 2.6 },
  },
  {
    id: 'wheelFrontRight',
    name: 'Front wheel, passenger side',
    group: 'wheels',
    description:
      'The passenger-side front wheel: a 17 x 8 polished five-spoke wheel with a 245/45R17 tyre. The front wheels are steered through the tie rods and carry the disc brakes; the Mach 1 with a big-block got power front discs as standard.',
    specs: [
      { label: 'Wheel', value: '17 x 8 polished five-spoke' },
      { label: 'Tyre', value: '245/45R17' },
    ],
    explode: { direction: [1, 0, 0], distance: 30, order: 0.4 },
    focus: { direction: [1, 0.15, 0.25], distanceFactor: 2.6 },
  },
  {
    id: 'wheelRearLeft',
    name: 'Rear wheel, driver side',
    group: 'wheels',
    description:
      'The rear wheels are driven through the live axle and stop with drum brakes. On the Boss 429, the rear wheel arches were flared to clear the wider F60 tyres; the film car keeps the stock arches.',
    specs: [
      { label: 'Wheel', value: '17 x 8 polished five-spoke' },
      { label: 'Tyre', value: '245/45R17' },
    ],
    explode: { direction: [-1, 0, 0], distance: 30, order: 0.4 },
    focus: { direction: [-1, 0.15, -0.25], distanceFactor: 2.6 },
  },
  {
    id: 'wheelRearRight',
    name: 'Rear wheel, passenger side',
    group: 'wheels',
    description:
      'The passenger-side rear wheel, driven and drum-braked like its twin. The 17-inch wheel leaves room to see the drum and the axle flange behind the spokes.',
    specs: [
      { label: 'Wheel', value: '17 x 8 polished five-spoke' },
      { label: 'Tyre', value: '245/45R17' },
    ],
    explode: { direction: [1, 0, 0], distance: 30, order: 0.4 },
    focus: { direction: [1, 0.15, -0.25], distanceFactor: 2.6 },
  },
  {
    id: 'frontBrakes',
    name: 'Front disc brakes',
    group: 'wheels',
    description:
      'Power-assisted front disc brakes were standard with the 428 and Boss engines and optional elsewhere: an 11.3-inch ventilated rotor and a four-piston Kelsey-Hayes caliper behind each front wheel. Base cars made do with drums all round.',
    specs: [
      { label: 'Rotor', value: '11.3 in, ventilated' },
      { label: 'Caliper', value: 'Kelsey-Hayes, four-piston' },
    ],
    explode: { direction: [1, 0, 0], distance: 18, order: 0.5 },
    focus: { direction: [-1, 0.1, 0.3], distanceFactor: 2.6 },
  },
  {
    id: 'rearBrakes',
    name: 'Rear drum brakes',
    group: 'wheels',
    description:
      'Ten-inch drums at the rear, with the parking brake working on the same shoes. Rear discs did not reach the Mustang until the 1990s, so even a Boss 429 stopped its back wheels with drums.',
    specs: [
      { label: 'Drum', value: '10 in' },
      { label: 'Parking brake', value: 'Cable, on the rear shoes' },
    ],
    explode: { direction: [1, 0, 0], distance: 18, order: 0.5 },
    focus: { direction: [-1, 0.1, -0.3], distanceFactor: 2.6 },
  },

  // ---------------------------------------------------------------------------------------
  // Chassis
  // ---------------------------------------------------------------------------------------
  {
    id: 'floorPan',
    name: 'Floor pan',
    group: 'chassis',
    description:
      'The Mustang has no separate frame: the floor pan, rockers, firewall and inner fenders are welded into one unibody shell that the engine, suspension and panels hang from. The transmission tunnel down the middle and the torque boxes at the corners give it its stiffness.',
    specs: [
      { label: 'Construction', value: 'Unibody, welded steel' },
      { label: 'Ground clearance', value: '6 in' },
    ],
    explode: { direction: [0, -1, 0], distance: 12, order: 0.6 },
    focus: { direction: FROM_LOW_SIDE },
  },
  {
    id: 'frontSuspension',
    name: 'Front suspension',
    group: 'chassis',
    description:
      'Unequal-length upper and lower control arms with the coil spring mounted above the upper arm, inside the tall shock tower. It is the layout of the 1960 Falcon the Mustang grew from, and the towers are why the big-block engines barely fit. The Mach 1 got the stiffer competition suspension with a thicker anti-roll bar.',
    specs: [
      { label: 'Type', value: 'Double wishbone, coil over upper arm' },
      { label: 'Anti-roll bar', value: '0.85 in (competition)' },
    ],
    explode: { direction: [0, -1, 0.2], distance: 22, order: 0.65 },
    focus: { direction: FROM_LOW_SIDE },
  },
  {
    id: 'steering',
    name: 'Steering',
    group: 'chassis',
    description:
      'Recirculating-ball steering with a parallelogram linkage: a pitman arm, a centre link, an idler and two tie rods. Power assist was an option and came with a quicker ratio; the manual box needed nearly five turns lock to lock.',
    specs: [
      { label: 'Type', value: 'Recirculating ball' },
      { label: 'Ratio', value: '16:1 power, 21:1 manual' },
    ],
    explode: { direction: [0, -1, 0], distance: 16, order: 0.7 },
    focus: { direction: FROM_LOW_SIDE },
  },
  {
    id: 'rearAxle',
    name: 'Rear axle',
    group: 'chassis',
    description:
      'A live rear axle: the Ford 9-inch, the strongest passenger-car axle of its day, with a removable centre section. Big-block cars got it with 3.25:1 or 3.50:1 gears and the Traction-Lok limited-slip differential; the Super Cobra Jet added 3.91 or 4.30 gears and an oil cooler.',
    specs: [
      { label: 'Type', value: 'Ford 9 in, live' },
      { label: 'Ratio', value: '3.25 to 4.30:1' },
      { label: 'Option', value: 'Traction-Lok limited slip' },
    ],
    explode: { direction: [0, -1, -0.2], distance: 20, order: 0.65 },
    focus: { direction: [-0.8, -0.2, -0.55] },
  },
  {
    id: 'leafSprings',
    name: 'Leaf springs',
    group: 'chassis',
    description:
      'The rear axle rides on a pair of semi-elliptic multi-leaf springs, the simplest suspension there is. The competition suspension stiffened them and added staggered rear shocks, one ahead of the axle and one behind, to stop the axle hopping under hard acceleration.',
    specs: [
      { label: 'Type', value: 'Semi-elliptic, four leaves' },
      { label: 'Shocks', value: 'Staggered (competition suspension)' },
    ],
    explode: { direction: [0, -1, 0], distance: 30, order: 0.7 },
    focus: { direction: [-0.8, -0.2, -0.55] },
  },
  {
    id: 'driveshaft',
    name: 'Driveshaft',
    group: 'chassis',
    description:
      'A single steel tube with a universal joint at each end, carrying torque from the transmission tailshaft to the differential. It runs in the transmission tunnel that divides the floor and the front seats.',
    specs: [
      { label: 'Type', value: 'One-piece, two universal joints' },
      { label: 'Diameter', value: '3 in' },
    ],
    explode: { direction: [0, -1, 0], distance: 26, order: 0.7 },
    focus: { direction: FROM_LOW_SIDE },
  },
  {
    id: 'exhaustSystem',
    name: 'Exhaust',
    group: 'chassis',
    description:
      'Dual exhaust from the headers back: two pipes, two mufflers under the rear seat, and two tailpipes out through the valance. The big-block sound of the film car comes from this, and from 429 cubic inches breathing through it.',
    specs: [
      { label: 'Type', value: 'Dual, 2¼ in pipes' },
      { label: 'Mufflers', value: 'Two, transverse-free' },
    ],
    explode: { direction: [0, -1, 0], distance: 36, order: 0.75 },
    focus: { direction: FROM_LOW_SIDE },
  },
  {
    id: 'fuelTank',
    name: 'Fuel tank',
    group: 'chassis',
    description:
      "A 20-gallon steel tank bolted under the trunk floor, filled through the tail panel. The tank's top face is the trunk floor itself, a cost-saving that the 1970s safety debates made notorious.",
    specs: [
      { label: 'Capacity', value: '20 US gal' },
      { label: 'Location', value: 'Under the trunk floor' },
    ],
    explode: { direction: [0, -1, -0.3], distance: 24, order: 0.7 },
    focus: { direction: FROM_LOW_REAR },
  },

  // ---------------------------------------------------------------------------------------
  // Engine bay
  // ---------------------------------------------------------------------------------------
  {
    id: 'engineBlock',
    name: 'Engine block',
    group: 'engine',
    description:
      'The Boss 429: a 429-cubic-inch (7.0-litre) big-block V8 built so Ford could run it in NASCAR, which required 500 sold in road cars. Cast iron, with four-bolt main bearing caps and a forged crankshaft. Ford rated it at 375 horsepower, a number nobody believed; the real figure was nearer 500.',
    specs: [
      { label: 'Displacement', value: '429 cu in (7.0 L)' },
      { label: 'Bore × stroke', value: '4.36 × 3.59 in' },
      { label: 'Power', value: '375 hp at 5,200 rpm (advertised)' },
      { label: 'Torque', value: '450 lb-ft at 3,400 rpm' },
    ],
    explode: { direction: [0, 1, 0], distance: 16, order: 0.55 },
    focus: { direction: FROM_ABOVE_FRONT },
  },
  {
    id: 'cylinderHeads',
    name: 'Cylinder heads',
    group: 'engine',
    description:
      'Aluminium heads with crescent-shaped combustion chambers, the "semi-hemi" that gave the engine its breathing. The heads seal to the block with O-rings instead of gaskets, and the huge valves need the cast valve covers you see on top. This is the part that made the Boss 429 special.',
    specs: [
      { label: 'Material', value: 'Aluminium' },
      { label: 'Chambers', value: 'Crescent, "semi-hemi"' },
      { label: 'Valves', value: '2.28 in intake, 1.90 in exhaust' },
    ],
    explode: { direction: [0, 1, 0], distance: 30, order: 0.5 },
    focus: { direction: FROM_ABOVE_FRONT },
  },
  {
    id: 'intakeManifold',
    name: 'Intake manifold',
    group: 'engine',
    description:
      'An aluminium dual-plane intake in the valley between the heads, feeding eight ports from one four-barrel carburettor. The production intake was mild for the sake of street manners; the race teams threw it away.',
    specs: [
      { label: 'Material', value: 'Aluminium' },
      { label: 'Type', value: 'Dual-plane, four-barrel' },
    ],
    explode: { direction: [0, 1, 0], distance: 44, order: 0.45 },
    focus: { direction: FROM_ABOVE_FRONT },
  },
  {
    id: 'carburetor',
    name: 'Carburettor',
    group: 'engine',
    description:
      'A single Holley 735-cfm four-barrel carburettor: two primary throats for cruising and two secondaries that open under full throttle. There is no fuel injection and no computer; the mixture is set with a screwdriver.',
    specs: [
      { label: 'Type', value: 'Holley four-barrel' },
      { label: 'Flow', value: '735 cfm' },
    ],
    explode: { direction: [0, 1, 0], distance: 56, order: 0.42 },
    focus: { direction: FROM_ABOVE_FRONT, distanceFactor: 3 },
  },
  {
    id: 'airCleaner',
    name: 'Air cleaner',
    group: 'engine',
    description:
      'A round air cleaner on top of the carburettor, sealed to the underside of the hood scoop so the engine breathes cold air from outside instead of hot air from the engine bay. The Mach 1 Shaker option did the same trick by poking the cleaner through the hood.',
    specs: [
      { label: 'Diameter', value: '14 in' },
      { label: 'Intake', value: 'Sealed to the hood scoop' },
    ],
    explode: { direction: [0, 1, 0], distance: 70, order: 0.38 },
    focus: { direction: FROM_ABOVE_FRONT, distanceFactor: 3 },
  },
  {
    id: 'headers',
    name: 'Exhaust manifolds',
    group: 'engine',
    description:
      'Cast-iron exhaust manifolds, one per bank, collecting the four exhaust ports into the down-pipes. Tube headers were the first thing owners bolted on; the factory manifolds were shaped to clear the shock towers, not to make power.',
    specs: [
      { label: 'Material', value: 'Cast iron' },
      { label: 'Outlet', value: '2¼ in' },
    ],
    explode: { direction: [1, -0.2, 0], distance: 18, order: 0.55 },
    focus: { direction: [-0.9, 0.3, 0.4] },
  },
  {
    id: 'radiator',
    name: 'Radiator',
    group: 'engine',
    description:
      'A copper-and-brass down-flow radiator in front of the engine, behind the grille. Big-block cars got the heavy-duty core and a fan shroud, and even so the Boss 429 ran hot in traffic; it was an engine built for the superspeedway.',
    specs: [
      { label: 'Core', value: 'Copper-brass, heavy duty' },
      { label: 'Coolant', value: '20 quarts' },
    ],
    explode: { direction: [0, 0.3, 1], distance: 30, order: 0.5 },
    focus: { direction: FROM_ABOVE_FRONT },
  },
  {
    id: 'fan',
    name: 'Cooling fan',
    group: 'engine',
    description:
      'A belt-driven, engine-mounted fan behind the radiator, pulling air through the core when the car is not moving fast enough to do it by itself. A viscous fan clutch lets it freewheel at speed.',
    specs: [
      { label: 'Type', value: 'Belt-driven, viscous clutch' },
      { label: 'Diameter', value: '18 in' },
    ],
    explode: { direction: [0, 0.3, 1], distance: 18, order: 0.52 },
    focus: { direction: FROM_ABOVE_FRONT, distanceFactor: 3 },
  },
  {
    id: 'alternator',
    name: 'Alternator',
    group: 'engine',
    description:
      'A belt-driven alternator on the driver side of the engine keeps the battery charged and the lights lit. Ford had switched from generators to alternators for 1965, one of the reasons a Mustang could idle in traffic without going flat.',
    specs: [
      { label: 'Output', value: '42 amp (55 with air conditioning)' },
      { label: 'Drive', value: 'V-belt' },
    ],
    explode: { direction: [-1, 0.5, 0.3], distance: 18, order: 0.5 },
    focus: { direction: [-0.8, 0.5, 0.4], distanceFactor: 3 },
  },
  {
    id: 'battery',
    name: 'Battery',
    group: 'engine',
    description:
      'A 12-volt lead-acid battery on a tray at the passenger-side front of the engine bay. On the real Boss 429, with the engine crammed against the shock towers, there was no room, so Ford moved the battery to the trunk, which also put a little more weight on the rear tyres.',
    specs: [
      { label: 'Type', value: '12 V lead-acid' },
      { label: 'Boss 429 location', value: 'Trunk' },
    ],
    explode: { direction: [1, 0.6, 0], distance: 18, order: 0.5 },
    focus: { direction: [0.8, 0.5, 0.4], distanceFactor: 3 },
  },
  {
    id: 'transmission',
    name: 'Transmission',
    group: 'engine',
    description:
      'A Ford Toploader four-speed manual, the only gearbox offered behind the Boss 429, with a Hurst shifter on the console. The 428 Mach 1 could be had with the C6 three-speed automatic instead.',
    specs: [
      { label: 'Type', value: 'Toploader four-speed manual' },
      { label: 'Shifter', value: 'Hurst, floor-mounted' },
    ],
    explode: { direction: [0, -1, 0], distance: 20, order: 0.6 },
    focus: { direction: FROM_LOW_SIDE },
  },

  // ---------------------------------------------------------------------------------------
  // Interior
  // ---------------------------------------------------------------------------------------
  {
    id: 'dashboard',
    name: 'Dashboard',
    group: 'interior',
    description:
      'The 1969 dash puts the driver in a twin-cowl binnacle with a big speedometer and tachometer either side of a smaller gauge cluster. The Mach 1 adds simulated woodgrain, a clock, and a full set of gauges in place of warning lights.',
    specs: [
      { label: 'Gauges', value: 'Speedometer, 8,000 rpm tachometer, fuel, temperature, oil, alternator' },
      { label: 'Trim', value: 'Simulated teak woodgrain (Mach 1)' },
    ],
    explode: { direction: [0, 1, 0.3], distance: 34, order: 0.3 },
    focus: { direction: [-0.3, 0.55, -0.8] },
  },
  {
    id: 'steeringWheel',
    name: 'Steering wheel',
    group: 'interior',
    description:
      'A three-spoke Rim-Blow wheel: squeeze the soft rim and the horn sounds, with no button to find. It was standard on the Mach 1 and famous for going off by itself as the rubber aged.',
    specs: [
      { label: 'Type', value: 'Rim-Blow, three-spoke' },
      { label: 'Diameter', value: '15 in' },
    ],
    explode: { direction: [0, 1, 0.3], distance: 48, order: 0.25 },
    focus: { direction: [-0.5, 0.5, -0.7], distanceFactor: 2.6 },
  },
  {
    id: 'frontSeats',
    name: 'Front seats',
    group: 'interior',
    description:
      'High-back bucket seats, new for 1969 and standard on the Mach 1, with the head restraint built into the backrest. They are trimmed in Comfortweave knitted vinyl with seat belts and shoulder harnesses, and they recline only by tipping forward for the rear passengers.',
    specs: [
      { label: 'Type', value: 'High-back buckets' },
      { label: 'Trim', value: 'Comfortweave knitted vinyl' },
    ],
    explode: { direction: [0, 1, 0], distance: 40, order: 0.35 },
    focus: { direction: [-0.8, 0.5, -0.3] },
  },
  {
    id: 'rearSeat',
    name: 'Rear seat',
    group: 'interior',
    description:
      'A bench for two, tucked under the fastback glass with the headroom of a mail slot. The SportsRoof could be ordered with a fold-down rear seat that opens into the trunk for long loads; the Mach 1 has it fixed.',
    specs: [
      { label: 'Seats', value: 'Two' },
      { label: 'Option', value: 'Fold-down, through-load' },
    ],
    explode: { direction: [0, 1, -0.2], distance: 36, order: 0.4 },
    focus: { direction: [-0.7, 0.6, -0.4] },
  },
  {
    id: 'console',
    name: 'Console',
    group: 'interior',
    description:
      'A full-length centre console between the seats, standard on the Mach 1, with the Hurst shifter for the four-speed at its front, a lidded storage bin, and the woodgrain trim continued from the dash. The four-speed cars got the Hurst linkage under it; automatics had a T-handle in the same slot.',
    specs: [
      { label: 'Shifter', value: 'Hurst four-speed' },
      { label: 'Trim', value: 'Woodgrain, black vinyl' },
    ],
    explode: { direction: [0, 1, 0], distance: 28, order: 0.4 },
    focus: { direction: [-0.5, 0.7, -0.5], distanceFactor: 2.6 },
  },
]

/** Parts whose builder returns a left and a right object (see `types.ts`). */
export const MIRRORED_PARTS: ReadonlySet<PartId> = new Set<PartId>([
  'headlights',
  'taillights',
  'sideScoops',
  'mirrors',
  'doorHandles',
  'doorGlass',
  'quarterGlass',
  'frontBrakes',
  'rearBrakes',
  'headers',
])

export const PARTS: readonly PartInfo[] = DRAFTS.map((draft) => ({
  ...draft,
  explode: { ...draft.explode, direction: unit(draft.explode.direction) },
  ...(draft.hinge ? { hinge: { ...draft.hinge, axis: unit(draft.hinge.axis) } } : {}),
}))

export const PART_IDS: readonly PartId[] = PARTS.map((part) => part.id)

const BY_ID = new Map<PartId, PartInfo>(PARTS.map((part) => [part.id, part]))

export function partById(id: PartId): PartInfo {
  const part = BY_ID.get(id)
  if (!part) throw new Error(`Unknown part: ${id}`)
  return part
}

export function isPartId(value: unknown): value is PartId {
  return typeof value === 'string' && BY_ID.has(value as PartId)
}

export function partsInGroup(group: PartGroup): PartInfo[] {
  return PARTS.filter((part) => part.group === group)
}

export function isHingedPart(id: PartId): id is HingedPartId {
  return partById(id).hinge !== undefined
}
