# 03 — Full Tool Catalog

This is the complete, closed set of tools exposed to the LLM in v1. Every tool
listed here MUST be implemented — this is not a "starter set", this is the
full spec. Tools are grouped into tiers only to define **implementation
order** (doc 00 §Phase 3/7); all tiers ship in the final release.

Each tool below specifies:
- **name** — literal string sent to the LLM, and the registry key.
- **category** — `AiToolCategory` (doc 02 §1).
- **requiresPreview** — whether doc 09's preview/confirm flow gates it.
- **parameters** — JSON Schema properties (all tools' top-level `type` is
  `"object"`; `required` is listed explicitly).
- **backing implementation** — exact existing class/service/factory to call.
- **command mapping** — how the tool's `run()` turns the backing call's
  result into `ICommand[]`.
- **preconditions** — semantic validation `validate()` must enforce beyond
  JSON Schema.

## Tier 1 — Leaf tools (mutate an already-selected object, 1–3 scalar params, no spatial reasoning, low blast radius)

### `set_lane_width`
- category: `lane`, requiresPreview: `false`
- description: "Set the width (in meters) of a specific lane on a specific road, optionally at a given position along the road. Requires the road to already exist."
- parameters:
  - `roadId: integer` (required) — target road id
  - `laneId: integer` (required) — lane id, negative = right side, positive = left side, per OpenDRIVE convention
  - `width: number` (required, minimum 0.5, maximum 12) — new width in meters
  - `sOffset: number` (optional, minimum 0, default 0) — position along road in meters where the width change record is inserted
- backing implementation: `RoadWidthService` (read/find) + `TvLane.addWidthRecord(...)` on the `TvLane` retrieved via `road.getLaneProfile().getLaneSectionAt(s).getLaneById(laneId)`. Mirrors what `LaneWidthTool` does on drag-commit.
- command mapping: wrap in a `SetValueCommand`-style command (reuse `Commands.SetValue` pattern) capturing old width record for undo, OR (preferred, since width is a record list not a scalar) implement a new `SetLaneWidthCommand implements ICommand` in `src/app/commands/set-lane-width-command.ts` storing the lane, the previous width-record array (deep clone), and the new one.
- preconditions: `roadId` exists in `MapService.roads`; `laneId` exists in the lane section at `sOffset`; `sOffset <= road.getLength()`.

### `set_lane_height`
- category: `lane`, requiresPreview: `false`
- description: "Set the height offset of a lane (used for curbs/sidewalks)."
- parameters: `roadId: integer` (required), `laneId: integer` (required), `innerHeight: number` (required, 0–1), `outerHeight: number` (required, 0–1), `sOffset: number` (optional, default 0)
- backing implementation: mirrors `LaneHeightTool` — `TvLane` height record API in `src/app/map/lane-height/*`.
- command mapping: new `SetLaneHeightCommand implements ICommand`.
- preconditions: same as `set_lane_width`.

### `set_lane_marking`
- category: `lane`, requiresPreview: `false`
- description: "Set the road-marking style (solid, broken, none, etc.) on one edge of a lane."
- parameters: `roadId: integer` (required), `laneId: integer` (required), `side: string enum ["left","right"]` (required), `markingType: string enum ["solid","broken","solid-solid","solid-broken","broken-solid","botts-dots","grass","curb","none"]` (required), `color: string enum ["white","yellow","red","blue","green"]` (optional, default "white")
- backing implementation: mirrors `LaneMarkingTool` in `src/app/tools/lane-marking/`.
- command mapping: new `SetLaneMarkingCommand implements ICommand`.
- preconditions: `roadId`/`laneId` exist.

### `add_lane`
- category: `lane`, requiresPreview: `false`
- description: "Add a new lane to a road, to the left or right of the existing lanes."
- parameters: `roadId: integer` (required), `side: string enum ["left","right"]` (required), `laneType: string enum` (required, values = `TvLaneType` keys: `driving, stop, shoulder, biking, sidewalk, border, restricted, parking, bidirectional, median, slipLane, shared, roadWorks, tram, rail, none`), `width: number` (optional, default 3.6, min 0.5, max 12)
- backing implementation: `LaneSectionFactory` helpers used by `RoadFactory.makeHighwayRoad` (`laneSection.createLeftLane` / `createRightLane`), applied to the road's *current* (not new) `TvLaneSection`.
- command mapping: new `AddLaneCommand implements ICommand` (execute: insert lane + renumber ids on that side; undo: remove + restore original ids). **Note for implementer**: lane id renumbering on one side shifts sibling lane ids — the command must snapshot the entire lane section's lane array (deep clone) pre/post, not just the added lane, to guarantee correct undo.
- preconditions: `roadId` exists; road has at least a default lane section.

### `remove_lane`
- category: `lane`, requiresPreview: `true` (removes geometry; renumbers siblings — worth a confirm)
- description: "Remove a lane from a road."
- parameters: `roadId: integer` (required), `laneId: integer` (required)
- backing implementation: mirrors `Commands.RemoveObject` pathway but specialized for `TvLane` (removal + sibling id renumbering, mirrors deletion tool behavior in `src/app/tools/deletion/`).
- command mapping: new `RemoveLaneCommand implements ICommand`, same snapshot-whole-section approach as `AddLaneCommand`.
- preview: diff shows "Lane -2 (driving, 3.6m) will be removed; lanes -3, -4 will be renumbered to -2, -3."
- preconditions: cannot remove the last remaining driving lane on a road if it would leave the road with zero driving lanes (hard validation error, not just a warning) unless caller explicitly passes `force: boolean` (optional param, default false).

### `set_road_speed`
- category: `road`, requiresPreview: `false`
- description: "Set the speed limit for a road."
- parameters: `roadId: integer` (required), `maxSpeed: number` (required, min 5, max 200) — km/h
- backing implementation: `TvRoad` speed record API (mirrors `RoadMakeOptions.maxSpeed` usage in `RoadFactory`).
- command mapping: `Commands.SetValue(road, 'maxSpeed', newValue, oldValue)` — this generic command already exists and fits exactly.
- preconditions: `roadId` exists.

### `set_road_type`
- category: `road`, requiresPreview: `false`
- description: "Set the road type classification (affects default speed/rendering)."
- parameters: `roadId: integer` (required), `roadType: string enum ["unknown","rural","motorway","town","lowSpeed","pedestrian","bicycle"]` (required) — maps 1:1 to `TvRoadType`.
- backing implementation: `TvRoad.type` setter.
- command mapping: `Commands.SetValue(road, 'type', newValue, oldValue)`.
- preconditions: `roadId` exists.

### `set_road_elevation`
- category: `road`, requiresPreview: `false`
- description: "Add or update an elevation record on a road at a given position."
- parameters: `roadId: integer` (required), `sOffset: number` (required, min 0), `elevation: number` (required, meters), `slope: number` (optional, default 0)
- backing implementation: mirrors `RoadElevationTool` — `road.getElevationProfile().addElevation(sOffset, elevation, slope, 0, 0)`.
- command mapping: new `SetRoadElevationCommand implements ICommand`.
- preconditions: `sOffset <= road.getLength()`.

### `set_road_super_elevation`
- category: `road`, requiresPreview: `false`
- description: "Set the roll/tilt (superelevation / banking) of a road at a given position."
- parameters: `roadId: integer` (required), `sOffset: number` (required, min 0), `angleDegrees: number` (required, min -30, max 30)
- backing implementation: mirrors `RoadSuperElevationTool` in `src/app/tools/road-super-elevation/`.
- command mapping: new `SetRoadSuperElevationCommand implements ICommand`.
- preconditions: `sOffset <= road.getLength()`.

### `rename_object`
- category: `road`, requiresPreview: `false`
- description: "Rename a road or junction."
- parameters: `objectType: string enum ["road","junction"]` (required), `objectId: integer` (required), `name: string` (required, 1–64 chars)
- backing implementation: `TvRoad.name` / `TvJunction.name` setter.
- command mapping: `Commands.SetValue(obj, 'name', newValue, oldValue)`.
- preconditions: object exists.

## Tier 2 — Spatial / creation tools (create new geometry; require the safety/preview layer, doc 09)

### `create_road`
- category: `road`, requiresPreview: `true`
- description: "Create a new straight road at a given position and heading, with a given length and lane configuration. Use this when the user wants to add a brand-new road that is not connected to an existing one. Coordinates are in world meters (x = east, y = north)."
- parameters:
  - `x: number` (required) — start position X
  - `y: number` (required) — start position Y
  - `headingDegrees: number` (required, 0–360) — direction the road points, 0 = +X axis, 90 = +Y axis
  - `length: number` (required, min 1, max 5000)
  - `leftLaneCount: integer` (optional, default 0, min 0, max 6)
  - `rightLaneCount: integer` (optional, default 1, min 0, max 6)
  - `laneWidth: number` (optional, default 3.6, min 2.5, max 6)
  - `roadType: string enum [...same as set_road_type...]` (optional, default "town")
- backing implementation: **`RoadFactory.makeRoad(RoadMakeOptions)`** — direct existing static method. Convert `headingDegrees` to radians for `hdg`.
- command mapping: `Commands.AddObject(road)` — this already exists and is exactly the right command (it pushes an `AddObjectCommand`, mirrors what `SplineCreationRoadToolStrategy` ends up calling on commit).
- preview: diff shows a schematic description ("New road ~100m long at (x,y) heading 90°, 1 right lane") — full visual preview (ghost geometry in viewport) is a stretch goal noted in doc 09 §6, not required for v1 preview card, which may be textual only.
- preconditions: `length > 0`; if `x,y` unset by the model, `AiContextService` supplies "near the currently selected road's end point" as a fallback the *system prompt* instructs the model to compute — see doc 06 §5 for the exact rule ("when the user gives a relative position like 'north of the selected road', compute absolute x,y,heading yourself from the context's road geometry before calling create_road").

### `extend_road_from_selected`
- category: `road`, requiresPreview: `true`
- description: "Create a new road that connects to the end (or start) of the currently selected road, continuing in the same or a specified heading. Prefer this over create_road when the user refers to 'this road', 'the selected road', or wants continuity/connection."
- parameters: `contactPoint: string enum ["start","end"]` (required), `length: number` (required, min 1, max 5000), `headingOffsetDegrees: number` (optional, default 0 — 0 means "continue straight") , `leftLaneCount, rightLaneCount, laneWidth, roadType` same as `create_road`, all optional with same defaults.
- backing implementation: `RoadFactory.makeRoad(...)` for the new road's geometry (computed from the selected road's end pose via `road.getSpline().getLastPoint()` / heading getters), then link via `RoadLinkManager` (`src/app/managers/road/road-link.manager.ts`) — mirrors what happens when a user continues drawing a spline from an existing road endpoint in `RoadTool`.
- command mapping: `Commands.AddObject(newRoad)` then a second command wrapping `RoadLinkManager`'s link-setting call (new `LinkRoadsCommand implements ICommand` if no existing command covers it — check `road-link.manager.ts` first; if it already returns undoable state, wrap it, otherwise store old link refs (`null`) and new ones for undo).
- preconditions: `ctx.selection.selectedRoadId` must be set (validate() throws `AiToolValidationError` with message "No road is selected — ask the user to select a road first, or use create_road with explicit coordinates" — this message is designed to be relayed back to the LLM as a tool_result error so it can recover in-conversation).

### `create_roundabout`
- category: `junction`, requiresPreview: `true`
- description: "Create a roundabout (circular junction) at a given center position with a given radius and number of arms/entries."
- parameters: `centerX: number` (required), `centerY: number` (required), `radius: number` (required, min 8, max 60), `armCount: integer` (required, min 3, max 8), `armLength: number` (optional, default 40, min 10, max 500), `laneCount: integer` (optional, default 1, min 1, max 3)
- backing implementation: mirrors `RoadCircleTool` (`src/app/tools/road-circle/` — check for a `RoadCircleCreator`/strategy class analogous to `SplineCreationRoadToolStrategy`; if the tool's creation logic is embedded in a UI strategy class rather than a pure factory, **this is the one Tier-2 tool that requires a small refactor**: extract the circle+arm geometry generation into a new pure function `RoadCircleFactory.makeRoundabout(options): { circleRoad: TvRoad, armRoads: TvRoad[] }` under `src/app/factories/road-circle.factory.ts`, following the exact pattern of `RoadFactory.makeRoad`, so both the manual tool and the AI tool call the same code path). This refactor is in-scope and required, not optional — see doc 11 for the file.
- command mapping: `CommandHistory.executeMany(...)` (already exists) wrapping one `AddObjectCommand` per generated road plus one for the resulting `TvJunction` (via `JunctionFactory.createByType(TvJunctionType.AUTO, name, id)` + junction road linking, mirroring `JunctionFactory.createOrGetJunctionFromGroup`).
- preconditions: `armCount * (2*Math.PI*radius/armCount)` sanity (arms must not overlap — validate arm angular spacing vs. minimum road width, throw `AiToolValidationError` if arms would intersect at the given radius/count).

### `create_junction`
- category: `junction`, requiresPreview: `true`
- description: "Create a custom junction connecting a specified set of existing roads at a given position. Use for irregular intersections; use create_roundabout for circular ones."
- parameters: `roadIds: array<integer>` (required, minItems 2, maxItems 8), `centerX: number` (required), `centerY: number` (required)
- backing implementation: `JunctionFactory.createByType(TvJunctionType.AUTO, name, id)` + `IntersectionGroup`/`SplineIntersection` (`src/app/services/junction/spline-intersection.ts`) to compute connecting roads between the listed road ends — mirrors `JunctionTool`.
- command mapping: `CommandHistory.executeMany(...)` — one command for the junction object, one per generated connecting road.
- preconditions: every id in `roadIds` exists; roads must be within a proximity threshold of `(centerX, centerY)` (validate distance from each road's nearest endpoint to center ≤ 25m, else throw with a message telling the model to re-check coordinates).

### `add_crosswalk`
- category: `junction`, requiresPreview: `true`
- description: "Add a crosswalk to a road or at a junction."
- parameters: `roadId: integer` (required), `sOffset: number` (required, min 0) — position along the road, `width: number` (optional, default 3, min 1, max 6)
- backing implementation: mirrors `CrosswalkTool` / `src/app/modules/crosswalk/`.
- command mapping: `Commands.AddObject(crosswalkObject)` if `CrosswalkTool` produces a `TvRoad`-attached object compatible with the existing `AddObjectCommand`; otherwise new `AddCrosswalkCommand implements ICommand`.
- preconditions: `sOffset <= road.getLength()`.

### `add_traffic_signal`
- category: `signal`, requiresPreview: `true`
- description: "Add a traffic signal (traffic light) to a road at a given position, controlling a given direction."
- parameters: `roadId: integer` (required), `sOffset: number` (required, min 0), `side: string enum ["left","right"]` (required), `signalType: string enum ["trafficLight","stopSign","yieldSign"]` (optional, default "trafficLight")
- backing implementation: mirrors `TrafficLightTool` (`src/app/tools/traffic-light/`) and `RoadSignalTool`/`src/app/services/road-object/` road-signal placement path.
- command mapping: `Commands.AddObject(signalObject)`.
- preconditions: `sOffset <= road.getLength()`.

### `add_road_sign`
- category: `signal`, requiresPreview: `false`
- description: "Add a road sign (e.g. STOP, speed limit, yield) at a position on a road."
- parameters: `roadId: integer` (required), `sOffset: number` (required, min 0), `side: string enum ["left","right"]` (required), `signType: string` (required, free text — matched against the app's sign catalog in `src/assets/signs/`; if no exact match, `validate()` throws listing the closest 5 catalog names so the model can retry)
- backing implementation: mirrors `RoadSignTool` / asset catalog lookup service.
- command mapping: `Commands.AddObject(signObject)`.
- preconditions: `signType` resolves to a known asset.

## Tier 3 — Prop / marking / terrain tools (composite placement)

### `add_prop_point`
- category: `prop`, requiresPreview: `false`
- description: "Place a single prop (3D asset, e.g. a tree, barrier, bench) at a specific position."
- parameters: `assetName: string` (required — matched against asset catalog, same fuzzy-match-and-suggest behavior as `add_road_sign`), `x: number` (required), `y: number` (required), `z: number` (optional, default 0), `rotationDegrees: number` (optional, default 0), `scale: number` (optional, default 1, min 0.1, max 10)
- backing implementation: mirrors `PropPointTool` (`src/app/tools/prop-point/`).
- command mapping: `Commands.AddObject(propObject)`.
- preconditions: `assetName` resolves.

### `add_prop_curve`
- category: `prop`, requiresPreview: `false`
- description: "Place repeated props along a curve/line between two or more points (e.g. a row of streetlights or a fence)."
- parameters: `assetName: string` (required), `points: array<{x:number,y:number}>` (required, minItems 2), `spacing: number` (optional, default 5, min 0.5, max 100)
- backing implementation: mirrors `PropCurveTool` / `src/app/modules/prop-curve/`.
- command mapping: `Commands.AddObject(propCurveObject)`.
- preconditions: `points.length >= 2`; `assetName` resolves.

### `add_prop_polygon`
- category: `prop`, requiresPreview: `false`
- description: "Fill a polygonal area with repeated props (e.g. scatter trees/rocks across a region)."
- parameters: `assetName: string` (required), `points: array<{x:number,y:number}>` (required, minItems 3), `density: number` (optional, default 0.5, min 0.05, max 5) — props per square meter
- backing implementation: mirrors `PropPolygonTool` / `src/app/modules/prop-polygon/`.
- command mapping: `Commands.AddObject(propPolygonObject)`.
- preconditions: `points.length >= 3`; polygon must be non-self-intersecting (validate via existing geometry utils in `src/app/core/maths` — reuse rather than reimplement; if no such util exists, add one `Maths.isSimplePolygon(points)` in `src/app/utils/maths.ts`).

### `add_prop_span`
- category: `prop`, requiresPreview: `false`
- description: "Place props along a road's geometry span (e.g. lamp posts every N meters along a road edge)."
- parameters: `roadId: integer` (required), `assetName: string` (required), `side: string enum ["left","right"]` (required), `spacing: number` (optional, default 10, min 1, max 200), `sStart: number` (optional, default 0), `sEnd: number` (optional, default null = road end)
- backing implementation: mirrors `PropSpanTool` (`src/app/tools/prop-span/`).
- command mapping: `Commands.AddObject(propSpanObject)`.
- preconditions: `roadId` exists; `assetName` resolves; `sStart < sEnd` when both given.

### `add_point_marking`
- category: `marking`, requiresPreview: `false`
- description: "Add a point marking (e.g. an arrow, a symbol) on the road surface."
- parameters: `roadId: integer` (required), `sOffset: number` (required), `lateralOffset: number` (optional, default 0), `markingSymbol: string` (required — catalog-matched like signs)
- backing implementation: mirrors `PointMarkingTool`.
- command mapping: `Commands.AddObject(markingObject)`.
- preconditions: `roadId` exists; `markingSymbol` resolves.

### `add_text_marking`
- category: `marking`, requiresPreview: `false`
- description: "Add painted text on the road surface, e.g. STOP, BUS LANE, SCHOOL."
- parameters: `roadId: integer` (required), `sOffset: number` (required), `lateralOffset: number` (optional, default 0), `text: string` (required, 1–20 chars, will be upper-cased), `height: number` (optional, default 2, min 0.5, max 5)
- backing implementation: mirrors `TextMarkingTool`.
- command mapping: `Commands.AddObject(textMarkingObject)`.
- preconditions: `roadId` exists; text length within bounds.

### `edit_surface`
- category: `terrain`, requiresPreview: `true`
- description: "Edit terrain/surface properties (material, elevation) within a polygonal area, for non-road ground (e.g. grass, sidewalk plaza)."
- parameters: `points: array<{x:number,y:number}>` (required, minItems 3), `material: string enum ["grass","concrete","cobble","asphalt","pavement","gravel","soil"]` (required — matches `ObjectFillType`), `elevation: number` (optional, default 0)
- backing implementation: mirrors `SurfaceTool` (`src/app/tools/surface/` / `src/app/modules/surface/`).
- command mapping: `Commands.AddObject(surfaceObject)` for new surfaces; `Commands.SetValue` per changed field for edits to an existing surface (need an additional `surfaceId: integer` optional param — if provided, tool edits that surface instead of creating one; document this dual-mode explicitly in the tool description).
- preconditions: polygon non-self-intersecting (reuse `Maths.isSimplePolygon`).

## Query tools (read-only, never require preview, always `requiresPreview: false`, `commands: []`)

### `get_selected_object`
- description: "Get details of whatever is currently selected in the editor (road, lane, junction, or nothing)."
- parameters: `{}` (no params)
- returns via `data`: `{ type, id, name, summary }` or `{ type: "none" }`.

### `get_road_info`
- description: "Get full details of a specific road: length, lane configuration, speed, type, connections."
- parameters: `roadId: integer` (required)
- returns via `data`: mirrors the shape used by `AiContextService` for a single road (doc 05 §3).

### `list_roads`
- description: "List all roads in the current map with basic info (id, name, length, lane counts)."
- parameters: `filter: string enum ["all","selected-nearby"]` (optional, default "all")
- returns via `data`: `{ roads: [{id, name, length, leftLanes, rightLanes}] }`, capped at 200 entries with a `truncated: boolean` flag (matches doc 05 §4 size limits).

### `list_junctions`
- description: "List all junctions in the current map."
- parameters: `{}` (no params)
- returns via `data`: `{ junctions: [{id, name, type, connectingRoadIds}] }`.

## Project tools

### `export_opendrive`
- category: `project`, requiresPreview: `false` (it's an export, not a mutation)
- description: "Export the current map to an OpenDRIVE (.xodr) file. Use only when the user explicitly asks to export/save/download the file."
- parameters: `{}` (no params — uses existing export dialog defaults; if the app requires a destination path and the Electron `dialog.showSaveDialog` bridge is the only way to get one, this tool triggers that native dialog rather than silently writing to a fixed path)
- backing implementation: `ExporterFactory` (`src/app/factories/exporter.factory.ts`) — reuse exactly what `export-opendrive-dialog` component calls.
- command mapping: none (`commands: []`) — this is a side-effecting I/O action, not an `ICommand`; it must NOT go through `CommandHistory` (it's not undoable/redoable, exporting a file has no "undo").
- preconditions: map has at least one road (else return a friendly `summary` explaining there's nothing to export, not an error).

### `undo_last_action`
- category: `project`, requiresPreview: `false`
- description: "Undo the most recent change (equivalent to Ctrl+Z). Use only when the user explicitly asks to undo."
- parameters: `{}` (no params)
- backing implementation: `CommandHistory.undo()` — called directly, not via `AiCommandService.execute` (see doc 04 §4 for why this one tool is special-cased).
- preconditions: `CommandHistory.getUndosCount() > 0`, else return a friendly summary "Nothing to undo."

## Summary table (for registry completeness check — doc 11 uses this to verify nothing is missed)

| Tool name | Category | Tier | Preview? |
|---|---|---|---|
| set_lane_width | lane | 1 | no |
| set_lane_height | lane | 1 | no |
| set_lane_marking | lane | 1 | no |
| add_lane | lane | 1 | no |
| remove_lane | lane | 1 | yes |
| set_road_speed | road | 1 | no |
| set_road_type | road | 1 | no |
| set_road_elevation | road | 1 | no |
| set_road_super_elevation | road | 1 | no |
| rename_object | road | 1 | no |
| create_road | road | 2 | yes |
| extend_road_from_selected | road | 2 | yes |
| create_roundabout | junction | 2 | yes |
| create_junction | junction | 2 | yes |
| add_crosswalk | junction | 2 | yes |
| add_traffic_signal | signal | 2 | yes |
| add_road_sign | signal | 2 | no |
| add_prop_point | prop | 3 | no |
| add_prop_curve | prop | 3 | no |
| add_prop_polygon | prop | 3 | no |
| add_prop_span | prop | 3 | no |
| add_point_marking | marking | 3 | no |
| add_text_marking | marking | 3 | no |
| edit_surface | terrain | 3 | yes |
| get_selected_object | query | — | no |
| get_road_info | query | — | no |
| list_roads | query | — | no |
| list_junctions | query | — | no |
| export_opendrive | project | — | no |
| undo_last_action | project | — | no |

**30 tools total.** This is the complete v1 catalog — no tool is deferred.
