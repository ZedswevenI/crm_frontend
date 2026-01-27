import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdmissionWaitComponent } from './admission-wait.component';

describe('AdmissionWaitComponent', () => {
  let component: AdmissionWaitComponent;
  let fixture: ComponentFixture<AdmissionWaitComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdmissionWaitComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdmissionWaitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
