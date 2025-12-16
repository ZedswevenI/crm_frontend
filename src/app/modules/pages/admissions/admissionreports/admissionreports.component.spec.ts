import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdmissionreportsComponent } from './admissionreports.component';

describe('AdmissionreportsComponent', () => {
  let component: AdmissionreportsComponent;
  let fixture: ComponentFixture<AdmissionreportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdmissionreportsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdmissionreportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
