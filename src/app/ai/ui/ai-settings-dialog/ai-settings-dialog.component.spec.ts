import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiSettingsDialogComponent } from './ai-settings-dialog.component';
import { MatDialogRef } from '@angular/material/dialog';
import { AiSettingsService } from '../../services/ai-settings.service';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('AiSettingsDialogComponent', () => {
	let component: AiSettingsDialogComponent;
	let fixture: ComponentFixture<AiSettingsDialogComponent>;

	const dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
	const settingsSpy = jasmine.createSpyObj('AiSettingsService', ['setApiKey', 'clearApiKey', 'setModel', 'setAdvancedToolsEnabled'], {
		current: { apiKeyConfigured: true, model: 'claude-sonnet-5', advancedToolsEnabled: false }
	});

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [AiSettingsDialogComponent],
			imports: [
				FormsModule,
				MatFormFieldModule,
				MatInputModule,
				MatSelectModule,
				MatSlideToggleModule,
				NoopAnimationsModule
			],
			providers: [
				{ provide: MatDialogRef, useValue: dialogRefSpy },
				{ provide: AiSettingsService, useValue: settingsSpy }
			],
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(AiSettingsDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
