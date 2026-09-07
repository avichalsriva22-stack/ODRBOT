import { TestBed } from '@angular/core/testing';
import { AiIntentClassifierService } from './ai-intent-classifier.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('AiIntentClassifierService', () => {
	let service: AiIntentClassifierService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [HttpClientTestingModule]
		});
		service = TestBed.inject(AiIntentClassifierService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should classify as goal', async () => {
		expect(await service.classify('build me a whole town', false)).toBe('goal');
		expect(await service.classify('create a new intersection', false)).toBe('goal');
		expect(await service.classify('layout a multi-lane highway', false)).toBe('goal');
		expect(await service.classify('create residential block', false)).toBe('goal');
	});

	it('should classify edit operations as chat', async () => {
		expect(await service.classify('set speed limit to 50 on this road', false)).toBe('chat');
		expect(await service.classify('widen selected lane', false)).toBe('chat');
		expect(await service.classify('undo my last action', false)).toBe('chat');
		expect(await service.classify('delete this junction', false)).toBe('chat');
	});

	it('should classify mixed signals favoring chat when specific', async () => {
		expect(await service.classify('build this road', false)).toBe('chat');
	});

	it('should classify unknown requests as ambiguous', async () => {
		expect(await service.classify('what is the speed limit here?', false)).toBe('ambiguous');
		expect(await service.classify('hello', false)).toBe('ambiguous');
	});
});
