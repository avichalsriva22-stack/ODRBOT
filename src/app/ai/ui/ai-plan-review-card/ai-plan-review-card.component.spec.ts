import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiPlanReviewCardComponent } from './ai-plan-review-card.component';

describe('AiPlanReviewCardComponent', () => {
  let component: AiPlanReviewCardComponent;
  let fixture: ComponentFixture<AiPlanReviewCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AiPlanReviewCardComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AiPlanReviewCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
