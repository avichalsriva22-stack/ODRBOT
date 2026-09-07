/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AiPlan, AiPlanStep } from '../../models/ai-plan.model';
import { AiPlannerService } from '../../services/ai-planner.service';

export interface AiPlanEditDialogData {
	plan: AiPlan;
}

@Component( {
	selector: 'app-ai-plan-edit-dialog',
	templateUrl: './ai-plan-edit-dialog.component.html',
	styleUrls: [ './ai-plan-edit-dialog.component.scss' ],
} )
export class AiPlanEditDialogComponent implements OnInit {

	plan: AiPlan;
	reviseText = '';
	editingArgs: Record<string, string> = {};

	constructor (
		@Inject( MAT_DIALOG_DATA ) public data: AiPlanEditDialogData,
		private dialogRef: MatDialogRef<AiPlanEditDialogComponent>,
		private plannerService: AiPlannerService
	) {
		this.plan = data.plan;
	}

	ngOnInit (): void {
		// Initialize editable args (scalars only)
		this.plan.steps.forEach( step => {
			this.editingArgs[ step.id ] = JSON.stringify( step.args, null, 2 );
		} );
	}

	humanizeTool ( toolName: string ): string {
		return toolName.replace( /_/g, ' ' ).replace( /\b\w/g, c => c.toUpperCase() );
	}

	onRemoveStep ( step: AiPlanStep ): void {
		const dependents = this.plan.steps.filter( s => s.dependsOn.includes( step.id ) );

		if ( dependents.length > 0 ) {
			const names = dependents.map( d => d.description ).join( ', ' );
			const ok = window.confirm(
				`Removing this step will also remove: ${ names }.\n\nContinue?`
			);
			if ( !ok ) return;
			// Cascade remove
			for ( const dep of dependents ) {
				this.onRemoveStep( dep );
			}
		}

		const idx = this.plan.steps.indexOf( step );
		if ( idx > -1 ) {
			this.plan.steps.splice( idx, 1 );
			delete this.editingArgs[ step.id ];
		}
	}

	applyArgEdit ( step: AiPlanStep ): void {
		try {
			step.args = JSON.parse( this.editingArgs[ step.id ] );
		} catch {
			alert( 'Invalid JSON for step args.' );
		}
	}

	onSave (): void {
		this.dialogRef.close( 'saved' );
	}

	onCancel (): void {
		this.dialogRef.close( 'cancelled' );
	}
}
