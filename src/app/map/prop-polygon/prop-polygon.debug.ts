/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Injectable } from '@angular/core';
import { PropPolygon } from "./prop-polygon.model";
import { SplineDebugService } from "../../services/debug/spline-debug.service";
import { HasSplineDebugService } from '../../services/debug/has-spline-debug.service';

@Injectable( {
	providedIn: 'root'
} )
export class PropPolygonDebugService extends HasSplineDebugService<PropPolygon> {

	constructor ( debug: SplineDebugService ) {
		super( debug );
	}

}
