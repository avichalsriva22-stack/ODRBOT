import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiDiffPreviewComponent } from './ai-diff-preview.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('AiDiffPreviewComponent', () => {
	let component: AiDiffPreviewComponent;
	let fixture: ComponentFixture<AiDiffPreviewComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [AiDiffPreviewComponent],
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(AiDiffPreviewComponent);
		component = fixture.componentInstance;
		component.preview = {
			description: 'Test diff',
			diff: [
				{ field: 'Lane 1', before: 'Exists', after: null },
				{ field: 'Lane 2 ID', before: 2, after: 1 }
			]
		};
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
