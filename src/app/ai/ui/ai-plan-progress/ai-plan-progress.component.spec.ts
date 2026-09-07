import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiPlanProgressComponent } from './ai-plan-progress.component';

describe('AiPlanProgressComponent', () => {
  let component: AiPlanProgressComponent;
  let fixture: ComponentFixture<AiPlanProgressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AiPlanProgressComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AiPlanProgressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
