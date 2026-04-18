import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrintAcknowledgementComponent } from './print-acknowledgement.component';

describe('PrintAcknowledgementComponent', () => {
  let component: PrintAcknowledgementComponent;
  let fixture: ComponentFixture<PrintAcknowledgementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PrintAcknowledgementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrintAcknowledgementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
