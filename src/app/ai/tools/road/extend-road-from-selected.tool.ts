import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { RoadFactory, RoadMakeOptions } from 'app/factories/road-factory.service';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvContactPoint } from 'app/map/models/tv-common';
import { Maths } from 'app/utils/maths';

export class ExtendRoadFromSelectedTool implements AiTool {
	name = 'extend_road_from_selected';
	description = 'Create a new road that connects to the end (or start) of the currently selected road, continuing in the same or a specified heading.';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'road';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'ID of the road to extend (optional if a road is currently selected)' },
			length: { type: 'number' as const, description: 'Length of the extension' },
			contactPoint: { type: 'string' as const, enum: ['start', 'end'], description: 'Which end of the road to extend from' },
			headingOffsetDegrees: { type: 'number' as const, description: 'Heading change relative to the connection point. Use 90 or -90 to make a perpendicular turn (e.g., for corners or T-junctions). Default is 0 (straight continuation).' },
			leftLaneCount: { type: 'integer' as const, description: 'Optional lane count override' },
			rightLaneCount: { type: 'integer' as const, description: 'Optional lane count override' },
			laneWidth: { type: 'number' as const, description: 'Optional lane width override' }
		},
		required: ['contactPoint', 'length']
	};

	validate(args: any, ctx: AiToolContext): void {
		const roadId = args.roadId ?? ctx.selection.selectedRoadId;
		if (!roadId) {
			throw new AiToolValidationError('No road is selected or specified via roadId — ask the user to select a road first, or use create_road with explicit coordinates');
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);
		
		const roadId = args.roadId ?? ctx.selection.selectedRoadId;
		const selectedRoad = ctx.mapService.map.getRoad(roadId);
		if (!selectedRoad) {
			throw new AiToolValidationError('Selected road not found');
		}

		const contact = args.contactPoint === 'start' ? TvContactPoint.START : TvContactPoint.END;
		const offsetHdg = (args.headingOffsetDegrees ?? 0) * Maths.Deg2Rad;
		
		let posTheta;
		if (contact === TvContactPoint.START) {
			posTheta = selectedRoad.getStartPosTheta();
			posTheta.hdg += Math.PI; // Reverse heading to go outwards from start
		} else {
			posTheta = selectedRoad.getEndPosTheta();
		}

		const laneSection = selectedRoad.getLaneProfile().getLaneSectionAt(0);
		const options = new RoadMakeOptions();
		options.length = args.length;
		options.leftLaneCount = args.leftLaneCount ?? laneSection.getLeftLanes().length;
		options.rightLaneCount = args.rightLaneCount ?? laneSection.getRightLanes().length;
		options.leftWidth = args.laneWidth ?? 3.6;
		options.rightWidth = args.laneWidth ?? 3.6;
		options.position = posTheta.position;
		options.hdg = posTheta.hdg + offsetHdg;

		const newRoad = RoadFactory.makeRoad(options);
		
		// Set predecessor so RoadLinkManager automatically links them when added
		newRoad.setPredecessorRoad(selectedRoad, contact);

		const command = new AddObjectCommand(newRoad);

		return {
			summary: `Extended road ${selectedRoad.id} by ${options.length}m from ${args.contactPoint}.`,
			commands: [command],
			createdIds: [{ type: 'road', id: newRoad.id }]
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		return {
			description: `Extending selected road from ${args.contactPoint} by ${args.length}m.`,
			diff: [
				{
					field: 'New Road Extension',
					before: 'None',
					after: `Length ${args.length}m`
				}
			]
		};
	}
}
