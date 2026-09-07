/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Vector3 } from 'app/core/maths';
import { Position } from '../position';
import { PositionType } from '../tv-enums';
import { Orientation } from '../tv-orientation';

export class RelativeRoadPosition extends Position {

	readonly label: string = 'RelativeRoadPosition';
	readonly type: PositionType = PositionType.RelativeRoad;
	readonly isDependent: boolean = true;


	constructor (
		public entity: string,
		public roadId: number,
		public ds: number,
		public dt: number,
		orientation: Orientation
	) {
		super( null, orientation );
	}

	getVectorPosition (): Vector3 {
		return new Vector3();
	}

	updateFromWorldPosition ( position: Vector3, orientation: Orientation ): void {
		// Not implemented for relative positions in the editor.
	}

}
