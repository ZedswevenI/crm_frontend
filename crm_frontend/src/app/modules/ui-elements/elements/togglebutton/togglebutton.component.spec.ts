import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TogglebuttonComponent } from './togglebutton.component';

describe('TogglebuttonComponent', () => {
  let component: TogglebuttonComponent;
  let fixture: ComponentFixture<TogglebuttonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TogglebuttonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TogglebuttonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
