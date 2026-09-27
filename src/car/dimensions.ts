/**
 * The 1969 Mustang SportsRoof (fastback) laid out in car space: inches, +Y up, +Z toward the nose,
 * +X toward the passenger side, origin on the ground midway between the axles. See `types.ts`.
 *
 * Every builder under `src/render/` positions its parts from these constants so that panels,
 * trim, wheels, engine and interior meet at the same seams. Published figures are used where
 * they exist (wheelbase, length, width, height, track); the rest are measured from the car's
 * proportions and chosen so the parts fit together.
 */

// -------------------------------------------------------------------------------------------
// Published dimensions
// -------------------------------------------------------------------------------------------

export const WHEELBASE = 108
export const OVERALL_LENGTH = 187.4
export const OVERALL_WIDTH = 71.3
export const OVERALL_HEIGHT = 50.3
export const TRACK_FRONT = 58.5
export const TRACK_REAR = 58.5

// -------------------------------------------------------------------------------------------
// Axles and wheels
// -------------------------------------------------------------------------------------------

export const FRONT_AXLE_Z = WHEELBASE / 2
export const REAR_AXLE_Z = -WHEELBASE / 2
/** 245/45R17 tyres on 17 x 8 five-spoke wheels: about 26.2 in tall, 9 in wide. */
export const TIRE_DIAMETER = 26.2
export const TIRE_WIDTH = 9
export const TIRE_RADIUS = TIRE_DIAMETER / 2
export const RIM_DIAMETER = 17
export const RIM_WIDTH = 8
export const WHEEL_CENTER_Y = TIRE_RADIUS
/** Centre of each tyre's width, measured from the centreline. */
export const WHEEL_CENTER_X_FRONT = TRACK_FRONT / 2
export const WHEEL_CENTER_X_REAR = TRACK_REAR / 2

/** The four wheel centres in car space, in the order the catalogue lists them. */
export const WHEEL_CENTERS = {
  wheelFrontLeft: [-WHEEL_CENTER_X_FRONT, WHEEL_CENTER_Y, FRONT_AXLE_Z],
  wheelFrontRight: [WHEEL_CENTER_X_FRONT, WHEEL_CENTER_Y, FRONT_AXLE_Z],
  wheelRearLeft: [-WHEEL_CENTER_X_REAR, WHEEL_CENTER_Y, REAR_AXLE_Z],
  wheelRearRight: [WHEEL_CENTER_X_REAR, WHEEL_CENTER_Y, REAR_AXLE_Z],
} as const

/** Wheel arch openings in the body sides: centred on the axles, this radius, at this height. */
export const WHEEL_ARCH_RADIUS = 15
export const WHEEL_ARCH_CENTER_Y = WHEEL_CENTER_Y + 0.5

// -------------------------------------------------------------------------------------------
// Length stations (Z) along the car, nose to tail
// -------------------------------------------------------------------------------------------

export const NOSE_Z = 93
export const TAIL_Z = NOSE_Z - OVERALL_LENGTH // -94.4
/** The front bumper blade sits just ahead of the sheet metal; the rear one just behind. */
export const FRONT_BUMPER_Z = NOSE_Z + 1.5
export const REAR_BUMPER_Z = TAIL_Z - 1.5
/** Hood: from the nose back to the cowl (its hinge line). */
export const HOOD_FRONT_Z = NOSE_Z - 2
export const HOOD_REAR_Z = 21
/** The cowl panel (wipers) between the hood and the windshield base. */
export const COWL_FRONT_Z = HOOD_REAR_Z
export const COWL_REAR_Z = 17
/** Windshield foot (at the cowl) and head (at the roof). */
export const WINDSHIELD_BASE_Z = 17
export const WINDSHIELD_TOP_Z = 3
/** Doors: from the A-pillar to the front edge of the quarter panel. */
export const DOOR_FRONT_Z = 17
export const DOOR_REAR_Z = -24
/** The roof panel proper, from the windshield head to where the fastback begins to fall. */
export const ROOF_FRONT_Z = WINDSHIELD_TOP_Z
export const ROOF_PEAK_Z = -9
/** The SportsRoof stays level over the whole door glass; the fastback falls from the B-pillar. */
export const ROOF_REAR_Z = DOOR_REAR_Z
/** The fastback rear glass runs from the roof down to the deck. */
export const REAR_GLASS_TOP_Z = ROOF_REAR_Z
export const REAR_GLASS_BASE_Z = -62
/** Quarter panels: from the door's rear edge to the tail. */
export const QUARTER_FRONT_Z = DOOR_REAR_Z
export const QUARTER_REAR_Z = TAIL_Z
/** The deck (trunk) lid: from the rear glass base to the tail panel, hinged at its front edge. */
export const TRUNK_FRONT_Z = -64
export const TRUNK_REAR_Z = TAIL_Z + 2
/** The engine bay sits between the radiator support and the firewall. */
export const RADIATOR_Z = 82
export const FIREWALL_Z = 24

// -------------------------------------------------------------------------------------------
// Heights (Y)
// -------------------------------------------------------------------------------------------

/** Ground clearance to the lowest sheet metal (the rocker panels and valances). */
export const ROCKER_BOTTOM_Y = 8.5
export const ROCKER_TOP_Y = 12
/** The passenger floor. */
export const FLOOR_Y = 12
/** The belt line: the top edge of the doors and quarter panels, where the glass starts. */
export const BELT_Y = 33
/** Hood surface height at its rear (cowl) and front (nose) ends: it falls gently toward the nose. */
export const HOOD_REAR_Y = 37
export const HOOD_FRONT_Y = 33.5
/** The fender crease, the ridge along each fender top that frames the hood. */
export const FENDER_CREASE_REAR_Y = 36
export const FENDER_CREASE_FRONT_Y = 32.5
/** The cowl (wiper) panel top. */
export const COWL_Y = 36.5
export const WINDSHIELD_BASE_Y = 37
export const WINDSHIELD_TOP_Y = 49.2
export const ROOF_Y = OVERALL_HEIGHT
/** The deck at the base of the rear glass, and the tail panel top edge (the slight ducktail lip). */
export const DECK_Y = 39.5
export const TAIL_TOP_Y = 38.5
/** The tail panel's lower edge, above the rear valance. */
export const TAIL_BOTTOM_Y = 22
/** Nose: the grille opening's top and bottom, and the front valance's bottom. */
export const NOSE_TOP_Y = 32
export const GRILLE_TOP_Y = 30.5
export const GRILLE_BOTTOM_Y = 22.5
export const VALANCE_BOTTOM_Y = ROCKER_BOTTOM_Y
/** Bumpers: chrome blades of this height, centred at this height. */
export const BUMPER_CENTER_Y = 20.5
export const BUMPER_HEIGHT = 3.2

// -------------------------------------------------------------------------------------------
// Widths (half widths, X, measured from the centreline)
// -------------------------------------------------------------------------------------------

export const HALF_WIDTH = OVERALL_WIDTH / 2 // 35.65
/** Widest point of the body sides, at the belt line over the doors and quarters. */
export const BODY_HALF_WIDTH = 35.2
/** The rockers tuck in under the doors. */
export const ROCKER_HALF_WIDTH = 32.5
/** The body narrows toward the nose and tail. */
export const NOSE_HALF_WIDTH = 33
export const TAIL_HALF_WIDTH = 33.5
/** Hood width between the fender creases, at the cowl and at the nose. */
export const HOOD_HALF_WIDTH_REAR = 27.5
export const HOOD_HALF_WIDTH_FRONT = 24.5
/** The greenhouse (glass and roof) is narrower than the body. */
export const ROOF_HALF_WIDTH = 25
export const WINDSHIELD_BASE_HALF_WIDTH = 28
export const WINDSHIELD_TOP_HALF_WIDTH = 24
export const REAR_GLASS_BASE_HALF_WIDTH = 24.5
/** Bumpers span this far out and wrap back around the corners. */
export const BUMPER_HALF_WIDTH = 35.5
export const BUMPER_WRAP_DEPTH = 6

// -------------------------------------------------------------------------------------------
// Front end
// -------------------------------------------------------------------------------------------

/** 1969 quad headlights: an outer pair in the fender ends and an inner pair inside the grille. */
export const HEADLIGHT_DIAMETER = 5.75
export const HEADLIGHT_Y = 27.5
export const HEADLIGHT_OUTER_X = 30.5
export const HEADLIGHT_OUTER_Z = NOSE_Z - 1
export const HEADLIGHT_INNER_X = 19.5
export const HEADLIGHT_INNER_Z = NOSE_Z - 4.5
/** The grille opening, recessed behind the nose. */
export const GRILLE_HALF_WIDTH = 25
export const GRILLE_Z = NOSE_Z - 5
/** The front valance carries the turn signals below the bumper. */
export const TURN_SIGNAL_X = 22
export const TURN_SIGNAL_Y = 14.5

// -------------------------------------------------------------------------------------------
// Rear end
// -------------------------------------------------------------------------------------------

/** The tail corners round in plan over the last inches, so the quarters wrap into the tail panel. */
export const TAIL_CORNER_RADIUS = 6
/** The recessed tail panel spans the flat between the rounded corners. */
export const TAIL_PANEL_HALF_WIDTH = TAIL_HALF_WIDTH - TAIL_CORNER_RADIUS
/** How far the tail panel's face sits in from the quarter ends, behind a rolled lip. */
export const TAIL_PANEL_RECESS = 2.5
export const TAIL_PANEL_FACE_Z = TAIL_Z + 0.3 + TAIL_PANEL_RECESS
/** Three vertical taillight lenses per side, each in its own chrome bezel, on the recessed face. */
export const TAILLIGHT_BAR_WIDTH = 3.4
export const TAILLIGHT_BAR_HEIGHT = 8.5
export const TAILLIGHT_BAR_GAP = 1
export const TAILLIGHT_CENTER_X = 18.5
export const TAILLIGHT_Y = 30.2
export const TAILLIGHT_Z = TAIL_PANEL_FACE_Z - 0.5
/** The pop-open fuel cap in the centre of the tail panel. */
export const FUEL_CAP_DIAMETER = 5.5
export const FUEL_CAP_Y = 30.2
/** The licence plate and round backup lights in the rear valance, below the bumper. */
export const REAR_PLATE_Y = 15.5
export const BACKUP_LIGHT_X = 23.5
export const BACKUP_LIGHT_Y = 15.5
export const BACKUP_LIGHT_DIAMETER = 3.2
/** Dual exhaust tips through the rear valance. */
export const EXHAUST_TIP_X = 17
export const EXHAUST_TIP_Y = 10.5
export const EXHAUST_TIP_DIAMETER = 2.5

// -------------------------------------------------------------------------------------------
// Hood and side details
// -------------------------------------------------------------------------------------------

/** The Boss 429-style scoop: a broad box toward the front of the hood. */
export const HOOD_SCOOP_FRONT_Z = 84
export const HOOD_SCOOP_REAR_Z = 48
export const HOOD_SCOOP_HALF_WIDTH = 9.5
export const HOOD_SCOOP_HEIGHT = 5
/** Hood pins: at the hood's front corners. */
export const HOOD_PIN_X = 18
export const HOOD_PIN_Z = 86
/** Mach 1 quarter scoops on the upper quarter panel just behind each door. */
export const SIDE_SCOOP_Z = -30
export const SIDE_SCOOP_Y = 27
export const SIDE_SCOOP_LENGTH = 9
export const SIDE_SCOOP_HEIGHT = 4
/** Dual racing mirrors on the doors near the A-pillar. */
export const MIRROR_X = BODY_HALF_WIDTH + 2.5
export const MIRROR_Y = BELT_Y + 3.5
export const MIRROR_Z = 12
export const DOOR_HANDLE_Y = 28
export const DOOR_HANDLE_Z = -14
/** Quarter windows: the small panes behind the door glass on the fastback. */
export const QUARTER_GLASS_FRONT_Z = DOOR_REAR_Z - 1
export const QUARTER_GLASS_REAR_Z = -40
/** The pane's top edge runs just under the sloping roof edge, so it is only a cap for the front corner. */
export const QUARTER_GLASS_TOP_Y = 48
/** Mach 1 reflective side stripe: a low band above the rocker, between the wheel openings. */
export const SIDE_STRIPE_BOTTOM_Y = ROCKER_TOP_Y + 1
export const SIDE_STRIPE_TOP_Y = ROCKER_TOP_Y + 4
export const SIDE_STRIPE_FRONT_Z = FRONT_AXLE_Z - WHEEL_ARCH_RADIUS - 1.5
export const SIDE_STRIPE_REAR_Z = REAR_AXLE_Z + WHEEL_ARCH_RADIUS + 1.5

// -------------------------------------------------------------------------------------------
// Engine bay and driveline
// -------------------------------------------------------------------------------------------

/** The big-block V8: block centre, and its extent. */
export const ENGINE_CENTER: readonly [number, number, number] = [0, 21, 60]
export const ENGINE_BLOCK_LENGTH = 30
export const ENGINE_BLOCK_WIDTH = 22
export const ENGINE_BLOCK_HEIGHT = 18
/** The heads sit on the block at a 90-degree vee, valve covers on top. */
export const VALVE_COVER_TOP_Y = 34
/** Carburettor and air cleaner on the intake, under the scoop. */
export const CARB_TOP_Y = 34.5
export const AIR_CLEANER_DIAMETER = 14
export const AIR_CLEANER_Y = 33
export const AIR_CLEANER_Z = 60
/** Radiator between the grille and the fan. */
export const RADIATOR_HALF_WIDTH = 15
export const RADIATOR_TOP_Y = 32
export const RADIATOR_BOTTOM_Y = 13
export const RADIATOR_THICKNESS = 2.5
export const FAN_Z = RADIATOR_Z - 6
export const FAN_DIAMETER = 18
export const FAN_Y = 22
/** The shock towers that hem in the engine (the Boss 429 needed them re-worked). */
export const SHOCK_TOWER_X = 19.5
export const SHOCK_TOWER_Z = 56
export const SHOCK_TOWER_TOP_Y = 31
/** Battery on the passenger side of the radiator support; alternator on the driver side. */
export const BATTERY_CENTER: readonly [number, number, number] = [25, 27, 75]
export const ALTERNATOR_CENTER: readonly [number, number, number] = [-14, 26, 74]
/** Transmission behind the block, driveshaft to the rear axle. */
export const TRANSMISSION_FRONT_Z = ENGINE_CENTER[2] - ENGINE_BLOCK_LENGTH / 2
export const TRANSMISSION_REAR_Z = 12
export const TRANSMISSION_Y = 16
export const DRIVESHAFT_Y = 12.5
export const DRIVESHAFT_DIAMETER = 3
/** The rear axle housing, differential in the centre, on leaf springs. */
export const AXLE_TUBE_DIAMETER = 3.2
export const DIFFERENTIAL_DIAMETER = 11
export const LEAF_SPRING_X = 21.5
export const LEAF_SPRING_FRONT_Z = -28
export const LEAF_SPRING_REAR_Z = -78
export const LEAF_SPRING_Y = 13.5
/** Fuel tank under the trunk floor. */
export const FUEL_TANK_CENTER: readonly [number, number, number] = [0, 12, -80]
export const FUEL_TANK_SIZE: readonly [number, number, number] = [36, 8, 22]
/** Dual exhaust: pipes at this X run back under the floor to mufflers, then to the tips. */
export const EXHAUST_PIPE_X = 11
export const EXHAUST_PIPE_Y = 9.5
export const MUFFLER_Z = -45
export const MUFFLER_LENGTH = 22
export const MUFFLER_DIAMETER = 6
/** Front disc brakes and rear drums, behind the wheels. */
export const FRONT_DISC_DIAMETER = 11.3
export const REAR_DRUM_DIAMETER = 10

// -------------------------------------------------------------------------------------------
// Interior
// -------------------------------------------------------------------------------------------

/** The dash spans the cabin under the windshield. */
export const DASH_FRONT_Z = 20
export const DASH_REAR_Z = 12
export const DASH_TOP_Y = 36
export const DASH_BOTTOM_Y = 24
/** High-back bucket seats: seat centre X, cushion and back heights. */
export const FRONT_SEAT_X = 13.5
export const FRONT_SEAT_Z = -4
export const SEAT_CUSHION_Y = 19
export const SEAT_BACK_TOP_Y = 40
export const REAR_SEAT_Z = -32
/** Steering wheel on the driver's side. */
export const STEERING_WHEEL_CENTER: readonly [number, number, number] = [-FRONT_SEAT_X, 32, 8]
export const STEERING_WHEEL_DIAMETER = 15
/** The wheel is tilted back from vertical by this many radians about the X axis. */
export const STEERING_WHEEL_TILT = 0.5
export const CONSOLE_FRONT_Z = 12
export const CONSOLE_REAR_Z = -16
export const CONSOLE_TOP_Y = 22
export const SHIFTER_Z = 2

// -------------------------------------------------------------------------------------------
// Whole-car extents, for cameras and the turntable
// -------------------------------------------------------------------------------------------

export const CAR_CENTER: readonly [number, number, number] = [0, OVERALL_HEIGHT / 2, (NOSE_Z + TAIL_Z) / 2]
/** The turntable platform under the car. */
export const TURNTABLE_RADIUS = 118
export const TURNTABLE_HEIGHT = 2.5
