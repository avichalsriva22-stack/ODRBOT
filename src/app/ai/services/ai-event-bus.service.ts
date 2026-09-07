import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { AiPlan } from '../models/ai-plan.model';
import { AiToolRunResult } from '../models/ai-tool.model';

export type AiEventType =
	| 'PlanGenerated'
	| 'PlanExecutionStarted'
	| 'StepExecutionStarted'
	| 'StepExecutionSuccess'
	| 'StepExecutionFailed'
	| 'PlanExecutionFinished';

export interface AiEventBase {
	type: AiEventType;
	timestamp: number;
	planId: string;
}

export interface PlanGeneratedEvent extends AiEventBase {
	type: 'PlanGenerated';
	prompt: string;
	plan: AiPlan;
}

export interface PlanExecutionStartedEvent extends AiEventBase {
	type: 'PlanExecutionStarted';
	totalSteps: number;
}

export interface StepExecutionStartedEvent extends AiEventBase {
	type: 'StepExecutionStarted';
	stepId: string;
	toolName: string;
	resolvedArgs: Record<string, any>;
}

export interface StepExecutionSuccessEvent extends AiEventBase {
	type: 'StepExecutionSuccess';
	stepId: string;
	toolName: string;
	result: AiToolRunResult;
}

export interface StepExecutionFailedEvent extends AiEventBase {
	type: 'StepExecutionFailed';
	stepId: string;
	toolName: string;
	error: Error;
	recovered: boolean;
}

export interface PlanExecutionFinishedEvent extends AiEventBase {
	type: 'PlanExecutionFinished';
	status: string;
}

export type AiEvent =
	| PlanGeneratedEvent
	| PlanExecutionStartedEvent
	| StepExecutionStartedEvent
	| StepExecutionSuccessEvent
	| StepExecutionFailedEvent
	| PlanExecutionFinishedEvent;


@Injectable({
	providedIn: 'root'
})
export class AiEventBusService {
	private eventSubject = new Subject<AiEvent>();

	get events$(): Observable<AiEvent> {
		return this.eventSubject.asObservable();
	}

	emit(event: AiEvent): void {
		this.eventSubject.next(event);
	}
}
