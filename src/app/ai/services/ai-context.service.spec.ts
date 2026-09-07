/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { TestBed } from '@angular/core/testing';
import { AiContextService } from './ai-context.service';
import { MapService } from 'app/services/map/map.service';
import { SelectionService } from 'app/tools/selection.service';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvMap } from 'app/map/models/tv-map.model';
import { TvRoadType, TvLaneType } from 'app/map/models/tv-common';
import { ToolManager } from 'app/managers/tool-manager';

describe( 'AiContextService', () => {

	let service: AiContextService;
	let mapServiceMock: jasmine.SpyObj<MapService>;
	let selectionServiceMock: jasmine.SpyObj<SelectionService>;
	let mockMap: TvMap;

	beforeEach( () => {

		mockMap = new TvMap();

		mapServiceMock = { map: mockMap } as any;

		selectionServiceMock = jasmine.createSpyObj( 'SelectionService', [ 'findSelectedObject', 'getLastSelectedObject' ] );
		selectionServiceMock.findSelectedObject.and.returnValue( undefined );
		selectionServiceMock.getLastSelectedObject.and.returnValue( undefined );

		TestBed.configureTestingModule( {
			providers: [
				AiContextService,
				{ provide: MapService, useValue: mapServiceMock },
				{ provide: SelectionService, useValue: selectionServiceMock }
			]
		} );

		service = TestBed.inject( AiContextService );
		ToolManager.clear();
		TvRoad.resetCounter( 1 );

	} );

	it( 'should handle empty map', () => {

		const ctx = service.buildContext();
		expect( ctx.roadCount ).toBe( 0 );
		expect( ctx.roadsSummary ).toEqual( [] );
		expect( ctx.truncated ).toBe( false );
		expect( ctx.selection.type ).toBe( 'none' );

	} );

	it( 'should truncate roads to 30 when no selection', () => {

		for ( let i = 0; i < 50; i++ ) {
			const road = new TvRoad( `Road_${ i }` );
			spyOn( road, 'getRoadPosition' ).and.returnValue( { x: i * 10, y: i * 10, z: 0, theta: 0, s: 0, t: 0 } as any );
			mockMap.addRoad( road );
		}

		const ctx = service.buildContext();
		expect( ctx.roadCount ).toBe( 50 );
		expect( ctx.roadsSummary.length ).toBe( 30 );
		expect( ctx.truncated ).toBe( true );

		// Since they are ordered by distance (i*10), it should have the first 30 (ids 1 to 30 usually, unless unordered)
		const ids = ctx.roadsSummary.map( r => r.id );
		expect( ids ).toContain( 1 );
		expect( ids ).toContain( 30 );
		expect( ids ).not.toContain( 50 );

	} );

	it( 'should prioritize selected road and its successors', () => {

		const roads = [];
		for ( let i = 0; i < 50; i++ ) {
			const road = new TvRoad( `Road_${ i }` );
			spyOn( road, 'getRoadPosition' ).and.returnValue( { x: 9999 + i, y: 9999 + i, z: 0, theta: 0, s: 0, t: 0 } as any );
			mockMap.addRoad( road );
			roads.push( road );
		}

		// Connect road 40 to road 41
		roads[ 40 ].setSuccessorRoadId = jasmine.createSpy().and.returnValue( roads[ 41 ].id );
		spyOn( roads[ 40 ], 'getSuccessorRoadId' ).and.returnValue( roads[ 41 ].id );
		spyOn( roads[ 40 ], 'getPredecessorRoadId' ).and.returnValue( undefined );

		// Select road 40
		selectionServiceMock.findSelectedObject.and.callFake( ( type ) => {
			if ( type === TvRoad as any ) return roads[ 40 ];
			return undefined;
		} );

		const ctx = service.buildContext();
		expect( ctx.roadCount ).toBe( 50 );
		expect( ctx.roadsSummary.length ).toBe( 30 );
		expect( ctx.truncated ).toBe( true );
		expect( ctx.selection.type ).toBe( 'road' );
		expect( ctx.selection.id ).toBe( roads[ 40 ].id );

		// Priority logic means road 40 and 41 must be in the truncated list,
		// despite their huge distance from origin (9999) compared to road 0.
		const includedIds = ctx.roadsSummary.map( r => r.id );
		expect( includedIds ).toContain( roads[ 40 ].id );
		expect( includedIds ).toContain( roads[ 41 ].id );

	} );

	it( 'should format AiRoadSummary correctly', () => {

		const road = new TvRoad( 'TestRoad' );
		road.setType( TvRoadType.TOWN, 50 );
		spyOn( road, 'getStartPosTheta' ).and.returnValue( { x: 10, y: 20, z: 0, hdg: Math.PI / 2, s: 0, t: 0 } as any );
		spyOn( road, 'getEndPosTheta' ).and.returnValue( { x: 10, y: 120, z: 0, hdg: 0, s: 100, t: 0 } as any );
		spyOn( road, 'getRoadPosition' ).and.returnValue( { x: 10, y: 70, z: 0, theta: 0, s: 50, t: 0 } as any );

		mockMap.addRoad( road );

		const ctx = service.buildContext();
		expect( ctx.roadsSummary.length ).toBe( 1 );

		const summary = ctx.roadsSummary[ 0 ];
		expect( summary.id ).toBe( road.id );
		expect( summary.name ).toBe( 'TestRoad' );
		expect( summary.maxSpeed ).toBe( 50 );
		expect( summary.roadType ).toBe( TvRoadType.TOWN );
		expect( summary.startPosition ).toEqual( { x: 10, y: 20 } );
		expect( summary.endPosition ).toEqual( { x: 10, y: 120 } );
		expect( summary.headingDegrees ).toBeCloseTo( 90, 1 );

		// Validate size is under 4000 tokens (approx 16000 chars) for a max size array
		for ( let i = 0; i < 29; i++ ) mockMap.addRoad( new TvRoad( `R${ i }` ) );
		const fullCtx = service.buildContext();
		const jsonStr = JSON.stringify( fullCtx );
		expect( jsonStr.length ).toBeLessThan( 16000 );

	} );

} );
