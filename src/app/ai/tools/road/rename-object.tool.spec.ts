/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { RenameObjectTool } from './rename-object.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvJunction } from 'app/map/models/junctions/tv-junction';
import { SetValueCommand } from 'app/commands/set-value-command';

describe( 'RenameObjectTool', () => {

	it( 'should validate correctly', () => {
		const tool = new RenameObjectTool();
		const road = new TvRoad( 'test' );
		const junction = { name: 'testJunction' } as any;

		const mockContext = {
			mapService: { map: { 
				getRoad: ( id: number ) => id === 1 ? road : undefined,
				getJunction: ( id: number ) => id === 2 ? junction : undefined
			} }
		} as unknown as AiToolContext;

		expect( () => tool.validate( { objectType: 'road', objectId: 1, name: 'NewRoad' }, mockContext ) ).not.toThrow();
		expect( () => tool.validate( { objectType: 'junction', objectId: 2, name: 'NewJunction' }, mockContext ) ).not.toThrow();
		
		expect( () => tool.validate( { objectType: 'road', objectId: 99, name: 'Missing' }, mockContext ) ).toThrowError( AiToolValidationError );
	} );

	it( 'should generate a SetValueCommand', async () => {
		const tool = new RenameObjectTool();
		const road = new TvRoad( 'OldRoad' );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		const result = await tool.run( { objectType: 'road', objectId: 1, name: 'NewRoadName' }, mockContext );

		expect( result.commands.length ).toBe( 1 );
		expect( result.commands[ 0 ] instanceof SetValueCommand ).toBeTrue();
		expect( result.summary ).toContain( 'NewRoadName' );
	} );

} );
