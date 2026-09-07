import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { Vector3 } from 'app/core/maths';
import { DragSplineCommand } from 'app/commands/drag-spline-command';

export class SetRoadCurveTool implements AiTool {
	name = 'set_road_curve';
	description = 'Changes the entire road curvature mathematically by inserting or modifying a middle control point to form an arc of a given radius (or curvature intensity).';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'road';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'ID of the road to curve' },
			radius: { type: 'number' as const, description: 'Radius of the curve in meters. Positive for right curve, negative for left curve.' }
		},
		required: ['roadId', 'radius']
	};

	validate(args: any, ctx: AiToolContext): void {
		const road = ctx.mapService.map.getRoad(args.roadId);
		if (!road) {
			throw new AiToolValidationError(`Road ID ${args.roadId} not found.`);
		}
		if (Math.abs(args.radius) < 5) {
			throw new AiToolValidationError(`Radius ${args.radius} is too tight. Please use a larger radius.`);
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);
		
		const road = ctx.mapService.map.getRoad(args.roadId)!;
		const spline = road.spline;
		let points = spline.getControlPoints();

		if (points.length < 2) {
			throw new AiToolValidationError('Road spline has less than 2 points, cannot curve.');
		}

		const startP = points[0].getPosition();
		const endP = points[points.length - 1].getPosition();
		
		// Midpoint
		const midP = startP.clone().add(endP).multiplyScalar(0.5);
		
		// Direction vector from start to end
		const dir = endP.clone().sub(startP);
		const length = dir.length();
		
		if (length === 0) {
			throw new AiToolValidationError('Road has zero length.');
		}
		
		dir.normalize();
		
		// Perpendicular vector
		const perp = new Vector3(-dir.y, dir.x, 0);
		
		// Sagitta (chord to arc height) calculation: s = R - sqrt(R^2 - (L/2)^2)
		const R = args.radius;
		const halfL = length / 2;
		
		let s = 0;
		if (Math.abs(R) >= halfL) {
			s = R - (Math.sign(R) * Math.sqrt(R*R - halfL*halfL));
		} else {
			// If radius is too small for the chord, just make it a semi-circle
			s = R;
		}

		// Offset midpoint by sagitta along perpendicular
		const curveP = midP.clone().add(perp.multiplyScalar(s));

		if (points.length === 2) {
			const newPoints = [points[0].getPosition().clone(), midP, points[1].getPosition().clone()];
			spline.clearControlPoints();
			newPoints.forEach(p => spline.addControlPoint(p));
			points = spline.getControlPoints();
		}

		const oldPositions = points.map(p => p.getPosition().clone());
		const newPositions = oldPositions.map(p => p.clone());
		const middleIndex = Math.floor(points.length / 2);
		newPositions[middleIndex] = curveP;

		const command = new DragSplineCommand(spline, newPositions, oldPositions);

		return {
			summary: `Applied curve to road ${args.roadId} with radius ${args.radius}.`,
			commands: [command]
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		
		return {
			description: `Curving road ${args.roadId} mathematically with radius ${args.radius}.`,
			diff: [
				{
					field: `Road Curve`,
					before: `Current`,
					after: `Radius: ${args.radius}`
				}
			]
		};
	}
}
