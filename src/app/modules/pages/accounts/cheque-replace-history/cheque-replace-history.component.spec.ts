import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChequeReplaceHistoryComponent } from './cheque-replace-history.component';

describe('ChequeReplaceHistoryComponent', () => {
  let component: ChequeReplaceHistoryComponent;
  let fixture: ComponentFixture<ChequeReplaceHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ChequeReplaceHistoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChequeReplaceHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
