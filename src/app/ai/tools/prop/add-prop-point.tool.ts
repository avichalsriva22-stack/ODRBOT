import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { PropPointFactory } from 'app/map/prop-point/prop-point.factory';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { Vector3 } from 'app/core/maths';
import { MathUtils } from 'three';
import { Asset, AssetType } from 'app/assets/asset.model';

export class AddPropPointTool implements AiTool {
	name = 'add_prop_point';
	description = 'Place a single prop (3D asset, e.g. a tree, barrier, bench) at a specific position.';
	requiresPreview = false;
	category: import('../../models/ai-tool.model').AiToolCategory = 'prop';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			assetName: { type: 'string' as const, description: 'Name of the prop asset' },
			x: { type: 'number' as const, description: 'X coordinate' },
			y: { type: 'number' as const, description: 'Y coordinate' },
			z: { type: 'number' as const, description: 'Z coordinate' },
			rotationDegrees: { type: 'number' as const, description: 'Rotation in degrees' },
			scale: { type: 'number' as const, minimum: 0.1, maximum: 10, description: 'Scale multiplier' }
		},
		required: ['assetName', 'x', 'y']
	};

	constructor(private propPointFactory: PropPointFactory) {}

	private findAssetByName(name: string, ctx: AiToolContext): Asset | undefined {
		// Try to find the asset in AssetService's registered assets.
		// Since we can't search easily, we use a simple loop.
		const assetsMap = (ctx.mapService as any).assetService?.assets as Map<string, Asset>;
		if (!assetsMap) return undefined;
		for (const asset of assetsMap.values()) {
			if (asset.name === name || asset.assetName === name) {
				return asset;
			}
		}
		return undefined;
	}

	validate(args: any, ctx: AiToolContext): void {
		// Spec: "assetName resolves"
		// If we can't find it, we could throw, but for AI testing without an actual loaded project
		// we might need to be forgiving or throw.
		const asset = this.findAssetByName(args.assetName, ctx);
		if (!asset) {
			// Find closest names
			const assetsMap = (ctx.mapService as any).assetService?.assets as Map<string, Asset>;
			if (assetsMap) {
				const names = Array.from(assetsMap.values())
					.filter(a => a.type === AssetType.OBJECT || a.type === AssetType.MODEL)
					.map(a => a.assetName);
				const matches = names.filter(n => n.includes(args.assetName)).slice(0, 5);
				const suggestions = matches.length > 0 ? matches : names.slice(0, 5);
				throw new AiToolValidationError(`Asset '${args.assetName}' not found. Suggestions: ${suggestions.join(', ')}`);
			} else {
				throw new AiToolValidationError(`Asset '${args.assetName}' not found.`);
			}
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);

		const asset = this.findAssetByName(args.assetName, ctx)!;
		const position = new Vector3(args.x, args.y, args.z ?? 0);

		const prop = this.propPointFactory.createFromAsset(asset, position);
		if (!prop) {
			throw new Error(`Failed to instantiate prop for asset: ${args.assetName}`);
		}

		if (args.rotationDegrees !== undefined) {
			prop.rotateZ(MathUtils.degToRad(args.rotationDegrees));
		}
		
		if (args.scale !== undefined) {
			prop.scale.setScalar(args.scale);
		}

		const command = new AddObjectCommand(prop);

		return {
			summary: `Added prop '${args.assetName}' at (${args.x}, ${args.y}).`,
			commands: [command],
			createdIds: [{ type: 'object', id: prop.id }]
		};
	}
}
