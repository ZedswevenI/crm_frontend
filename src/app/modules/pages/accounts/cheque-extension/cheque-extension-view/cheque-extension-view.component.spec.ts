import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChequeExtensionViewComponent } from './cheque-extension-view.component';

describe('ChequeExtensionViewComponent', () => {
  let component: ChequeExtensionViewComponent;
  let fixture: ComponentFixture<ChequeExtensionViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ChequeExtensionViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChequeExtensionViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
