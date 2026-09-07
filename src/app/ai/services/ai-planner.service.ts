import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { AiPlan, AiPlanStep } from '../models/ai-plan.model';
import { AiToolRegistry } from '../tools/ai-tool-registry.service';
import { AiLlmClientService, AiStreamEvent } from './ai-llm-client.service';
import { AiMapContext } from './ai-context.service';
import { AiImageAttachment } from '../models/ai-message.model';
import { AiSettingsService } from './ai-settings.service';
import { AiEventBusService } from './ai-event-bus.service';
import { AiTelemetryService } from './ai-telemetry.service';

const SUBMIT_PLAN_TOOL = {
	name: 'submit_plan',
	description: 'Submit the full ordered list of steps needed to accomplish the requested build. Each step must map to exactly one available tool call. Do not include steps for tools that do not exist in the provided tool list.',
	input_schema: {
		type: 'object',
		properties: {
			steps: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						description: { type: 'string', description: 'Short human-readable label for this step.' },
						toolName: { type: 'string' },
						args: { type: 'object', additionalProperties: true, description: 'REQUIRED: The concrete arguments for the tool. You MUST populate ALL required parameters defined in the tool\'s parameter schema. NEVER leave this as an empty object {} if the tool has required parameters. For example, create_roundabout requires centerX, centerY, radius, and armCount — you must provide numeric values for all of them. Use ${stepN.createdIds[0].id} to reference an id created by an earlier step.' },
						dependsOnStepIndices: { type: 'array', items: { type: 'integer' } },
					},
					required: ['description', 'toolName', 'args', 'dependsOnStepIndices'],
				},
			},
			summary: { type: 'string', description: 'One-paragraph plain-language summary of the overall plan, for the user to review.' },
		},
		required: ['steps', 'summary'],
	} as any,
};

@Injectable({ providedIn: 'root' })
export class AiPlannerService {
	private plans = new Map<string, AiPlan>();

	constructor(
		private llmClient: AiLlmClientService,
		private toolRegistry: AiToolRegistry,
		private settings: AiSettingsService,
		private eventBus: AiEventBusService,
		private telemetry: AiTelemetryService
	) {}

	getPlan(id: string): AiPlan | undefined {
		return this.plans.get(id);
	}

	async generatePlan(goalText: string, context: AiMapContext, images?: AiImageAttachment[], history: any[] = []): Promise<AiPlan> {
		const toolSchemas = this.toolRegistry.getEnabledToolSchemas(true);
		
		let systemPrompt = `You are planning a multi-step map-building task for Truevision Designer.
You will NOT execute anything yourself — you only produce an ordered list
of tool calls via submit_plan. Another system will execute your plan step
by step and verify each result before proceeding.

Rules:
1. Break the goal into the smallest reasonable set of steps using ONLY the
   tools listed. Prefer composite tools (create_junction, create_roundabout, etc.
   — see their descriptions) over manually sequencing primitive tools, when a
   composite tool fits the request — they are more reliable.
2. Compute concrete coordinates, headings, and lengths yourself from the
   map context provided. Do not leave placeholder values like "TBD" in args.
   CRITICAL: The "args" object for each step MUST contain ALL required
   parameters defined in that tool's schema with concrete values (numbers,
   strings, etc.). An empty args object {} will cause the step to fail.
   For example, if using create_roundabout, you MUST include centerX,
   centerY, radius, and armCount with real numeric values.
3. If a later step needs the id of something an earlier step creates, use
   the exact placeholder syntax: "\${stepN.createdIds[0].id}" (N = 1-based
   step index). Do not invent ids.
4. List dependsOnStepIndices for any step that structurally requires an
   earlier step to have completed (referenced ids, or spatial adjacency
   that must exist first, e.g. a junction step depends on all its arm-road
   steps).
5. If the request is underspecified in a way that would produce a poor
   result (e.g. "build an intersection" with no location given and nothing
   selected), make a reasonable assumption (e.g. place it at the origin, or
   extend from the selected road) and state the assumption plainly in the
   summary rather than blocking on a question — the user reviews the plan
   before anything runs and can reject it.
6. Keep the plan under 60 steps. If the request is larger than that (e.g.
   "build a whole city"), plan only a clearly-bounded first piece and say
   so explicitly in the summary, suggesting the user ask for the next piece
   once this one is done.
7. If reference images were provided, describe in the summary what you
   listing steps, so the user can correct misreadings before execution.

Available tools (name, description, schema): ${JSON.stringify(toolSchemas)}
Current map context: ${JSON.stringify(context)}`;

		if (images && images.length > 0) {
			systemPrompt += `\n\nOne or more reference images are attached. Use them to infer: approximate number of roads/arms, rough relative angles and lengths, presence of features like crosswalks, medians, or roundabouts, and lane counts if visible. Convert relative/visual proportions into concrete meters and degrees using reasonable real-world road-design defaults (e.g. a standard lane is ~3.5m wide, a typical urban block face is 80-150m) — state these assumptions in the summary. If the image is ambiguous or you are not confident in a specific measurement, say so in the summary rather than inventing false precision.`;
		}

		const contentBlocks: any[] = [];
		if (images && images.length > 0) {
			for (const img of images) {
				contentBlocks.push({
					type: 'image',
					source: { type: 'base64', media_type: img.mediaType, data: img.base64 }
				});
			}
		}
		if (goalText) {
			contentBlocks.push({ type: 'text', text: goalText });
		}

		const request = {
			model: this.settings.current.model,
			system: systemPrompt,
			messages: [...history, { role: 'user', content: contentBlocks }] as any[],
			tools: [SUBMIT_PLAN_TOOL, ...toolSchemas] as any[],
			maxTokens: 4096,
			tool_choice: { type: 'tool', name: 'submit_plan' }
		};

		console.warn('--- AI PLANNER REQUEST ---', JSON.stringify(request.messages, null, 2));

		return new Promise((resolve, reject) => {
			let jsonBuffer = '';
			
			this.llmClient.streamCompletion(request as any).subscribe({
				next: (event: AiStreamEvent) => {
					if (event.type === 'tool_use_input_delta') {
						jsonBuffer += event.partialJson;
					} else if (event.type === 'error') {
						reject(new Error(event.error.message));
					}
				},
				error: (err) => reject(err),
				complete: () => {
					let planData: any = {};
					try {
						console.warn('--- AI PLANNER RAW RESPONSE ---', jsonBuffer);
						planData = JSON.parse(jsonBuffer);
					} catch (e) {
						// Try to salvage malformed JSON (OpenRouter sometimes injects XML tags at the end)
						let salvaged = false;
						
						// Match either actual array or stringified array
						const stepsMatch = jsonBuffer.match(/"steps"\s*:\s*(\[.*\]|"\[.*\]")/s);
						if (stepsMatch) {
							let extracted = stepsMatch[1];
							if (extracted.startsWith('"') && extracted.endsWith('"')) {
								// It was a stringified array, unescape it
								try {
									extracted = JSON.parse(extracted);
								} catch { /* ignore */ }
							}
							
							try {
								planData.steps = typeof extracted === 'string' ? JSON.parse(extracted) : extracted;
								salvaged = true;
								console.warn('--- AI PLANNER SALVAGED JSON ---', planData);
							} catch { /* ignore */ }
						}
						
						if (!salvaged) {
							reject(new Error('Failed to parse plan from LLM: ' + String(e) + '\nRaw: ' + jsonBuffer));
							return;
						}
					}
					
					try {
						console.warn('--- AI PLANNER PARSED DATA ---', JSON.stringify(planData, null, 2));
						const plan = this.parsePlan(goalText, planData);

						this.eventBus.emit({
							type: 'PlanGenerated',
							planId: plan.id,
							timestamp: Date.now(),
							prompt: goalText,
							plan: plan
						});

						resolve(plan);
					} catch (e) {
						reject(new Error('Failed to process plan steps: ' + String(e)));
					}
				}
			});
		});
	}

	private parsePlan(goalText: string, planData: any): AiPlan {
		const steps: AiPlanStep[] = [];
		let rawSteps = planData.steps || [];
		
		if (!Array.isArray(rawSteps)) {
			console.warn('LLM returned steps as non-array:', rawSteps);
			try {
				rawSteps = JSON.parse(rawSteps);
			} catch {
				rawSteps = [];
			}
			if (!Array.isArray(rawSteps)) rawSteps = [];
		}

		const stepIdMap = new Map<number, string>();
		
		for (let i = 0; i < rawSteps.length; i++) {
			stepIdMap.set(i + 1, uuidv4());
		}

		for (let i = 0; i < rawSteps.length; i++) {
			const raw = rawSteps[i];
			const dependsOn = (raw.dependsOnStepIndices || []).map((idx: number) => stepIdMap.get(idx)).filter((id: any) => id);
			
			steps.push({
				id: stepIdMap.get(i + 1)!,
				index: i + 1,
				description: raw.description,
				toolName: raw.toolName,
				args: raw.args || {},
				dependsOn,
				status: 'pending',
				hasUnresolvedReferences: this.checkUnresolvedReferences(raw.args)
			});
		}

		const plan: AiPlan = {
			id: uuidv4(),
			goalText,
			createdAt: Date.now(),
			status: 'awaiting_review',
			steps,
			commandGroupId: uuidv4()
		};
		this.plans.set(plan.id, plan);
		return plan;
	}

	private checkUnresolvedReferences(args: any): boolean {
		let hasRef = false;
		const walk = (obj: any) => {
			if (!obj) return;
			if (typeof obj === 'string') {
				if (/^\$\{step\d+\.createdIds\[\d+\]\.id\}$/.test(obj)) {
					hasRef = true;
				}
			} else if (typeof obj === 'object') {
				Object.values(obj).forEach(walk);
			}
		};
		walk(args);
		return hasRef;
	}
}
