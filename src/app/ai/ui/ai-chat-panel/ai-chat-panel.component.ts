import { Component, OnInit, OnDestroy, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { AiConversationService } from '../../services/ai-conversation.service';
import { AiSettingsService } from '../../services/ai-settings.service';
import { MatDialog } from '@angular/material/dialog';
import { AiSettingsDialogComponent } from '../ai-settings-dialog/ai-settings-dialog.component';
import { map } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { AiImageAttachment } from '../../models/ai-message.model';
import { AiImageProcessingService } from '../../services/ai-image-processing.service';
import { TvElectronService } from '../../../services/tv-electron.service';

@Component({
	selector: 'app-ai-chat-panel',
	templateUrl: './ai-chat-panel.component.html',
	styleUrls: ['./ai-chat-panel.component.scss'],
})
export class AiChatPanelComponent implements OnInit, OnDestroy, AfterViewChecked {

	@Output() collapsedChange = new EventEmitter<boolean>();
	@ViewChild('scrollBody') scrollBody!: ElementRef;

	messages$ = this.conversation.messages;
	inputText = '';
	currentMode: 'chat' | 'goal' | 'auto' = 'auto';
	isStreaming$ = this.messages$.pipe(map(msgs => !!msgs[msgs.length - 1]?.streaming));
	settings$ = this.settingsService.settings;

	private lastScrollHeight = 0;
	private shouldAutoScroll = true;
	private scrollSub?: Subscription;

	attachedImages: AiImageAttachment[] = [];
	isAttaching = false;

	constructor(
		private conversation: AiConversationService,
		private settingsService: AiSettingsService,
		private dialog: MatDialog,
		private imageProcessing: AiImageProcessingService,
		private electron: TvElectronService,
	) {}

	ngOnInit(): void {
		this.scrollSub = this.messages$.subscribe(() => {
			this.shouldAutoScroll = this.isUserNearBottom();
		});
	}

	ngOnDestroy(): void {
		this.scrollSub?.unsubscribe();
	}

	ngAfterViewChecked(): void {
		this.scrollToBottomIfNeeded();
	}

	private isUserNearBottom(): boolean {
		if (!this.scrollBody) return true;
		const el = this.scrollBody.nativeElement;
		const threshold = 100;
		const position = el.scrollTop + el.offsetHeight;
		const height = el.scrollHeight;
		return height - position < threshold;
	}

	private scrollToBottomIfNeeded(): void {
		if (!this.scrollBody) return;
		const el = this.scrollBody.nativeElement;
		if (this.shouldAutoScroll && el.scrollHeight > this.lastScrollHeight) {
			el.scrollTop = el.scrollHeight;
			this.lastScrollHeight = el.scrollHeight;
		}
	}

	onScroll(): void {
		this.shouldAutoScroll = this.isUserNearBottom();
	}

	async send(): Promise<void> {
		const text = this.inputText.trim();
		if (!text && this.attachedImages.length === 0) return;
		
		// Clear asynchronously to avoid NG0100 with cdkTextareaAutosize
		setTimeout(() => { this.inputText = ''; });
		
		const images = [...this.attachedImages];
		this.attachedImages = [];
		this.shouldAutoScroll = true; // Force scroll to bottom on send
		await this.conversation.sendMessage(text, images, this.currentMode);
	}

	async attachImage(): Promise<void> {
		if (!this.electron.isElectronApp || this.attachedImages.length >= 4) return;
		
		const result = await this.electron.remote.dialog.showOpenDialog({
			filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
			properties: ['openFile', 'multiSelections']
		});

		if (result.canceled || result.filePaths.length === 0) return;

		this.isAttaching = true;
		try {
			for (const path of result.filePaths) {
				if (this.attachedImages.length >= 4) break;
				
				// Read file into Blob via fetch since we're in chromium
				const response = await fetch('file://' + path.replace(/\\/g, '/'));
				const blob = await response.blob();
				const filename = path.split(/[/\\]/).pop() || 'image';
				const file = new File([blob], filename, { type: blob.type });

				const attachment = await this.imageProcessing.prepareForUpload(file);
				this.attachedImages.push(attachment);
			}
		} catch (err: any) {
			alert('Failed to attach image: ' + err.message);
		} finally {
			this.isAttaching = false;
		}
	}

	removeAttachment(index: number): void {
		this.attachedImages.splice(index, 1);
	}

	onDragOver(event: DragEvent): void {
		event.preventDefault();
		event.stopPropagation();
	}

	async onDrop(event: DragEvent): Promise<void> {
		event.preventDefault();
		event.stopPropagation();
		
		if (!event.dataTransfer?.files || event.dataTransfer.files.length === 0) return;

		this.isAttaching = true;
		try {
			for (let i = 0; i < event.dataTransfer.files.length; i++) {
				if (this.attachedImages.length >= 4) break;
				const file = event.dataTransfer.files[i];
				if (!file.type.startsWith('image/')) continue;
				const attachment = await this.imageProcessing.prepareForUpload(file);
				this.attachedImages.push(attachment);
			}
		} catch (err: any) {
			alert('Failed to attach image: ' + err.message);
		} finally {
			this.isAttaching = false;
		}
	}

	stop(): void {
		this.conversation.cancelCurrentTurn();
	}

	openSettings(): void {
		this.dialog.open(AiSettingsDialogComponent, { width: '420px' });
	}

	exampleClick(prompt: string): void {
		this.inputText = prompt;
	}
}
