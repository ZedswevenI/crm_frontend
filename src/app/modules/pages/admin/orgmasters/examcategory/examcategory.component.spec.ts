import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamcategoryComponent } from './examcategory.component';

describe('ExamcategoryComponent', () => {
  let component: ExamcategoryComponent;
  let fixture: ComponentFixture<ExamcategoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExamcategoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamcategoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
