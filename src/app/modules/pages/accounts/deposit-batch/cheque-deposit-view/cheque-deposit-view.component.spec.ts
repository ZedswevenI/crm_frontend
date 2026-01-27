import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChequeDepositViewComponent } from './cheque-deposit-view.component';

describe('ChequeDepositViewComponent', () => {
  let component: ChequeDepositViewComponent;
  let fixture: ComponentFixture<ChequeDepositViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ChequeDepositViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChequeDepositViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
