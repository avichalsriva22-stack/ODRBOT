/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Vector3 } from 'app/core/maths';
import { Position } from '../position';
import { CatalogReference } from '../tv-catalogs';
import { PositionType } from '../tv-enums';
import { Orientation } from '../tv-orientation';

export class TrajectoryPosition extends Position {

	public readonly label: string = 'Trajectory Position';
	public readonly type = PositionType.Lane;
	public readonly isDependent: boolean = false;

	constructor (
		public s: number,
		public t: number,
		public trajectoryRef: CatalogReference,
		orientaion: Orientation = null,
	) {

		super( null, orientaion );

	}

	getVectorPosition (): Vector3 {
		// Without a concrete trajectory reference in the editor, we use a fallback
		return new Vector3( this.s, this.t, 0 );
	}

	updateFromWorldPosition ( position: Vector3, orientation: Orientation ): void {
		// Cannot accurately map back to a Trajectory without the trajectory data in the editor
	}

}
