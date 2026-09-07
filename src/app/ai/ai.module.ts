/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { TextFieldModule } from '@angular/cdk/text-field';

import { AI_TRANSCRIPT_STORE, InMemoryTranscriptStore } from './services/ai-transcript-store.service';
import { AiChatPanelComponent } from './ui/ai-chat-panel/ai-chat-panel.component';
import { AiMessageBubbleComponent } from './ui/ai-message-bubble/ai-message-bubble.component';
import { AiToolCallCardComponent } from './ui/ai-tool-call-card/ai-tool-call-card.component';
import { AiDiffPreviewComponent } from './ui/ai-diff-preview/ai-diff-preview.component';
import { AiSettingsDialogComponent } from './ui/ai-settings-dialog/ai-settings-dialog.component';
import { AiPlanReviewCardComponent } from './ui/ai-plan-review-card/ai-plan-review-card.component';
import { AiPlanProgressComponent } from './ui/ai-plan-progress/ai-plan-progress.component';
import { AiPlanEditDialogComponent } from './ui/ai-plan-edit-dialog/ai-plan-edit-dialog.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		MatDialogModule,
		MatButtonModule,
		MatIconModule,
		MatTooltipModule,
		MatFormFieldModule,
		MatInputModule,
		MatSelectModule,
		MatSlideToggleModule,
		MatButtonToggleModule,
		MatProgressBarModule,
		MatDividerModule,
		TextFieldModule
	],
	declarations: [
		AiChatPanelComponent,
		AiMessageBubbleComponent,
		AiToolCallCardComponent,
		AiDiffPreviewComponent,
		AiSettingsDialogComponent,
  AiPlanReviewCardComponent,
  AiPlanProgressComponent,
  AiPlanEditDialogComponent
	],
	exports: [
		AiChatPanelComponent
	],
	providers: [
		{ provide: AI_TRANSCRIPT_STORE, useClass: InMemoryTranscriptStore },
	],
})
export class AiModule {}
