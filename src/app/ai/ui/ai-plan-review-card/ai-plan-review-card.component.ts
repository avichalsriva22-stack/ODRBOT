/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AiPlan, AiPlanStep } from '../../models/ai-plan.model';
import { AiToolOrchestratorService } from '../../services/ai-tool-orchestrator.service';
import { AiPlanEditDialogComponent } from '../ai-plan-edit-dialog/ai-plan-edit-dialog.component';

@Component( {
	selector: 'app-ai-plan-review-card',
	templateUrl: './ai-plan-review-card.component.html',
	styleUrls: [ './ai-plan-review-card.component.scss' ],
} )
export class AiPlanReviewCardComponent implements OnInit {

	@Input() plan!: AiPlan;

	expanded = false;

	constructor (
		private orchestrator: AiToolOrchestratorService,
		private dialog: MatDialog
	) {}

	ngOnInit (): void {}

	toggleExpand (): void {
		this.expanded = !this.expanded;
	}

	isUnresolved ( step: AiPlanStep ): boolean {
		return step.hasUnresolvedReferences;
	}

	humanizeTool ( toolName: string ): string {
		return toolName.replace( /_/g, ' ' ).replace( /\b\w/g, c => c.toUpperCase() );
	}

	onReject (): void {
		this.plan.status = 'aborted';
	}

	onEdit (): void {
		this.dialog.open( AiPlanEditDialogComponent, {
			width: '700px',
			data: { plan: this.plan }
		} );
	}

	onRunPlan (): void {
		this.orchestrator.executePlan( this.plan );
	}
}
