import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChequeExtensionRequestComponent } from './cheque-extension-request.component';

describe('ChequeExtensionRequestComponent', () => {
  let component: ChequeExtensionRequestComponent;
  let fixture: ComponentFixture<ChequeExtensionRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ChequeExtensionRequestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChequeExtensionRequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
