import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdmissioncommunicationComponent } from './admissioncommunication.component';

describe('AdmissioncommunicationComponent', () => {
  let component: AdmissioncommunicationComponent;
  let fixture: ComponentFixture<AdmissioncommunicationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdmissioncommunicationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdmissioncommunicationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
