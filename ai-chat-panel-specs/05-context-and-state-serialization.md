# 05 — Context and State Serialization

## 1. Purpose

The LLM has no visual access to the 3D viewport. Everything it "knows" about
the current map comes from a JSON snapshot sent with every user turn, built
by `AiContextService` (`src/app/ai/services/ai-context.service.ts`). This doc
defines exactly what goes in that snapshot and its size budget.

## 2. Size budget

- Target: **≤ 4,000 tokens** (~16,000 characters) for the context block,
  regardless of map size, so that context cost doesn't dominate every turn.
- Enforced via the caps in §4 below (per-list truncation), not by trying to
  compress structure.

## 3. Schema

```ts
export interface AiMapContext {
	mapName: string;
	roadCount: number;
	junctionCount: number;
	selection: {
		type: 'road' | 'junction' | 'lane' | 'none';
		id?: number;
		summary?: string;         // e.g. "Road-14, 100m, 1 right lane (driving), speed 40"
	};
	activeTool: string;           // ToolType name, e.g. "LaneWidth", or "Pointer" if none
	/** Roads near the selection or near (0,0) if nothing selected. Capped, see §4. */
	roadsSummary: AiRoadSummary[];
	junctionsSummary: AiJunctionSummary[];
	/** True if roadsSummary/junctionsSummary were truncated from the full map. */
	truncated: boolean;
}

export interface AiRoadSummary {
	id: number;
	name: string;
	length: number;
	startPosition: { x: number; y: number };
	endPosition: { x: number; y: number };
	headingDegrees: number;       // heading at start, for "extend/continue" reasoning
	leftLanes: { id: number; type: string; width: number }[];
	rightLanes: { id: number; type: string; width: number }[];
	maxSpeed: number;
	roadType: string;
	isJunctionRoad: boolean;
}

export interface AiJunctionSummary {
	id: number;
	name: string;
	type: string;                 // TvJunctionType
	connectingRoadIds: number[];
	position: { x: number; y: number };
}
```

## 4. Selection & truncation rules

`AiContextService.buildContext()`:

1. Always includes `mapName`, `roadCount`, `junctionCount`, `selection`, `activeTool` (cheap, O(1) or O(selection)).
2. For `roadsSummary`:
   - If something is selected: include the selected road/junction's roads
     plus all roads directly linked to it (predecessor/successor via
     `TvRoad` link getters) — this is almost always what "extend this road"
     / "the road next to it" refers to.
   - Else: include the `roadCount <= 30 ? all roads : the 30 roads nearest (0,0)`.
   - Hard cap: **30 entries**. If more exist, set `truncated: true` and the
     system prompt (doc 06 §5) instructs the model to use the `list_roads`
     or `get_road_info` query tools for anything not in the initial context.
3. Same pattern for `junctionsSummary`, cap **15 entries**.
4. Recompute on every `sendMessage()` call (not cached across turns) — map
   state may have changed due to the AI's own previous tool calls or manual
   user edits between messages. Cheap enough: this is a read-only scan over
   already-in-memory objects, no parsing.

## 5. Reading the map (implementation notes)

All fields above are derivable from existing, already-inspected APIs — no new
map-model methods are required except where noted:

- `MapService.roads`, `MapService.junctions` — existing getters.
- `road.getLength()`, `road.getSpline()` for start/end position + heading —
  existing.
- `road.getLaneProfile().getLaneSectionAt(0).getLeftLanes()/getRightLanes()`
  for lane summaries — existing (used by `RoadWidthService` already).
- `road.maxSpeed`, `road.type` — existing fields (used by `RoadFactory`/
  `RoadMakeOptions`).
- **New**: a `road.isLinkedTo(otherRoadId)` or equivalent — if not already
  present as a simple accessor, add a 5-line helper in
  `src/app/map/models/tv-road.model.ts` (`getPredecessorRoadId()`,
  `getSuccessorRoadId()`) that reads the existing `TvLink` structure
  (`src/app/map/models/tv-link.ts`) — do not duplicate link-tracking state.

## 6. What is NOT sent to the LLM

- Raw OpenDRIVE XML (too large, too low-signal per token).
- Full lane geometry/spline control points (the LLM never needs raw
  coordinates of curve control points; it only ever specifies endpoints/
  headings for new geometry, per doc 03's Tier 2 tool schemas).
- 3D asset/mesh data, textures, materials.
- Any file-system paths (security — see doc 07 §1).

## 7. Formatting for the LLM

`AiContextService.buildContext()` returns the typed object above;
`AiConversationService` (doc 06 §3) is responsible for embedding it as a
system-turn or context block. Use compact JSON (`JSON.stringify`, no pretty
printing) to save tokens — the LLM does not need human-readable indentation.
