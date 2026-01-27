import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BredcrumpComponent } from './bredcrump.component';

describe('BredcrumpComponent', () => {
  let component: BredcrumpComponent;
  let fixture: ComponentFixture<BredcrumpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BredcrumpComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BredcrumpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
