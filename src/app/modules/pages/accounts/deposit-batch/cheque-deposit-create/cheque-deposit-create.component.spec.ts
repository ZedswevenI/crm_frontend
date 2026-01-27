import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChequeDepositCreateComponent } from './cheque-deposit-create.component';

describe('ChequeDepositCreateComponent', () => {
  let component: ChequeDepositCreateComponent;
  let fixture: ComponentFixture<ChequeDepositCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ChequeDepositCreateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChequeDepositCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
