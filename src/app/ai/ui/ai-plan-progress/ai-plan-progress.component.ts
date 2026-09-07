/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AiPlan } from '../../models/ai-plan.model';
import { AiToolOrchestratorService } from '../../services/ai-tool-orchestrator.service';
import { MatDialog } from '@angular/material/dialog';

@Component( {
	selector: 'app-ai-plan-progress',
	templateUrl: './ai-plan-progress.component.html',
	styleUrls: [ './ai-plan-progress.component.scss' ],
} )
export class AiPlanProgressComponent implements OnInit, OnDestroy {

	@Input() planId!: string;
	@Input() initialPlan?: AiPlan;

	plan: AiPlan | null = null;
	showDetails = true;
	private sub?: Subscription;

	constructor ( private orchestrator: AiToolOrchestratorService ) {}

	ngOnInit (): void {
		if ( this.initialPlan ) {
			this.plan = this.initialPlan;
		}
		this.sub = this.orchestrator.watchPlan( this.planId ).pipe(
			filter( p => p !== null && p.id === this.planId )
		).subscribe( p => {
			this.plan = p;
		} );
	}

	ngOnDestroy (): void {
		this.sub?.unsubscribe();
	}

	get progressPercent (): number {
		if ( !this.plan ) return 0;
		const done = this.plan.steps.filter( s => s.status === 'succeeded' || s.status === 'failed' || s.status === 'skipped' ).length;
		return Math.round( ( done / this.plan.steps.length ) * 100 );
	}

	get succeededCount (): number {
		return this.plan?.steps.filter( s => s.status === 'succeeded' ).length ?? 0;
	}

	get totalSteps (): number {
		return this.plan?.steps.length ?? 0;
	}

	get isCompleted (): boolean {
		return this.plan?.status === 'completed' || this.plan?.status === 'completed_with_errors';
	}

	get isPaused (): boolean {
		return this.plan?.status === 'paused';
	}

	stepIcon ( status: string ): string {
		switch ( status ) {
			case 'succeeded': return 'check_circle';
			case 'failed': return 'error';
			case 'skipped': return 'remove_circle_outline';
			case 'running': return 'sync';
			case 'pending': return 'radio_button_unchecked';
			default: return 'radio_button_unchecked';
		}
	}

	stepIconColor ( status: string ): string {
		switch ( status ) {
			case 'succeeded': return '#66bb6a';
			case 'failed': return '#ef5350';
			case 'skipped': return '#757575';
			case 'running': return '#ffa726';
			case 'pending': return 'rgba(255,255,255,0.25)';
			default: return 'rgba(255,255,255,0.25)';
		}
	}

	onPause (): void {
		if ( this.plan ) this.orchestrator.pause( this.plan.id );
	}

	onResume (): void {
		if ( this.plan ) this.orchestrator.resume( this.plan.id );
	}

	onAbort (): void {
		if ( !this.plan ) return;
		const confirmed = window.confirm( 'Abort the plan? Steps that have already run will remain on the map and can be undone with Ctrl+Z.' );
		if ( confirmed ) {
			this.orchestrator.abort( this.plan.id );
		}
	}

	toggleDetails (): void {
		this.showDetails = !this.showDetails;
	}
}
