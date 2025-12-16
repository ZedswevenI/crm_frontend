import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamreportsComponent } from './examreports.component';

describe('ExamreportsComponent', () => {
  let component: ExamreportsComponent;
  let fixture: ComponentFixture<ExamreportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExamreportsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamreportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
