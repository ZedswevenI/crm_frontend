import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdmissionbugComponent } from './admissionbug.component';

describe('AdmissionbugComponent', () => {
  let component: AdmissionbugComponent;
  let fixture: ComponentFixture<AdmissionbugComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdmissionbugComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdmissionbugComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
