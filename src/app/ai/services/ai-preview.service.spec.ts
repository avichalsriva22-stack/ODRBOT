import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AiPreviewService } from './ai-preview.service';

describe('AiPreviewService', () => {
	let service: AiPreviewService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(AiPreviewService);
	});

	it('should confirm action', async () => {
		let resolved = false;
		service.awaitUserConfirmation('test-1').then(res => resolved = res);
		service.confirm('test-1');
		await new Promise(r => setTimeout(r, 0));
		expect(resolved).toBeTrue();
	});

	it('should reject action', async () => {
		let resolved = true;
		service.awaitUserConfirmation('test-2').then(res => resolved = res);
		service.reject('test-2');
		await new Promise(r => setTimeout(r, 0));
		expect(resolved).toBeFalse();
	});

	it('should timeout and reject after 5 minutes', fakeAsync(() => {
		let resolved = true;
		service.awaitUserConfirmation('test-3').then(res => resolved = res);
		
		tick(299999);
		expect(resolved).toBeTrue(); // Not yet resolved

		tick(2); // Passes 300,000ms
		expect(resolved).toBeFalse();
	}));
});
