import { Injectable } from '@angular/core';
import { AiEventBusService, AiEvent, PlanGeneratedEvent } from './ai-event-bus.service';
import { AiPlan } from '../models/ai-plan.model';

declare const electronFs: any;

export interface AiSessionTrace {
	traceId: string;
	timestamp: string;
	prompt?: string;
	plan?: AiPlan;
	executionTimeline: AiEvent[];
	finalStatus?: string;
}

@Injectable({
	providedIn: 'root'
})
export class AiTelemetryService {
	
	private activeTraces = new Map<string, AiSessionTrace>();

	constructor(private eventBus: AiEventBusService) {
		this.eventBus.events$.subscribe(event => this.handleEvent(event));
	}

	private handleEvent(event: AiEvent): void {
		const planId = event.planId;
		if (!this.activeTraces.has(planId)) {
			this.activeTraces.set(planId, {
				traceId: planId,
				timestamp: new Date(event.timestamp).toISOString(),
				executionTimeline: []
			});
		}

		const trace = this.activeTraces.get(planId)!;
		trace.executionTimeline.push(event);

		if (event.type === 'PlanGenerated') {
			trace.prompt = (event as PlanGeneratedEvent).prompt;
			trace.plan = (event as PlanGeneratedEvent).plan;
		}

		if (event.type === 'PlanExecutionFinished') {
			trace.finalStatus = event.status;
		}

		// Save progressively on EVERY event so we don't lose the trace if a silent crash happens
		this.saveTraceToFile(trace);

		if (event.type === 'PlanExecutionFinished') {
			this.activeTraces.delete(planId);
		}
	}

	private async saveTraceToFile(trace: AiSessionTrace): Promise<void> {
		try {
			const win = window as any;
			if (!win || !win.electronFs) {
				console.error('[AiTelemetry] electronFs is missing on window. Cannot save trace!');
				return;
			}
			
			const fsPromises = win.electronFs.fsPromises();
			const remote = win.electronFs.remote();
			const path = win.electronFs.path();
			
			const userDataPath = win.electronFs.getUserDataPath();
			const dirPath = path.join(userDataPath, 'ai-traces');
			
			try {
				await fsPromises.mkdir(dirPath, { recursive: true });
			} catch (e) {}

			const fileName = `trace-${trace.traceId}.json`;
			const filePath = path.join(dirPath, fileName);

			await fsPromises.writeFile(filePath, JSON.stringify(trace, null, 2), 'utf-8');
			console.log(`[AiTelemetry] Saved trace to ${filePath}`);
		} catch (error: any) {
			console.error('[AiTelemetry] Failed to save trace:', error);
			try {
				const win = window as any;
				const fsP = win.electronFs.fsPromises();
				await fsP.appendFile('C:\\Users\\hp\\Downloads\\debug.txt', `Trace save failed: ${error.stack || error.message || error}\n`, 'utf-8');
			} catch (e) {}
		}
	}
}
