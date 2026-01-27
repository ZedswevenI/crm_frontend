import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentsviewComponent } from './paymentsview.component';

describe('PaymentsviewComponent', () => {
  let component: PaymentsviewComponent;
  let fixture: ComponentFixture<PaymentsviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PaymentsviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentsviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
