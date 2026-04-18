import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdmissionviewnewComponent } from './admissionviewnew.component';

describe('AdmissionviewnewComponent', () => {
  let component: AdmissionviewnewComponent;
  let fixture: ComponentFixture<AdmissionviewnewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdmissionviewnewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdmissionviewnewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
