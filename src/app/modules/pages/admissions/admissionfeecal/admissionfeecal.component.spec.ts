import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdmissionfeecalComponent } from './admissionfeecal.component';

describe('AdmissionfeecalComponent', () => {
  let component: AdmissionfeecalComponent;
  let fixture: ComponentFixture<AdmissionfeecalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdmissionfeecalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdmissionfeecalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
