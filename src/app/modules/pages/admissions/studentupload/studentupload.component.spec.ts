import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentuploadComponent } from './studentupload.component';

describe('StudentuploadComponent', () => {
  let component: StudentuploadComponent;
  let fixture: ComponentFixture<StudentuploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StudentuploadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentuploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
