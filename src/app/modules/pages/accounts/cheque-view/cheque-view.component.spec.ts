import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChequeViewComponent } from './cheque-view.component';

describe('ChequeViewComponent', () => {
  let component: ChequeViewComponent;
  let fixture: ComponentFixture<ChequeViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ChequeViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChequeViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
