import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiChatPanelComponent } from './ai-chat-panel.component';
import { AiConversationService } from '../../services/ai-conversation.service';
import { AiSettingsService } from '../../services/ai-settings.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('AiChatPanelComponent', () => {
	let component: AiChatPanelComponent;
	let fixture: ComponentFixture<AiChatPanelComponent>;
	
	const conversationSpy = jasmine.createSpyObj('AiConversationService', ['sendMessage', 'cancelCurrentTurn'], {
		messages: new BehaviorSubject([])
	});
	const settingsSpy = jasmine.createSpyObj('AiSettingsService', [], {
		settings: new BehaviorSubject({ apiKeyConfigured: true })
	});
	const dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [AiChatPanelComponent],
			imports: [FormsModule, MatIconModule, MatDialogModule],
			providers: [
				{ provide: AiConversationService, useValue: conversationSpy },
				{ provide: AiSettingsService, useValue: settingsSpy },
				{ provide: MatDialog, useValue: dialogSpy }
			],
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(AiChatPanelComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
