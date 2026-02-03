import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamsubcategoryComponent } from './examsubcategory.component';

describe('ExamsubcategoryComponent', () => {
  let component: ExamsubcategoryComponent;
  let fixture: ComponentFixture<ExamsubcategoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExamsubcategoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamsubcategoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
