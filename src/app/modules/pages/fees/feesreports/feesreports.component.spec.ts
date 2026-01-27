import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeesreportsComponent } from './feesreports.component';

describe('FeesreportsComponent', () => {
  let component: FeesreportsComponent;
  let fixture: ComponentFixture<FeesreportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FeesreportsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeesreportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
