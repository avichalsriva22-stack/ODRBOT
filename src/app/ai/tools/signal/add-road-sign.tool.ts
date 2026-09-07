import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { RoadSignalFactory } from 'app/map/road-signal/road-signal.factory';
import { AddRoadSignalCommand } from 'app/commands/add-road-signal-command';
import { TvOrientation } from 'app/map/models/tv-common';
import { Asset, AssetType } from 'app/assets/asset.model';

const AVAILABLE_SIGNS = [
	'back_circle', 'back_diamond', 'back_square', 'chevron_left', 'chevron_right', 
	'construction_zone_ahead', 'curve_ahead', 'default', 'metal', 'no_entry', 
	'road_closed', 'sharp_left_curve_ahead', 'sharp_right_curve_ahead', 'slow', 
	'stop', 'two_way_traffic'
];

export class AddRoadSignTool implements AiTool {
	name = 'add_road_sign';
	description = 'Add a road sign (e.g. STOP, speed limit, yield) at a position on a road.';
	requiresPreview = false;
	category: import('../../models/ai-tool.model').AiToolCategory = 'signal';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Road ID' },
			sOffset: { type: 'number' as const, minimum: 0, description: 'Longitudinal position' },
			side: { type: 'string' as const, enum: ['left', 'right'], description: 'Side of the road' },
			signType: { type: 'string' as const, description: 'Type of sign' }
		},
		required: ['roadId', 'sOffset', 'side', 'signType']
	};

	constructor(private roadSignalFactory: RoadSignalFactory) {}

	validate(args: any, ctx: AiToolContext): void {
		const road = ctx.mapService.map.getRoad(args.roadId);
		if (!road) {
			throw new AiToolValidationError(`Road ID ${args.roadId} not found.`);
		}
		if (args.sOffset < 0 || args.sOffset > road.length) {
			throw new AiToolValidationError(`sOffset ${args.sOffset} is out of bounds [0, ${road.length}].`);
		}

		if (!AVAILABLE_SIGNS.includes(args.signType)) {
			// Find closest matches (simple substring or just list all)
			const matches = AVAILABLE_SIGNS.filter(s => s.includes(args.signType) || args.signType.includes(s)).slice(0, 5);
			const suggestions = matches.length > 0 ? matches : AVAILABLE_SIGNS.slice(0, 5);
			throw new AiToolValidationError(`Sign type '${args.signType}' not found in catalog. Did you mean: ${suggestions.join(', ')}?`);
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);

		const road = ctx.mapService.map.getRoad(args.roadId)!;
		
		const t = args.side === 'right' ? -2.0 : 2.0; 
		const roadCoord = road.getRoadCoord(args.sOffset, t);

		const dummyAsset = new Asset(AssetType.TEXTURE, args.signType, `assets/signs/${args.signType}.png`);
		
		const signal = this.roadSignalFactory.createSignalFromAsset(dummyAsset, roadCoord, args.signType);
		signal.orientation = args.side === 'right' ? TvOrientation.MINUS : TvOrientation.PLUS;

		const command = new AddRoadSignalCommand(road, signal);

		return {
			summary: `Added ${args.signType} sign on road ${args.roadId} at s=${args.sOffset} on the ${args.side} side.`,
			commands: [command],
			createdIds: [{ type: 'object', id: signal.id }]
		};
	}
}
