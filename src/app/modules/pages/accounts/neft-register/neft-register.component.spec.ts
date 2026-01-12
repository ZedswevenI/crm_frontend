import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NeftRegisterComponent } from './neft-register.component';

describe('NeftRegisterComponent', () => {
  let component: NeftRegisterComponent;
  let fixture: ComponentFixture<NeftRegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NeftRegisterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NeftRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
