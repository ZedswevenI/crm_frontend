import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdmissionApproveComponent } from './admission-approve.component';

describe('AdmissionApproveComponent', () => {
  let component: AdmissionApproveComponent;
  let fixture: ComponentFixture<AdmissionApproveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdmissionApproveComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdmissionApproveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
