import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChequeExtensionComponent } from './cheque-extension.component';

describe('ChequeExtensionComponent', () => {
  let component: ChequeExtensionComponent;
  let fixture: ComponentFixture<ChequeExtensionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ChequeExtensionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChequeExtensionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
