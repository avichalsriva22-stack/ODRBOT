import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { AiToolCallRecord } from '../../models/ai-message.model';
import { AiPreviewService } from '../../services/ai-preview.service';
import { CommandHistory } from '../../../commands/command-history';
import { AiToolRegistry } from '../../tools/ai-tool-registry.service';

@Component({
	selector: 'app-ai-tool-call-card',
	templateUrl: './ai-tool-call-card.component.html',
	styleUrls: ['./ai-tool-call-card.component.scss'],
})
export class AiToolCallCardComponent implements OnInit {
	@Input() record!: AiToolCallRecord;
	@Output() confirm = new EventEmitter<void>();
	@Output() reject = new EventEmitter<void>();

	categoryIcon = 'build';
	humanizedName = '';

	constructor(
		private previewService: AiPreviewService,
		private toolRegistry: AiToolRegistry
	) {}

	ngOnInit(): void {
		this.humanizedName = this.record.toolName
			.split('_')
			.map(w => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
			
		const tool = this.toolRegistry.get(this.record.toolName);
		if (tool) {
			switch (tool.category) {
				case 'road': this.categoryIcon = 'add_road'; break;
				case 'lane': this.categoryIcon = 'straighten'; break;
				case 'junction': this.categoryIcon = 'merge'; break;
				case 'marking': this.categoryIcon = 'format_paint'; break;
				case 'prop': this.categoryIcon = 'park'; break;
				case 'signal': this.categoryIcon = 'traffic'; break;
				case 'terrain': this.categoryIcon = 'terrain'; break;
				case 'query': this.categoryIcon = 'search'; break;
				case 'project': this.categoryIcon = 'folder'; break;
				default: this.categoryIcon = 'build';
			}
		}
	}

	canUndo(): boolean {
		// Simplistic check for now, Phase 5
		return this.record.status === 'succeeded';
	}

	undoAction() {
		CommandHistory.undo();
	}
	
	onConfirm(): void {
		this.previewService.confirm(this.record.id);
		this.confirm.emit();
	}
	
	onReject(): void {
		this.previewService.reject(this.record.id);
		this.reject.emit();
	}
}
