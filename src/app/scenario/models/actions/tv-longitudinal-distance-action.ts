/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Time } from '../../../core/time';
import { Maths } from '../../../utils/maths';
import { DynamicConstraints } from '../dynamic-constraints';
import { ScenarioEntity } from '../entities/scenario-entity';
import { PrivateAction } from '../private-action';
import { ActionType } from '../tv-enums';


/**
 * This action activates a controller for the longitudinal behavior
 * of an entity in a way that a given distance or time gap to the
 * reference entity is maintained. The dynamic behavior of the
 * controller may be limited by parameters. Choosing a non-limited
 * dynamic behavior represents a rigid time or distance connection
 * between actor and object.
 */
export class LongitudinalDistanceAction extends PrivateAction {

	public label: string = 'Distance';
	public actionType: ActionType = ActionType.Private_Longitudinal_Distance;

	private startTime: number;
	private targetDistance: number;

	constructor (
		public targetEntity: string,
		public value: number,
		public valueType: 'distance' | 'timeGap',
		public freespace = false,
		public continous = false,
		public dynamicConstraints: DynamicConstraints,
	) {
		super();
	}

	reset (): void {
		super.reset();

		this.startTime = null;
		this.targetDistance = null;
	}

	execute ( entity: ScenarioEntity ): void {

		if ( this.isCompleted ) return;

		if ( !this.startTime ) {
			this.startTime = Time.time;
		}

		const targetEntity = this.getEntity( this.targetEntity );

		if ( this.valueType === 'distance' ) {
			this.targetDistance = this.value;
		} else if ( this.valueType === 'timeGap' ) {
			this.targetDistance = this.value * entity.getCurrentSpeed();
		}

		// calculate current distance to the target
		const currentDistance = entity.getCurrentPosition().distanceTo( targetEntity.getCurrentPosition() );
		const targetEntitySpeed = targetEntity.getCurrentSpeed();

		// calculate new speed and set it on the entity
		let newSpeed = this.dynamicConstraints.computeSpeed(
			currentDistance, this.targetDistance,
			entity.getCurrentSpeed(), targetEntity.getCurrentSpeed()
		);

		entity.setSpeed( newSpeed );

		const distanceReached = Maths.approxEquals( currentDistance, this.targetDistance, 0.1 );

		// check if the action is completed
		if ( !this.continous && this.valueType === 'distance' && distanceReached ) {

			this.actionCompleted();

		} else if ( this.valueType == 'timeGap' && distanceReached && !this.continous ) {
			this.actionCompleted();
		}

		// Debug.log( 'LongitudinalDistanceAction', entity.name, currentDistance, this.targetDistance, entity.getCurrentSpeed() );
	}
}
