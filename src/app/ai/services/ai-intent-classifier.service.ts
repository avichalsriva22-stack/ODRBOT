import { Injectable } from '@angular/core';
import { AiLlmClientService, AiStreamEvent } from './ai-llm-client.service';
import { AiSettingsService } from './ai-settings.service';

@Injectable( { providedIn: 'root' } )
export class AiIntentClassifierService {

	constructor(
		private llmClient: AiLlmClientService,
		private settingsService: AiSettingsService
	) {}

	async classify(text: string, hasImage: boolean): Promise<'chat' | 'goal' | 'ambiguous'> {
		if (hasImage) return 'goal'; // image input always implies a build task, doc 13 §4
		if (!text || text.trim() === '') return 'chat';

		const system = `You are an intent classifier for a 3D road design tool.
Categorize the user's request into one of three categories:
1. "goal": The user wants to build a new road network, intersection, roundabout, or complex structure from scratch or make major architectural changes. (e.g. "build a roundabout", "create a 4-way intersection")
2. "chat": The user wants to edit specific properties, modify selected items, use individual targeted tools, or ask a question. (e.g. "set the speed to 60", "delete this road", "move the crosswalk")
3. "ambiguous": The request is completely unclear and you need to ask them if they want to edit an existing object or build from scratch.

Respond ONLY with exactly one of these words: goal, chat, or ambiguous. No other text or punctuation.`;

		let output = '';
		try {
			const result = await new Promise<string>((resolve, reject) => {
				this.llmClient.streamCompletion({
					model: this.settingsService.current.model,
					system,
					messages: [{ role: 'user', content: [{ type: 'text', text }] }],
					tools: [],
					maxTokens: 10
				}).subscribe({
					next: (event: AiStreamEvent) => {
						if (event.type === 'text_delta') output += event.text;
					},
					error: reject,
					complete: () => resolve(output)
				});
			});

			const cleanResult = result.trim().toLowerCase();
			if (cleanResult.includes('goal')) return 'goal';
			if (cleanResult.includes('chat')) return 'chat';
			if (cleanResult.includes('ambiguous')) return 'ambiguous';
			
			return 'chat'; // fallback
		} catch (e) {
			console.error('Intent classification failed, falling back to regex', e);
			return this.regexClassify(text);
		}
	}

	private regexClassify(text: string): 'chat' | 'goal' | 'ambiguous' {
		const goalSignals = [
			/\bbuild\b/i, /\bcreate\b.*\b(intersection|neighborhood|block|network|segment|town|roundabout)\b/i,
			/\ban? (entire|whole|complete)\b/i, /\bfrom (this|the) (image|sketch|photo)\b/i,
			/\blayout\b/i, /\bmulti[- ]?lane (highway|interchange)\b/i,
			/\bscratch\b/i
		];
		const chatSignals = [
			/^(set|widen|narrow|rename|delete|remove|undo|export)\b/i,
			/\bthis (road|lane|junction)\b/i, /\bselected\b/i,
			/\bspecific\b/i, /\bchange\b/i, /\badd\b/i
		];

		if (goalSignals.some(r => r.test(text)) && !chatSignals.some(r => r.test(text))) return 'goal';
		if (chatSignals.some(r => r.test(text))) return 'chat';
		return 'ambiguous';
	}
}
