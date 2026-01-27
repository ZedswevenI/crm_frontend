import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentfeedbackComponent } from './studentfeedback.component';

describe('StudentfeedbackComponent', () => {
  let component: StudentfeedbackComponent;
  let fixture: ComponentFixture<StudentfeedbackComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StudentfeedbackComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentfeedbackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
