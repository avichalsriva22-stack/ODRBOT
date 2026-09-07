/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { TvConsole } from 'app/core/utils/console';
import { Maths } from 'app/utils/maths';
import { EnumHelper } from '../../../map/models/tv-common';
import { DynamicsDimension, DynamicsShape } from '../tv-enums';
import { XmlElement } from "../../../importers/xml.element";

export class TransitionDynamics {

	constructor (
		public dynamicsShape: DynamicsShape = DynamicsShape.step,
		public value: number = 0,
		public dynamicsDimension: DynamicsDimension = DynamicsDimension.time
	) {

	}

	static fromXML ( xml: XmlElement ): TransitionDynamics {

		const shape = EnumHelper.stringToDynamics( xml.attr_shape || xml.attr_dynamicsShape || 'step' );

		const dimensionValue = parseFloat( xml.attr_rate || xml.attr_time || xml.attr_distance || xml.attr_value || 0 );

		const dimension = EnumHelper.stringToDimension( xml.attr_dimension || xml.attr_dynamicsDimension || 'time' );

		return new TransitionDynamics( shape, dimensionValue, dimension );

	}

	calculateSpeed ( initialSpeed: number, targetSpeed: number, elapsedTime: number ): number {

		let newSpeed = initialSpeed;

		// let speedChange = targetSpeed - initialSpeed;  // calculate the required change in speed

		switch ( this.dynamicsShape ) {

			case DynamicsShape.step:
				newSpeed = this.stepCalculation( initialSpeed, targetSpeed, elapsedTime );
				break;

			case DynamicsShape.linear:
				newSpeed = this.linearCalculation( initialSpeed, targetSpeed, elapsedTime );
				break;

			case DynamicsShape.sinusoidal:
				newSpeed = this.sinusoidalCalculation( initialSpeed, targetSpeed, elapsedTime );
				break;

			case DynamicsShape.cubic:
				newSpeed = this.cubicCalculation( initialSpeed, targetSpeed, elapsedTime );
				break;
		}

		return newSpeed;
	}

	calculateOffset ( initialOffset: number, targetOffset: number, elapsedTime: number ): number {

		let newLaneOffset = initialOffset;

		switch ( this.dynamicsShape ) {

			case DynamicsShape.step:
				newLaneOffset = this.stepCalculation( initialOffset, targetOffset, elapsedTime );
				break;

			case DynamicsShape.linear:
				newLaneOffset = this.linearCalculation( initialOffset, targetOffset, elapsedTime );
				break;

			case DynamicsShape.sinusoidal:
				newLaneOffset = this.sinusoidalCalculation( initialOffset, targetOffset, elapsedTime );
				break;

			case DynamicsShape.cubic:
				newLaneOffset = this.cubicCalculation( initialOffset, targetOffset, elapsedTime );
				break;
		}

		return newLaneOffset;

	}

	getDimensionAsString (): "distance" | "time" | "rate" | "value" {

		switch ( this.dynamicsDimension ) {

			case DynamicsDimension.distance:
				return 'distance';

			case DynamicsDimension.time:
				return 'time';

			case DynamicsDimension.rate:
				return 'rate';

			default:
				TvConsole.warn( 'unknown dynamics dimension' + this.dynamicsDimension );
				return 'value';

		}

	}

	getDimensionSuffix (): "m" | "s" | "m/s" | "" {

		switch ( this.dynamicsDimension ) {

			case DynamicsDimension.distance:
				return 'm';

			case DynamicsDimension.time:
				return 's';

			case DynamicsDimension.rate:
				return 'm/s';

			default:
				TvConsole.warn( 'unknown dynamics dimension' + this.dynamicsDimension );
				return '';

		}

	}

	private stepCalculation ( initialSpeed: number, targetSpeed: number, elapsedTime: number ): number {

		if ( this.dynamicsDimension === DynamicsDimension.time ) {

			return elapsedTime >= this.value ? targetSpeed : initialSpeed;

		} else if ( this.dynamicsDimension === DynamicsDimension.rate ) {

			return elapsedTime * this.value >= 1 ? targetSpeed : initialSpeed;

		} else if ( this.dynamicsDimension === DynamicsDimension.distance ) {

			return elapsedTime * initialSpeed >= this.value ? targetSpeed : initialSpeed;
		}

	}

	private linearCalculation ( initialSpeed: number, targetSpeed: number, elapsedTime: number ): any {

		if ( this.dynamicsDimension === DynamicsDimension.time ) {

			let speedDifference = targetSpeed - initialSpeed;

			let transitionRate = speedDifference / Math.max( this.value, 0.00001 );

			let newSpeed = initialSpeed + transitionRate * elapsedTime;

			if ( speedDifference > 0 ) {
				return Maths.clamp( newSpeed, initialSpeed, targetSpeed );
			} else {

				return Maths.clamp( newSpeed, targetSpeed, initialSpeed );
			}

		} else if ( this.dynamicsDimension === DynamicsDimension.rate ) {

			return initialSpeed + ( targetSpeed - initialSpeed ) * this.value * elapsedTime;

		} else if ( this.dynamicsDimension === DynamicsDimension.distance ) {

			// distance based interpolation without tracking distance. Fallback to step.
			return elapsedTime > 1 ? targetSpeed : initialSpeed;

		}

	}

	private sinusoidalCalculation ( initialSpeed: number, targetSpeed: number, elapsedTime: number ): number {

		if ( this.dynamicsDimension === DynamicsDimension.time ) {

			let phase = Math.PI * elapsedTime / Math.max( this.value, 0.00001 );

			return initialSpeed + ( targetSpeed - initialSpeed ) * ( 1 - Math.cos( phase ) ) / 2;

		} else if ( this.dynamicsDimension === DynamicsDimension.rate ) {

			let phase = Math.PI * this.value * elapsedTime;

			return initialSpeed + ( targetSpeed - initialSpeed ) * ( 1 - Math.cos( phase ) ) / 2;

		} else if ( this.dynamicsDimension === DynamicsDimension.distance ) {

			// This case needs to be defined based on how distance should affect speed.
			return elapsedTime > 1 ? targetSpeed : initialSpeed;
		}
	}

	private cubicCalculation ( initialValue: number, targetValue: number, elapsedTime: number ): number {
		if ( this.dynamicsDimension === DynamicsDimension.time ) {
			const t = Maths.clamp( elapsedTime / Math.max( this.value, 0.00001 ), 0, 1 );
			const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow( -2 * t + 2, 3 ) / 2;
			return initialValue + ( targetValue - initialValue ) * ease;
		}
		
		// Fallback for distance and rate
		return this.linearCalculation( initialValue, targetValue, elapsedTime );
	}
}
