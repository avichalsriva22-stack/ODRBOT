/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { GetSelectedObjectTool } from './get-selected-object.tool';
import { AiToolContext } from '../../models/ai-tool.model';

describe( 'GetSelectedObjectTool', () => {

	let aiContextService: any;
	let tool: GetSelectedObjectTool;

	beforeEach(() => {
		aiContextService = jasmine.createSpyObj('AiContextService', ['buildContext', 'mapRoadSummary']);
		aiContextService.mapRoadSummary.and.returnValue({ id: 42, length: 100, type: 'town' });
		aiContextService.buildContext.and.returnValue({ selection: { type: 'road', id: 42 } });
		tool = new GetSelectedObjectTool(aiContextService);
	});

	it( 'should return selected road details', async () => {
		
		const mockContext = {
			selection: { selectedRoadId: 42 },
			mapService: {
				map: {
					getRoad: ( id: number ) => ( { name: 'TestRoad', getLength: () => 100 } )
				}
			}
		} as unknown as AiToolContext;

		const result = await tool.run( {}, mockContext );
		
		expect( result.commands.length ).toBe( 0 );
		expect( result.data.type ).toBe( 'road' );
		expect( result.data.id ).toBe( 42 );

	} );

} );
