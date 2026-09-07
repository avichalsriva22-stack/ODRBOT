/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Injectable, Injector } from '@angular/core';
import { AiTool, AiJsonSchema } from '../models/ai-tool.model';
import { GetSelectedObjectTool } from './query/get-selected-object.tool';
import { GetRoadInfoTool } from './query/get-road-info.tool';
import { ListRoadsTool } from './query/list-roads.tool';
import { ListJunctionsTool } from './query/list-junctions.tool';
import { ExportOpendriveTool } from './project/export-opendrive.tool';
import { UndoLastActionTool } from './project/undo-last-action.tool';
import { SetLaneWidthTool } from './lane/set-lane-width.tool';
import { SetLaneHeightTool } from './lane/set-lane-height.tool';
import { SetLaneMarkingTool } from './lane/set-lane-marking.tool';
import { AddLaneTool } from './lane/add-lane.tool';
import { RemoveLaneTool } from './lane/remove-lane.tool';
import { SetRoadSpeedTool } from './road/set-road-speed.tool';
import { SetRoadTypeTool } from './road/set-road-type.tool';
import { SetRoadElevationTool } from './road/set-road-elevation.tool';
import { SetRoadSuperElevationTool } from './road/set-road-super-elevation.tool';
import { RenameObjectTool } from './road/rename-object.tool';
import { AddPropPointTool } from './prop/add-prop-point.tool';
import { AddPropCurveTool } from './prop/add-prop-curve.tool';
import { AddPropPolygonTool } from './prop/add-prop-polygon.tool';
import { AddPropSpanTool } from './prop/add-prop-span.tool';
import { AddPointMarkingTool } from './marking/add-point-marking.tool';
import { AddTextMarkingTool } from './marking/add-text-marking.tool';
import { EditSurfaceTool } from './terrain/edit-surface.tool';
import { AddRoadSignTool } from './signal/add-road-sign.tool';
import { AddTrafficSignalTool } from './signal/add-traffic-signal.tool';
import { CreateRoadTool } from './road/create-road.tool';
import { ExtendRoadFromSelectedTool } from './road/extend-road-from-selected.tool';
import { CreateJunctionTool } from './junction/create-junction.tool';
import { CreateRoundaboutTool } from './junction/create-roundabout.tool';
import { ExporterService } from 'app/services/exporter.service';

import { DeleteObjectTool } from './project/delete-object.tool';
import { MoveObjectTool } from './project/move-object.tool';
import { MoveSplinePointTool } from './road/move-spline-point.tool';
import { SetRoadCurveTool } from './road/set-road-curve.tool';
import { SetRoadWidthTool } from './road/set-road-width.tool';
import { EditCrosswalkTool } from './road/edit-crosswalk.tool';
import { SmoothenJunctionTool } from './junction/smoothen-junction.tool';
import { EditRoundaboutTool } from './junction/edit-roundabout.tool';
import { ConnectionFactory } from 'app/factories/connection.factory';
import { LinkRoadsTool } from './road/link-roads.tool';

import { AiContextService } from '../services/ai-context.service';
import { AddCrosswalkTool } from './road/add-crosswalk.tool';
import { FactoryServiceProvider } from 'app/core/providers/factory-service.provider';
import { ToolType } from 'app/tools/tool-types.enum';
import { PropPointFactory } from 'app/map/prop-point/prop-point.factory';
import { PropCurveFactory } from 'app/modules/prop-curve/services/prop-curve.factory';
import { PropPolygonFactory } from 'app/map/prop-polygon/prop-polygon.factory';
import { RoadSignalFactory } from 'app/map/road-signal/road-signal.factory';
import { SurfaceFactory } from 'app/map/surface/surface.factory';
import { JunctionToolHelper } from 'app/modules/junction/junction-tool.helper';
import { RoadCircleFactory } from 'app/factories/road-circle.factory';
import { RoadFactory } from 'app/factories/road-factory.service';
import { SplineGeometryGenerator } from 'app/services/spline/spline-geometry-generator';

/**
 * Central registry: name -> AiTool (doc 04 §1).
 *
 * Phase 1: empty shell. Phase 3+ populates via registerAll().
 * Produces the exact shape Anthropic's Messages API `tools` param expects.
 */
@Injectable( { providedIn: 'root' } )
export class AiToolRegistry {

	private tools = new Map<string, AiTool>();

	constructor ( private injector: Injector ) {
		this.registerAll();
	}

	private registerAll (): void {
		const aiContextService = this.injector.get(AiContextService);
		const factoryService = this.injector.get(FactoryServiceProvider);
		const propPointFactory = factoryService.createFromToolType(ToolType.PropPoint) as PropPointFactory;
		const propCurveFactory = factoryService.createFromToolType(ToolType.PropCurve) as PropCurveFactory;
		const propPolygonFactory = factoryService.createFromToolType(ToolType.PropPolygon) as PropPolygonFactory;
		const roadSignalFactory = this.injector.get(RoadSignalFactory);
		const surfaceFactory = this.injector.get(SurfaceFactory);
		const junctionToolHelper = this.injector.get(JunctionToolHelper);
		const roadCircleFactory = this.injector.get(RoadCircleFactory);
		const roadFactory = this.injector.get(RoadFactory);
		const splineBuilder = this.injector.get(SplineGeometryGenerator);
		const exporterService = this.injector.get(ExporterService);
		const connectionFactory = this.injector.get(ConnectionFactory);

		const tools: AiTool<any>[] = [
			new GetSelectedObjectTool(aiContextService),
			new GetRoadInfoTool(aiContextService),
			new ListRoadsTool(aiContextService),
			new ListJunctionsTool(aiContextService),
			new ExportOpendriveTool(exporterService),
			new UndoLastActionTool(),
			new SetLaneWidthTool(),
			new SetLaneHeightTool(),
			new SetLaneMarkingTool(),
			new AddLaneTool(),
			new RemoveLaneTool(),
			new SetRoadSpeedTool(),
			new SetRoadTypeTool(),
			new SetRoadElevationTool(),
			new SetRoadSuperElevationTool(),
			new RenameObjectTool(),
			new AddPropPointTool(propPointFactory),
			new AddPropCurveTool(propCurveFactory),
			new AddPropPolygonTool(propPolygonFactory),
			new AddPropSpanTool(),
			new AddPointMarkingTool(),
			new AddTextMarkingTool(roadSignalFactory),
			new EditSurfaceTool(surfaceFactory),
			new AddCrosswalkTool(),
			new AddRoadSignTool(roadSignalFactory),
			new AddTrafficSignalTool(roadSignalFactory),
			new CreateRoadTool(),
			new ExtendRoadFromSelectedTool(),
			new CreateJunctionTool(junctionToolHelper),
			new CreateRoundaboutTool(roadCircleFactory, roadFactory, splineBuilder, connectionFactory),
			new DeleteObjectTool(),
			new MoveObjectTool(),
			new MoveSplinePointTool(),
			new SetRoadCurveTool(),
			new SetRoadWidthTool(),
			new EditCrosswalkTool(),
			new SmoothenJunctionTool(connectionFactory),
			new EditRoundaboutTool(roadCircleFactory, roadFactory, splineBuilder, connectionFactory),
			new LinkRoadsTool()
		];
		tools.forEach( t => this.register( t ) );
	}

	register ( tool: AiTool ): void {
		if ( this.tools.has( tool.name ) ) {
			throw new Error( `Duplicate AI tool name registered: ${ tool.name }` );
		}
		this.tools.set( tool.name, tool );
	}

	get ( name: string ): AiTool | undefined {
		return this.tools.get( name );
	}

	getAll (): AiTool[] {
		return Array.from( this.tools.values() );
	}

	/** Produces the exact shape Anthropic's Messages API `tools` param expects. */
	getAnthropicToolSchemas (): { name: string; description: string; input_schema: AiJsonSchema }[] {
		return this.getAll().map( t => ( {
			name: t.name,
			description: t.description,
			input_schema: t.parameters,
		} ) );
	}

	/** Filters by AiSettings.advancedToolsEnabled — Tier 2/3 tools are excluded when false. */
	getEnabledToolSchemas ( advancedEnabled: boolean ): ReturnType<AiToolRegistry['getAnthropicToolSchemas']> {
		// Tier-1 + query + project tool names (populated in Phase 3)
		const tier1AndQueryNames = new Set<string>( [
			'get_selected_object',
			'get_road_info',
			'list_roads',
			'list_junctions',
			'export_opendrive',
			'undo_last_action',
			'set_lane_width',
			'set_lane_height',
			'set_lane_marking',
			'add_lane',
			'remove_lane',
			'set_road_speed',
			'set_road_type',
			'set_road_elevation',
			'set_road_super_elevation',
			'rename_object',
			'delete_object',
			'move_object',
			'move_spline_point',
			'set_road_curve',
			'set_road_width',
			'edit_crosswalk',
			'smoothen_junction',
			'edit_roundabout',
			'link_roads'
		] );

		// When no tier 1 names are registered yet, return all (avoids empty-set filtering before Phase 3)
		if ( tier1AndQueryNames.size === 0 ) {
			return this.getAnthropicToolSchemas();
		}

		return this.getAnthropicToolSchemas().filter( s =>
			advancedEnabled || tier1AndQueryNames.has( s.name ) );
	}
}
