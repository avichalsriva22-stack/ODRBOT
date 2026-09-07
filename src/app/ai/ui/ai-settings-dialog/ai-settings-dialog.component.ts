import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AiSettingsService } from '../../services/ai-settings.service';
import { AiModelId } from '../../models/ai-settings.model';

@Component({
	selector: 'app-ai-settings-dialog',
	templateUrl: './ai-settings-dialog.component.html',
	styleUrls: ['./ai-settings-dialog.component.scss']
})
export class AiSettingsDialogComponent implements OnInit {

	apiKeyInput = '';
	hideKey = true;
	
	hasSavedKey = false;
	
	provider: 'anthropic' | 'openrouter' = 'anthropic';
	openRouterModel = '';
	selectedModel: AiModelId = 'claude-sonnet-5';
	advancedEnabled = false;

	readonly models: { id: AiModelId, label: string }[] = [
		{ id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku (Fast)' },
		{ id: 'claude-sonnet-5', label: 'Claude Sonnet (Default)' },
		{ id: 'claude-opus-4-8', label: 'Claude Opus (Complex)' }
	];

	constructor(
		public dialogRef: MatDialogRef<AiSettingsDialogComponent>,
		private settingsService: AiSettingsService
	) {}

	ngOnInit(): void {
		const current = this.settingsService.current;
		this.provider = current.provider;
		this.hasSavedKey = current.apiKeyConfigured;
		this.selectedModel = current.model;
		this.openRouterModel = current.openRouterModel;
		this.advancedEnabled = current.advancedToolsEnabled;
	}

	async onProviderChange(val: 'anthropic' | 'openrouter'): Promise<void> {
		await this.settingsService.setProvider(val);
		this.hasSavedKey = this.settingsService.current.apiKeyConfigured;
		this.apiKeyInput = ''; // clear input on switch
	}

	onOpenRouterModelChange(val: string): void {
		this.settingsService.setOpenRouterModel(val);
	}

	async saveKey(): Promise<void> {
		if (this.apiKeyInput.trim()) {
			await this.settingsService.setApiKey(this.apiKeyInput.trim());
			this.hasSavedKey = true;
			this.apiKeyInput = '';
		}
	}

	async clearKey(): Promise<void> {
		await this.settingsService.clearApiKey();
		this.hasSavedKey = false;
	}

	onModelChange(val: any) {
		this.settingsService.setModel(val);
	}

	onAdvancedChange(val: any) {
		this.settingsService.setAdvancedToolsEnabled(val);
	}
}
