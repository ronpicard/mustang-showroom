/**
 * The "About the car" reading: the sections the About panel shows, in order. Plain data, so the
 * tests can check that every section has a title and some text.
 */

export interface FactRow {
  label: string
  value: string
}

export interface FactSection {
  id: string
  title: string
  paragraphs: readonly string[]
  /** An optional two-column table after the paragraphs. */
  table?: readonly FactRow[]
}

export const VEHICLE_TITLE = '1969 Ford Mustang'
export const VEHICLE_SUBTITLE = 'Mach 1 SportsRoof, Boss 429 style'

export const FACT_SECTIONS: readonly FactSection[] = [
  {
    id: 'overview',
    title: 'The 1969 Mustang',
    paragraphs: [
      'For 1969 Ford gave the Mustang its first thorough restyle. The car grew almost four inches in length and an inch in width on the same 108-inch wheelbase, the hood stretched, the nose gained quad headlights, and the fastback became the SportsRoof, its roofline running unbroken to a kicked-up tail. It was the year of the Mach 1, the Boss 302 and the Boss 429, and the year the Mustang stopped being a secretary\'s car and became a muscle car.',
      'Ford built 299,824 Mustangs for 1969, down from 317,404 the year before as the Camaro, Firebird, Javelin and Challenger crowded in. The car in this showroom is a Mach 1 SportsRoof in the style of the film car: the Boss 429 hood scoop, hood pins, 17 x 8 polished five-spoke wheels, and a charcoal paint that was never on the colour chart.',
    ],
    table: [
      { label: 'Wheelbase', value: '108 in' },
      { label: 'Length', value: '187.4 in' },
      { label: 'Width', value: '71.3 in' },
      { label: 'Height', value: '50.3 in' },
      { label: 'Track', value: '58.5 in front and rear' },
      { label: 'Kerb weight', value: '3,200 to 3,600 lb by engine' },
      { label: 'Fuel tank', value: '20 US gal' },
      { label: 'Production, 1969', value: '299,824' },
    ],
  },
  {
    id: 'mach1',
    title: 'Mach 1',
    paragraphs: [
      'The Mach 1 arrived for 1969 as the performance and appearance package on the SportsRoof body: a 351 Windsor two-barrel as standard, with the 351 four-barrel, the 390 and the 428 Cobra Jet as options. Outside it wore a matte-black hood with a scoop, hood pins, reflective side stripes, a chrome pop-open gas cap and dual racing mirrors; inside, high-back buckets, a console, woodgrain trim and a Rim-Blow wheel. Ford sold 72,458 of them.',
      'With the 428 Cobra Jet and the Ram Air Shaker scoop, a Mach 1 ran the quarter mile in the high thirteens straight off the showroom floor, which is why the insurance companies took notice.',
    ],
    table: [
      { label: 'Standard engine', value: '351 W 2V, 250 hp' },
      { label: 'Top engine', value: '428 Super Cobra Jet, 335 hp advertised' },
      { label: 'Base price', value: '$3,122' },
      { label: 'Built', value: '72,458' },
    ],
  },
  {
    id: 'boss429',
    title: 'Boss 429',
    paragraphs: [
      'The Boss 429 exists because NASCAR made Ford sell 500 road cars with any engine it wanted to race. The engine, a 429-cubic-inch big-block with aluminium "semi-hemi" heads, was meant for the Torino on the superspeedways, but Ford put it in the Mustang to meet the rule. It did not fit: Kar Kraft in Brighton, Michigan, reworked the shock towers, widened the track, lowered the front suspension and moved the battery to the trunk to get it in. Each car was built by hand.',
      'Ford rated the engine at 375 horsepower to keep the insurers calm. On the road the car was oddly tame, saddled with a small carburettor and a mild camshaft, and it was the most expensive Mustang of its year. 859 were built for 1969 and 499 more for 1970, and today they are the most valuable production Mustangs of all.',
    ],
    table: [
      { label: 'Engine', value: '429 cu in V8, aluminium heads' },
      { label: 'Power', value: '375 hp advertised, about 500 real' },
      { label: 'Gearbox', value: 'Four-speed manual only' },
      { label: 'Base price', value: '$4,798' },
      { label: 'Built, 1969', value: '859' },
    ],
  },
  {
    id: 'engines',
    title: 'The 1969 engine line-up',
    paragraphs: [
      'Nine engines were offered across the range, from a 200-cubic-inch straight six to the Boss 429. Horsepower figures are the gross ratings Ford advertised at the time; the net figures of the 1970s were a good deal lower.',
    ],
    table: [
      { label: '200 six', value: '115 hp' },
      { label: '250 six', value: '155 hp' },
      { label: '302 V8 2V', value: '220 hp' },
      { label: 'Boss 302 V8', value: '290 hp' },
      { label: '351 W V8 2V / 4V', value: '250 / 290 hp' },
      { label: '390 V8 4V', value: '320 hp' },
      { label: '428 Cobra Jet', value: '335 hp' },
      { label: '428 Super Cobra Jet', value: '335 hp (rated), Drag Pack' },
      { label: 'Boss 429', value: '375 hp' },
    ],
  },
  {
    id: 'film',
    title: 'The film car',
    paragraphs: [
      'In John Wick (2014) the retired hitman\'s car is a 1969 Mustang. Although the dialogue calls it a Boss 429, the screen car is generally identified as a modified Mach 1. Its theft, along with the loss of his dog, is what brings Wick out of retirement, and the car\'s recovery opens the second film.',
      'The look combines charcoal-grey paint with low-gloss black rally stripes, a black-out grille and tail panel, and five-spoke wheels. This showroom starts with a film-inspired gunmetal finish, black stripes, a compact scoop and spoilers; it is not a factory-correct Boss 429 restoration. The paint rack offers genuine 1969 Ford colours beside it.',
    ],
  },
  {
    id: 'about',
    title: 'About this showroom',
    paragraphs: [
      'Everything here is built from code: the car is modelled from published dimensions with three.js geometry rather than a downloaded 3D model, the paint, chrome and glass are physically based materials lit by the room itself, and the engine is built from field recordings of real V8s (credited under Controls), pitch-shifted to follow a modelled rev range, with a synthesised V8 standing in if they fail to load. Drag to orbit, scroll or pinch to zoom, and click any part of the car to read about it. The explode slider pulls the car apart in the order a workshop would.',
    ],
  },
]
