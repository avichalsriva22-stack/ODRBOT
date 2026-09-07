import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { SetValueCommand } from 'app/commands/set-value-command';
import { Vector3 } from 'app/core/maths';
import { SurfaceFactory } from 'app/map/surface/surface.factory';
import { Maths } from 'app/utils/maths';
import { Surface } from 'app/map/surface/surface.model';
import { CatmullRomSpline } from 'app/core/shapes/catmull-rom-spline';

export class EditSurfaceTool implements AiTool {
	name = 'edit_surface';
	description = 'Edit terrain/surface properties (material, elevation) within a polygonal area. Dual-mode: if surfaceId is provided, edits that surface; otherwise creates a new one.';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'terrain';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			surfaceId: { type: 'string' as const, description: 'ID of existing surface to edit (if any)' },
			points: { 
				type: 'array' as const, 
				items: { 
					type: 'object' as const,
					properties: {
						x: { type: 'number' as const, description: 'X coordinate' },
						y: { type: 'number' as const, description: 'Y coordinate' }
					},
					required: ['x', 'y'],
					description: 'Point coordinate'
				},
				description: 'Array of points forming the polygon boundary (required for new surfaces)'
			},
			material: { 
				type: 'string' as const, 
				enum: ['grass','concrete','cobble','asphalt','pavement','gravel','soil'], 
				description: 'Material type' 
			},
			elevation: { type: 'number' as const, description: 'Elevation of the surface (Z offset)' }
		},
		required: []
	};

	constructor(private surfaceFactory: SurfaceFactory) {}

	validate(args: any, ctx: AiToolContext): void {
		if (args.surfaceId) {
			const surface = ctx.mapService.map.getSurfaces().find(s => s.uuid === args.surfaceId);
			if (!surface) {
				throw new AiToolValidationError(`Surface with ID ${args.surfaceId} not found.`);
			}
		} else {
			if (!args.points || args.points.length < 3) {
				throw new AiToolValidationError('points array with at least 3 points is required for a new surface.');
			}
			if (!args.material) {
				throw new AiToolValidationError('material is required for a new surface.');
			}
		}

		if (args.points && args.points.length >= 3) {
			// Preconditions: polygon non-self-intersecting
			const pointsArr = args.points.map((p: any) => [p.x, p.y]);
			if (!Maths.isSimplePolygon(pointsArr)) {
				throw new AiToolValidationError('The provided points form a self-intersecting polygon.');
			}
		}
	}

	async preview(args: any, ctx: AiToolContext): Promise<import('../../models/ai-tool.model').AiToolPreviewResult> {
		const diff = [];
		if (args.surfaceId) {
			const surface = ctx.mapService.map.getSurfaces().find(s => s.uuid === args.surfaceId);
			if (surface) {
				if (args.material && args.material !== surface.materialGuid) {
					diff.push({ field: 'materialGuid', before: surface.materialGuid, after: args.material });
				}
				if (args.points) {
					diff.push({ field: 'spline points', before: surface.spline.controlPointPositions.length, after: args.points.length });
				}
			}
		} else {
			diff.push({ field: 'new surface', before: null, after: 'created' });
		}
		return { description: 'Edit surface details', diff };
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);

		const commands: any[] = [];
		let createdOrEditedId = args.surfaceId;
		const diff: AiDiffEntry[] = [];

		if (args.surfaceId) {
			// Edit existing surface
			const surface = ctx.mapService.map.getSurfaces().find(s => s.uuid === args.surfaceId)!;

			if (args.material && args.material !== surface.materialGuid) {
				// diff.push({ field: 'materialGuid', before: surface.materialGuid, after: args.material });
				commands.push(new SetValueCommand(surface, 'materialGuid', args.material));
			}

			if (args.points && args.points.length >= 3) {
				// Rebuild spline
				const oldSpline = surface.spline;
				const newSpline = new CatmullRomSpline(true, 'catmullrom', 0);
				const elevation = args.elevation ?? 0;
				for (const pt of args.points) {
					newSpline.addControlPoint(SurfaceFactory.createSurfacePoint(new Vector3(pt.x, pt.y, elevation), surface));
				}
				// diff.push({ field: 'spline points', before: oldSpline.controlPointPositions.length, after: newSpline.controlPointPositions.length });
				commands.push(new SetValueCommand(surface, 'spline', newSpline));
			}
		} else {
			// Create new surface
			const elevation = args.elevation ?? 0;
			const newSpline = new CatmullRomSpline(true, 'catmullrom', 0);
			const surface = this.surfaceFactory.createSurface(args.material, undefined, newSpline);
			
			for (const pt of args.points) {
				newSpline.addControlPoint(SurfaceFactory.createSurfacePoint(new Vector3(pt.x, pt.y, elevation), surface));
			}

			commands.push(new AddObjectCommand(surface));
			createdOrEditedId = surface.uuid;
		}

		return {
			summary: args.surfaceId ? `Edited surface ${args.surfaceId}.` : `Created new surface.`,
			commands,
			createdIds: createdOrEditedId ? [{ type: 'object' as const, id: createdOrEditedId }] : []
		};
	}
}
