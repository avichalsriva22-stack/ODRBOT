/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Injectable } from '@angular/core';
import { MapService } from 'app/services/map/map.service';
import { ToolManager } from 'app/managers/tool-manager';
import { ToolType } from 'app/tools/tool-types.enum';
import { SelectionService } from 'app/tools/selection.service';
import { AiToolContext, AiSelectionSnapshot } from '../models/ai-tool.model';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvJunction } from 'app/map/models/junctions/tv-junction';

/**
 * Builds the tool-facing AiToolContext (doc 04 §3).
 *
 * This is separate from AiContextService (doc 05) which builds the
 * LLM-facing JSON. This service provides live references (MapService,
 * selection snapshot) for tool validate/run calls.
 *
 * ASSUMPTION: Selection state is read from SelectionService which tracks
 * objects selected via MapEvents.objectSelected/objectUnselected. We read
 * TvRoad and TvJunction from the selected objects map. If no specific
 * selection mechanism exists for lanes, we derive it from the last
 * selected object if it is a lane.
 */
@Injectable( { providedIn: 'root' } )
export class AiToolContextBuilderService {

	constructor (
		private mapService: MapService,
		private selectionService: SelectionService,
	) {}

	build (): AiToolContext {

		return {
			mapService: this.mapService,
			selection: this.buildSelectionSnapshot(),
		};

	}

	private buildSelectionSnapshot (): AiSelectionSnapshot {

		const snapshot: AiSelectionSnapshot = {};

		// Read active tool type
		const currentTool = ToolManager.getCurrentTool();
		if ( currentTool?.toolType !== undefined ) {
			snapshot.activeTool = ToolType[ currentTool.toolType ];
		}

		// Read selected road
		const selectedRoad = this.selectionService.findSelectedObject<TvRoad>( TvRoad as any );
		if ( selectedRoad ) {
			snapshot.selectedRoadId = selectedRoad.id;
		}

		// Read selected junction
		const selectedJunction = this.selectionService.findSelectedObject<TvJunction>( TvJunction as any );
		if ( selectedJunction ) {
			snapshot.selectedJunctionId = selectedJunction.id;
		}

		// For lane selection, we check the last selected object.
		// Lane objects may not be registered by constructor in SelectionService,
		// so we inspect the last selected object to see if it has lane properties.
		const lastSelected = this.selectionService.getLastSelectedObject();
		if ( lastSelected && lastSelected.id !== undefined && lastSelected.laneSection ) {
			snapshot.selectedLaneId = lastSelected.id;
			snapshot.selectedLaneSectionS = lastSelected.laneSection?.s;
		}

		return snapshot;
	}
}
