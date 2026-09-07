/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { ListRoadsTool } from './list-roads.tool';
import { AiToolContext } from '../../models/ai-tool.model';

describe( 'ListRoadsTool', () => {

	let aiContextService: any;
	let tool: ListRoadsTool;

	beforeEach(() => {
		aiContextService = jasmine.createSpyObj('AiContextService', ['buildContext', 'mapRoadSummary']);
		aiContextService.mapRoadSummary.and.returnValue({ id: 1, name: 'R1', length: 100 });
		tool = new ListRoadsTool(aiContextService);
	});

	it( 'should return list of roads', async () => {
		
		const mockRoad = {
			id: 1, name: 'R1', getLength: () => 100,
			getLaneProfile: () => ( { getLaneSectionAt: () => ( { getLeftLaneCount: () => 1, getRightLaneCount: () => 1 } ) } )
		};

		const mockContext = {
			mapService: { map: { getRoads: () => [ mockRoad ] } }
		} as unknown as AiToolContext;

		const result = await tool.run( {}, mockContext );
		
		expect( result.commands.length ).toBe( 0 );
		expect( result.data.length ).toBe( 1 );
		expect( result.data[0].id ).toBe( 1 );

	} );

} );
