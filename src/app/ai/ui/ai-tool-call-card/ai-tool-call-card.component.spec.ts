import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiToolCallCardComponent } from './ai-tool-call-card.component';
import { AiPreviewService } from '../../services/ai-preview.service';
import { CommandHistory } from '../../../commands/command-history';
import { AiToolRegistry } from '../../tools/ai-tool-registry.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('AiToolCallCardComponent', () => {
	let component: AiToolCallCardComponent;
	let fixture: ComponentFixture<AiToolCallCardComponent>;

	const previewSpy = jasmine.createSpyObj('AiPreviewService', ['confirm', 'reject']);
	const registrySpy = jasmine.createSpyObj('AiToolRegistry', ['get']);

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [AiToolCallCardComponent],
			providers: [
				{ provide: AiPreviewService, useValue: previewSpy },
				{ provide: AiToolRegistry, useValue: registrySpy }
			],
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(AiToolCallCardComponent);
		component = fixture.componentInstance;
		component.record = {
			id: 'call_1',
			toolName: 'set_lane_width',
			args: {},
			status: 'succeeded'
		};
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
