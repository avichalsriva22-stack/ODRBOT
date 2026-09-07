/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { GetRoadInfoTool } from './get-road-info.tool';
import { AiToolContext } from '../../models/ai-tool.model';

describe( 'GetRoadInfoTool', () => {

	let aiContextService: any;
	let tool: GetRoadInfoTool;

	beforeEach(() => {
		aiContextService = jasmine.createSpyObj('AiContextService', ['buildContext', 'mapRoadSummary']);
		aiContextService.mapRoadSummary.and.returnValue({ id: 10, length: 50, type: 'town' });
		tool = new GetRoadInfoTool(aiContextService);
	});

	it( 'should return road info', async () => {
		
		const mockContext = {
			mapService: {
				map: {
					hasRoad: ( id: number ) => true,
					getRoad: ( id: number ) => ( { 
						id,
						name: 'Test',
						getLength: () => 50,
						type: [ { type: 'town' } ],
						getLaneProfile: () => ( {
							getLaneSectionAt: ( s: number ) => ( { getLanes: () => [1, 2] } )
						} )
					} )
				}
			}
		} as unknown as AiToolContext;

		const result = await tool.run( { roadId: 10 }, mockContext );
		
		expect( result.commands.length ).toBe( 0 );
		expect( result.data.id ).toBe( 10 );
		expect( result.data.length ).toBe( 50 );
		expect( result.data.type ).toBe( 'town' );

	} );

} );
