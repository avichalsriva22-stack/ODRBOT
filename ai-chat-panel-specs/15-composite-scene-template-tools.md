# 15 — Composite Scene-Template Tools (Tier 4)

## 1. Why these exist

The planner (doc 12) *can* assemble a full intersection purely by sequencing
Tier 1–3 primitives (4× `create_road` + `create_junction` + 4×
`add_crosswalk` + 4× `add_traffic_signal`, per doc 14's example). But making
the LLM re-derive correct arm geometry (angles that actually meet at a
point, non-overlapping roads, sensible crosswalk placement relative to stop
lines) from scratch, in every plan, for every common pattern, is both
error-prone and wasteful. Tier 4 tools are **hand-written, tested,
deterministic composite builders** — ordinary code, not LLM reasoning — that
each internally call several Tier 1–3 primitives/factories and return one
batch of `ICommand`s, exactly like `create_roundabout` (doc 03 Tier 2)
already does. The planner is instructed (doc 12 §4.3 rule 1) to prefer
these when they fit, falling back to manual primitive sequencing for
anything unusual.

These are still `AiTool` implementations (doc 02 §1) registered in
`AiToolRegistry` (doc 04 §1) exactly like every other tool — "Tier 4" is a
catalog-organization label only, not a different mechanism.

## 2. `build_intersection`

- category: `junction`, requiresPreview: `true`
- description: "Build a complete N-way intersection at a given position: arm roads, junction, crosswalks, and (optionally) traffic signals or stop signs — a single call for the common 'build me an intersection' request."
- parameters:
  - `centerX: number`, `centerY: number` (required)
  - `armCount: integer` (optional, default 4, min 3, max 6)
  - `armLength: number` (optional, default 40, min 15, max 300)
  - `armHeadings: array<number>` (optional — explicit heading in degrees per arm; if omitted, arms are evenly spaced starting from 0°)
  - `leftLaneCount, rightLaneCount, laneWidth` (optional, same defaults as `create_road`, doc 03)
  - `controlType: string enum ["signals","stopSigns","yield","uncontrolled"]` (optional, default "signals")
  - `includeCrosswalks: boolean` (optional, default true)
- backing implementation: new `IntersectionTemplateFactory.build(options)` in
  `src/app/factories/intersection-template.factory.ts`. Internally:
  1. Computes `armCount` evenly-spaced (or explicit) headings from center.
  2. Calls `RoadFactory.makeRoad(...)` once per arm (reusing doc 03's
     `create_road` backing call directly, not through the AI tool layer —
     factories call factories, not tools calling tools).
  3. Calls the existing `RoadCircleFactory`/`JunctionFactory` linking logic
     (the same one `create_junction`, doc 03 Tier 2, uses) to join all arm
     ends into one `TvJunction`.
  4. If `includeCrosswalks`, calls the crosswalk creation logic (same
     backing as `add_crosswalk`) once per arm, positioned a fixed
     **stop-line offset** (default 6m) back from the junction boundary along
     each arm.
  5. If `controlType !== 'uncontrolled'`, places the corresponding signal/
     sign object (same backing as `add_traffic_signal`/`add_road_sign`) at
     each arm entry.
  6. Returns `{ roads: TvRoad[], junction: TvJunction, crosswalks: [...], signals: [...] }`.
- command mapping: one `ICommand` (`AddObjectCommand`, via `Commands.AddObject`
  equivalents) per generated object, all returned together — the AI tool's
  `run()` wraps `IntersectionTemplateFactory.build()` and flattens its
  output into `AiToolRunResult.commands`, with `createdIds` populated for
  every road, the junction, and each crosswalk/signal (so a plan step
  referencing this tool's output, e.g. "now add a bike lane to the north
  arm," can resolve `${stepN.createdIds[...]}` correctly per doc 12 §4.2 —
  document the **order** `createdIds` is emitted in clearly in the tool's
  own code comments: arms first in heading order, then junction, then
  crosswalks in the same arm order, then signals in the same arm order).
- preview: diff card lists each generated object descriptively (doc 09 §4
  creation-style rows), grouped under sub-headings "Roads", "Junction",
  "Crosswalks", "Signals" for readability given the object count.
- preconditions: same arm-overlap sanity check as `create_roundabout` (doc
  03 Tier 2) — reuse that validation function rather than duplicating it
  (extract it into a shared `validateArmGeometry(armCount, radius|armLength)`
  helper both tools call).

## 3. `build_roundabout_with_arms`

Distinguish from doc 03 Tier 2's existing `create_roundabout`, which only
builds the circular road + stub connections. This composite additionally
extends each arm outward to a specified length and (optionally) adds
crosswalks/yield signs at each entry, i.e. it's `create_roundabout` +
`build_intersection`-style trimmings composed together.

- category: `junction`, requiresPreview: `true`
- parameters: everything `create_roundabout` takes (doc 03 Tier 2) plus
  `includeCrosswalks: boolean` (default true), `includeYieldSigns: boolean`
  (default true).
- backing implementation: calls `RoadCircleFactory.makeRoundabout(...)`
  (doc 03/11's required refactor) then the same crosswalk/signal placement
  helpers `build_intersection` uses — factor those into a shared
  `IntersectionTrimmingsHelper` used by both composite tools rather than
  copy-pasted.
- command mapping / preview / preconditions: same pattern as §2.

## 4. `build_parking_lot`

- category: `terrain` (closest fit; touches surface + props + roads)
- requiresPreview: `true`
- description: "Build a rectangular parking lot: access road, parking-space rows, and a paved surface area, at a given position."
- parameters:
  - `originX: number`, `originY: number` (required) — corner of the lot
  - `width: number` (required, min 10, max 300), `depth: number` (required, min 10, max 300)
  - `rows: integer` (optional, default: computed from `depth` / 12m row pitch, capped 1–20)
  - `spotWidth: number` (optional, default 2.5), `spotDepth: number` (optional, default 5)
  - `accessFromRoadId: integer` (optional — if given, connects the lot's access lane to this existing road via `extend_road_from_selected`-style linking; if omitted, the lot is placed unconnected)
- backing implementation: new `ParkingLotTemplateFactory.build(options)` in
  `src/app/factories/parking-lot-template.factory.ts`, composing:
  1. `SurfaceTool`'s backing (same as `edit_surface`, doc 03 Tier 3) for the
     paved area polygon (`material: "asphalt"`).
  2. The existing `ParkingSpot`/`ParkingLot`/`ParkingRoad` tool types
     (`ToolType.ParkingSpot`, `.ParkingLot`, `.ParkingRoad` already exist in
     `src/app/tools/tool-types.enum.ts` — locate their pure/service-layer
     backing the same way doc 03 did for other tools; this is direct reuse,
     not new domain logic) to lay out the spot grid given `rows`,
     `spotWidth`, `spotDepth` within the `width × depth` bounds.
  3. If `accessFromRoadId` given, one `RoadFactory.makeRoad(...)` call for a
     short connector + linking, same pattern as `extend_road_from_selected`.
- command mapping: same flatten-and-return pattern as §2.
- preview: diff shows lot bounds, computed spot count, and (if applicable)
  the access connection.
- preconditions: `width`/`depth` large enough to fit at least 1 row of spots
  given `spotWidth`/`spotDepth` (validate and throw a specific, LLM-readable
  message like "depth 10m is too small for any parking row at 12m pitch —
  increase depth or the tool cannot place any spots" rather than silently
  producing zero spots).

## 5. `build_residential_block`

- category: `road`, requiresPreview: `true`
- description: "Build a simple residential block: a rectangular loop of low-speed roads with sidewalks, at a given position and size — useful as a starting skeleton for a neighborhood."
- parameters:
  - `originX: number`, `originY: number` (required) — one corner
  - `width: number` (required, min 30, max 500), `depth: number` (required, min 30, max 500)
  - `roadType: string enum [...]` (optional, default "lowSpeed")
  - `includeSidewalks: boolean` (optional, default true)
  - `maxSpeed: number` (optional, default 30)
- backing implementation: new `ResidentialBlockTemplateFactory.build(options)`
  in `src/app/factories/residential-block-template.factory.ts`:
  1. Four `RoadFactory.makeRoad(...)` calls forming a rectangle (each edge's
     start/end computed from `originX/Y`, `width`, `depth`).
  2. Four corner junctions via the same `JunctionFactory` path
     `create_junction` uses.
  3. If `includeSidewalks`, one `add_lane(side: "right"/"left", laneType:
     "sidewalk")`-equivalent call per road edge (reuses doc 03 Tier 1's
     `add_lane` backing directly).
- command mapping / preview / preconditions: same pattern as §2; precondition
  additionally checks `width`/`depth` aren't degenerate given minimum road
  length constraints already enforced by `create_road`'s own precondition
  (`length >= 1`), i.e. just ensure the derived edge lengths satisfy that.

## 6. `build_highway_segment`

- category: `road`, requiresPreview: `true`
- description: "Build a multi-lane divided highway segment (both directions, with a median) between two points, optionally with an on/off ramp."
- parameters:
  - `startX: number`, `startY: number`, `endX: number`, `endY: number` (required)
  - `lanesPerDirection: integer` (optional, default 2, min 1, max 5)
  - `medianWidth: number` (optional, default 4, min 0, max 20)
  - `maxSpeed: number` (optional, default 100)
  - `includeRamp: boolean` (optional, default false), `rampSide: string enum ["left","right"]` (optional, default "right"), `rampAtStart: boolean` (optional, default false, i.e. ramp placed at the end if false)
- backing implementation: new `HighwaySegmentTemplateFactory.build(options)`
  in `src/app/factories/highway-segment-template.factory.ts`:
  1. Computes heading/length from `start`/`end` points.
  2. Two `RoadFactory.makeRoad(...)` calls (one per direction), offset
     laterally by `medianWidth/2 + laneWidth*lanesPerDirection/2` from the
     centerline on each side, each with `rightLaneCount: lanesPerDirection`
     and `roadType: "motorway"`.
  3. If `includeRamp`, mirrors `RoadRampTool`'s backing (`ToolType.RoadRampTool`
     — locate its pure creation logic the same way doc 03 located other
     tools' backings) to attach a ramp road at the specified end/side.
- command mapping / preview / preconditions: same pattern as §2; precondition
  validates `startX/Y` ≠ `endX/Y` (non-zero length) and
  `lanesPerDirection * laneWidth * 2 + medianWidth` is a sane total width
  (no hard numeric cap beyond existing per-field min/max, just a non-
  degenerate check).

## 7. Registration and catalog update

All 6 Tier 4 tools register in `AiToolRegistry` (doc 04 §1) alongside the
existing 30, bringing the total catalog to **36 tools**. Update:
- Doc 03 §Summary table — add a "Tier 4" section listing these 6 with the
  same columns.
- Doc 10 §1's `ai-tool-registry.service.spec.ts` — update the "exactly 30
  entries" assertion to 36.
- Doc 11 Phase 7 checklist — add a new "Phase 7b — Composite templates"
  sub-section listing the 6 new tool files + 4 new factory files
  (`intersection-template.factory.ts`, `parking-lot-template.factory.ts`,
  `residential-block-template.factory.ts`, `highway-segment-template.factory.ts`)
  + their `.spec.ts` counterparts, sequenced **after** Phase 7's primitive
  Tier 2/3 tools (since these composites call primitive-tool backing code
  and the shared `validateArmGeometry`/`IntersectionTrimmingsHelper` helpers
  factored out of them).

## 8. Testing additions (extends doc 10)

- One unit spec per composite factory, asserting: correct object count
  produced for given params (e.g. `build_intersection` with `armCount: 4,
  includeCrosswalks: true, controlType: "signals"` → exactly 4 roads + 1
  junction + 4 crosswalks + 4 signals in the returned command set).
- One doc 10 §4 eval-set case per composite tool (6 new cases, raising the
  minimum eval set from 25 to at least 31), phrased the way a real user
  would ask ("build me a 4-way intersection here", "make a small parking
  lot next to this road") to confirm the **planner** (doc 12) actually
  reaches for these tools instead of manually sequencing primitives when a
  composite fits — this is the specific behavior doc 12 §4.3 rule 1 asks
  for and needs its own regression coverage, not just a factory-level unit
  test.
