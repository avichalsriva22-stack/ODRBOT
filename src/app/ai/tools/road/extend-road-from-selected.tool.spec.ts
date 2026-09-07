import { ExtendRoadFromSelectedTool } from './extend-road-from-selected.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvContactPoint } from 'app/map/models/tv-common';
import { TvPosTheta } from 'app/map/models/tv-pos-theta';
import { Vector3 } from 'app/core/maths';

describe('ExtendRoadFromSelectedTool', () => {
	let tool: ExtendRoadFromSelectedTool;
	let context: AiToolContext;
	let mockRoad: TvRoad;

	beforeEach(() => {
		tool = new ExtendRoadFromSelectedTool();
		
		mockRoad = new TvRoad();
		Object.defineProperty(mockRoad, 'id', { value: 123, writable: true });
		spyOn(mockRoad, 'getEndPosTheta').and.returnValue({ position: new Vector3(10, 10, 0), hdg: 0 } as TvPosTheta);
		spyOn(mockRoad, 'getStartPosTheta').and.returnValue({ position: new Vector3(0, 0, 0), hdg: 0 } as TvPosTheta);
		spyOn(mockRoad.getLaneProfile(), 'getLaneSectionAt').and.returnValue({
			getLanes: () => [1, 2],
			leftLanes: [],
			rightLanes: [{}]
		} as any);

		context = {
			selection: { selectedRoadId: 123 },
			mapService: {
				map: {
					getRoad: (id: number) => id === 123 ? mockRoad : undefined
				}
			}
		} as any;
	});

	it('should throw validation error if no road is selected', () => {
		context.selection.selectedRoadId = undefined;
		expect(() => tool.validate({}, context)).toThrowError(AiToolValidationError);
	});

	it('should return AddObjectCommand containing a linked TvRoad in run', async () => {
		const result = await tool.run({
			contactPoint: 'end',
			length: 50,
			headingOffsetDegrees: 90
		}, context);

		expect(result.commands?.length).toBe(1);
		
		const command = result.commands![0] as AddObjectCommand;
		expect(command instanceof AddObjectCommand).toBe(true);
		
		const newRoad = (command as any).object as TvRoad;
		expect(newRoad instanceof TvRoad).toBe(true);
		expect(newRoad.length).toBe(50);
		expect(newRoad.predecessor?.element).toBe(mockRoad);
		expect(newRoad.predecessor?.contactPoint).toBe(TvContactPoint.END);
	});
});
