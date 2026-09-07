import { Component, Input, OnChanges } from '@angular/core';
import { AiChatMessage } from '../../models/ai-message.model';
import { AiPlan } from '../../models/ai-plan.model';
import { AiPlannerService } from '../../services/ai-planner.service';

@Component({
	selector: 'app-ai-message-bubble',
	templateUrl: './ai-message-bubble.component.html',
	styleUrls: ['./ai-message-bubble.component.scss'],
})
export class AiMessageBubbleComponent implements OnChanges {
	@Input() message!: AiChatMessage;
	
	parsedHtml = '';

	constructor ( private plannerService: AiPlannerService ) {}

	ngOnChanges(): void {
		if (this.message?.text) {
			this.parsedHtml = this.parseMarkdownLite(this.message.text);
		} else {
			this.parsedHtml = '';
		}
	}

	getPlan ( id: string ): AiPlan | undefined {
		return this.plannerService.getPlan( id );
	}

	private parseMarkdownLite(text: string): string {
		let html = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
			
		html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
		html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
		html = html.replace(/`(.*?)`/g, '<code>$1</code>');
		
		const lines = html.split('\n');
		let inList = false;
		let inNumberedList = false;
		
		const processed = lines.map(line => {
			const ulMatch = line.match(/^(\s*)([\*\-])\s+(.*)/);
			const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
			
			if (ulMatch) {
				const prefix = !inList ? '<ul>' : '';
				inList = true;
				if (inNumberedList) { inNumberedList = false; return `</ol>${prefix}<li>${ulMatch[3]}</li>`; }
				return `${prefix}<li>${ulMatch[3]}</li>`;
			} else if (olMatch) {
				const prefix = !inNumberedList ? '<ol>' : '';
				inNumberedList = true;
				if (inList) { inList = false; return `</ul>${prefix}<li>${olMatch[3]}</li>`; }
				return `${prefix}<li>${olMatch[3]}</li>`;
			} else {
				let prefix = '';
				if (inList) { inList = false; prefix = '</ul>'; }
				if (inNumberedList) { inNumberedList = false; prefix = '</ol>'; }
				return prefix + line + '<br>';
			}
		});
		
		html = processed.join('');
		if (inList) html += '</ul>';
		if (inNumberedList) html += '</ol>';
		
		// Clean up trailing <br> tags
		html = html.replace(/(<br>)+$/g, '');

		return html;
	}
}
