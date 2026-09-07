/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Curve, LineCurve, Vector2, Vector3 } from "three";
import { TvGeometryType } from '../tv-common';
import { TvPosTheta } from '../tv-pos-theta';
import { TvAbstractRoadGeometry } from './tv-abstract-road-geometry';

export class TvLineGeometry extends TvAbstractRoadGeometry {

	public geometryType: TvGeometryType = TvGeometryType.LINE;

	constructor ( s: number, x: number, y: number, hdg: number, length: number ) {

		super( s, x, y, hdg, length );

	}

	get start (): Vector2 {

		return new Vector2( this.x, this.y );

	}

	get end (): Vector2 {

		return this.getPositionAt( this.endS ).toVector2();

	}

	get endV3 (): Vector3 {

		return this.getPositionAt( this.endS ).toVector3();

	}

	getCurve (): Curve<Vector2> {

		return new LineCurve( this.start, this.end );

	}

	computeVars (): void {

		/*nothing*/

	}

	clone (): TvLineGeometry {

		return new TvLineGeometry( this.s, this.x, this.y, this.hdg, this.length );

	}

	getRoadCoord ( s: number ): TvPosTheta {

		const ds = s - this.s;

		const x = this.x + Math.cos( this.hdg ) * ds;

		const y = this.y + Math.sin( this.hdg ) * ds;

		return new TvPosTheta( x, y, this.hdg, s );

	}

	public getNearestPointFrom ( x: number, y: number, posTheta?: TvPosTheta ): Vector2 {

		return super.getNearestPointFrom( x, y, posTheta );

	}

	getStCoordinates ( posTheta: TvPosTheta ): Vector2 {

		const objPosition = new Vector2( posTheta.x, posTheta.y );

		// get nearest point on road from this new point
		const nearestPointOnRoad = this.getNearestPointFrom( objPosition.x, objPosition.y );

		// Debug.log( nearestPointOnRoad );

		// s value is simply the distance from start to the nearestPointOnRoad
		const start = new Vector2( this.x, this.y );
		const s = start.distanceTo( nearestPointOnRoad );

		const lineDir = new Vector2( Math.cos( this.hdg ), Math.sin( this.hdg ) );
		const toObj = new Vector2().subVectors( objPosition, start );
		const cross = lineDir.x * toObj.y - lineDir.y * toObj.x;

		// t value is the distance from nearPointOnRoad to object position, signed by cross product
		const tMagnitude = nearestPointOnRoad.distanceTo( objPosition );
		const t = cross >= 0 ? tMagnitude : -tMagnitude;

		posTheta.s = s;
		posTheta.t = t;
		posTheta.hdg = this.hdg;

		return new Vector2( s, t );
	}

}
