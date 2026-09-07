/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { ListJunctionsTool } from './list-junctions.tool';
import { AiToolContext } from '../../models/ai-tool.model';

describe( 'ListJunctionsTool', () => {

	let aiContextService: any;
	let tool: ListJunctionsTool;

	beforeEach(() => {
		aiContextService = jasmine.createSpyObj('AiContextService', ['buildContext', 'mapJunctionSummary']);
		aiContextService.mapJunctionSummary.and.returnValue({ id: 1, name: 'J1', type: 'default', connections: 1 });
		tool = new ListJunctionsTool(aiContextService);
	});

	it( 'should return list of junctions', async () => {

		const mockJunction = {
			id: 1, name: 'J1', type: 'default',
			getConnections: () => [ { connectingRoad: 5 } ]
		};

		const mockContext = {
			mapService: { map: { getJunctions: () => [ mockJunction ] } }
		} as unknown as AiToolContext;

		const result = await tool.run( {}, mockContext );
		
		expect( result.commands.length ).toBe( 0 );
		expect( result.data.length ).toBe( 1 );
		expect( result.data[0].id ).toBe( 1 );

	} );

} );
