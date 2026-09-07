import { Vector2, Vector3 } from 'three';
import { TvRoad } from 'app/map/models/tv-road.model';
import { Maths } from 'app/utils/maths';
import { TvContactPoint } from 'app/map/models/tv-common';
import { RoadFactory } from 'app/factories/road-factory.service';
import { SplineGeometryGenerator } from 'app/services/spline/spline-geometry-generator';
import { ControlPointFactory } from 'app/factories/control-point.factory';
import { Injectable } from '@angular/core';

export interface RoundaboutMakeOptions {
	center: Vector3;
	end?: Vector3;
	radius: number;
	armCount?: number;
	armLength?: number;
	laneCount?: number;
	roadFactory: RoadFactory;
	splineBuilder: SplineGeometryGenerator;
}

@Injectable({
	providedIn: 'root'
})
export class RoadCircleFactory {

	makeRoundabout(options: RoundaboutMakeOptions): { circleRoads: TvRoad[], armRoads: TvRoad[] } {
		const end = options.end || new Vector3(options.center.x + options.radius, options.center.y, options.center.z);
		
		const circleRoads = this.createCircularRoads(options.center, end, options.radius, options.roadFactory, options.splineBuilder);
		
		const armRoads: TvRoad[] = [];
		if (options.armCount && options.armCount > 0) {
			const armLength = options.armLength || 20;
			const angleStep = (Math.PI * 2) / options.armCount;
			for (let i = 0; i < options.armCount; i++) {
				const angle = i * angleStep;
				
				// Point on the circle
				const pCircleX = options.center.x + Math.cos(angle) * options.radius;
				const pCircleY = options.center.y + Math.sin(angle) * options.radius;
				const pCircle = new Vector3(pCircleX, pCircleY, options.center.z);

				// Point outside the circle
				const pFarX = options.center.x + Math.cos(angle) * (options.radius + armLength);
				const pFarY = options.center.y + Math.sin(angle) * (options.radius + armLength);
				const pFar = new Vector3(pFarX, pFarY, options.center.z);

				const armRoad = options.roadFactory.createDefaultRoad();
				
				// Add geometry line from pFar to pCircle (heading towards the center)
				const hdg = angle + Math.PI; // heading towards center
				const line = armRoad.getPlanView().addGeometryLine(0, pFar.x, pFar.y, hdg, armLength);
				
				const startPosTheta = line.getRoadCoord(0);
				const endPosTheta = line.getRoadCoord(armLength);

				const distance = armLength * 0.3;
				const pMid1 = startPosTheta.moveForward(distance).toVector3();
				const pMid2 = endPosTheta.moveForward(-distance).toVector3();
				
				armRoad.spline.addControlPoint(ControlPointFactory.createControlPoint(armRoad.spline, pFar));
				armRoad.spline.addControlPoint(ControlPointFactory.createControlPoint(armRoad.spline, pMid1));
				armRoad.spline.addControlPoint(ControlPointFactory.createControlPoint(armRoad.spline, pMid2));
				armRoad.spline.addControlPoint(ControlPointFactory.createControlPoint(armRoad.spline, pCircle));

				options.splineBuilder.buildGeometry(armRoad.spline);
				armRoads.push(armRoad);
			}
		}
		
		return { circleRoads, armRoads };
	}

	private createCircularRoads(centre: Vector3, end: Vector3, radius: number, roadFactory: RoadFactory, splineBuilder: SplineGeometryGenerator): TvRoad[] {
		const p1 = new Vector2( centre.x, centre.y );
		const p2 = new Vector2( end.x, end.y );

		let start = end;
		let hdg = new Vector2().subVectors( p2, p1 ).angle() + Maths.PI2;

		const circumference = 2 * Math.PI * radius;
		const arcLength = circumference * 0.25;
		const curvature = 1 / radius;

		const points = []
		const roads: TvRoad[] = [];

		for ( let i = 0; i < 4; i++ ) {
			const road = roads[ i ] = roadFactory.createDefaultRoad();
			const arc = road.getPlanView().addGeometryArc( 0, start.x, start.y, hdg, arcLength, curvature );

			const startPosTheta = arc.getRoadCoord( 0 );
			const endPosTheta = arc.getRoadCoord( arcLength );

			const distance = start.distanceTo( arc.endV3 ) * 0.3;

			const a2 = startPosTheta.moveForward( +distance );
			const b2 = endPosTheta.moveForward( -distance );

			points.push( ControlPointFactory.createControlPoint( road.spline, start ) );
			points.push( ControlPointFactory.createControlPoint( road.spline, a2.toVector3() ) );
			points.push( ControlPointFactory.createControlPoint( road.spline, b2.toVector3() ) );
			points.push( ControlPointFactory.createControlPoint( road.spline, arc.endV3.clone() ) );

			start = arc.endV3;
			hdg += Maths.PI2;
		}

		this.addPointToRoads( roads, points, splineBuilder );
		return roads;
	}

	private addPointToRoads(roads: TvRoad[], points: any[], splineBuilder: SplineGeometryGenerator): void {
		if ( roads.length != 4 ) return;
		if ( points.length != 16 ) return;

		for ( let j = 0; j < 4; j++ ) {
			const road = roads[ j ];
			road.spline.addControlPoint( points[ j * 4 + 0 ] );
			road.spline.addControlPoint( points[ j * 4 + 1 ] );
			road.spline.addControlPoint( points[ j * 4 + 2 ] );
			road.spline.addControlPoint( points[ j * 4 + 3 ] );

			splineBuilder.buildGeometry( road.spline );

			if ( ( j + 1 ) < roads.length ) {
				const nextRoad = roads[ j + 1 ];
				road.linkSuccessorRoad( nextRoad, TvContactPoint.START );
			} else {
				const firstRoad = roads[ 0 ];
				road.linkSuccessorRoad( firstRoad, TvContactPoint.START );
			}
		}
	}
}
