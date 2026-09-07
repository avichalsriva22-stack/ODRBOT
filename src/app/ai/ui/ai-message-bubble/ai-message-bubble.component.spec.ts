import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiMessageBubbleComponent } from './ai-message-bubble.component';
import { MatIconModule } from '@angular/material/icon';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('AiMessageBubbleComponent', () => {
	let component: AiMessageBubbleComponent;
	let fixture: ComponentFixture<AiMessageBubbleComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [AiMessageBubbleComponent],
			imports: [MatIconModule],
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(AiMessageBubbleComponent);
		component = fixture.componentInstance;
		component.message = { id: '1', role: 'assistant', text: 'Hello', createdAt: Date.now() };
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should parse markdown lite correctly', () => {
		component.message.text = 'Bold **text**, Italic *text*, and `code`';
		component.ngOnChanges();
		expect(component.parsedHtml).toContain('<strong>text</strong>');
		expect(component.parsedHtml).toContain('<em>text</em>');
		expect(component.parsedHtml).toContain('<code>code</code>');
	});
});
