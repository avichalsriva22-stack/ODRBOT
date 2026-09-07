import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiPlanEditDialogComponent } from './ai-plan-edit-dialog.component';

describe('AiPlanEditDialogComponent', () => {
  let component: AiPlanEditDialogComponent;
  let fixture: ComponentFixture<AiPlanEditDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AiPlanEditDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AiPlanEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
