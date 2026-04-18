import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Admissionviewnew1Component } from './admissionviewnew1.component';

describe('Admissionviewnew1Component', () => {
  let component: Admissionviewnew1Component;
  let fixture: ComponentFixture<Admissionviewnew1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Admissionviewnew1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Admissionviewnew1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
