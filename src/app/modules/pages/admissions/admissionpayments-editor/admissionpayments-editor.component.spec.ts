import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdmissionpaymentsEditorComponent } from './admissionpayments-editor.component';

describe('AdmissionpaymentsEditorComponent', () => {
  let component: AdmissionpaymentsEditorComponent;
  let fixture: ComponentFixture<AdmissionpaymentsEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdmissionpaymentsEditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdmissionpaymentsEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
