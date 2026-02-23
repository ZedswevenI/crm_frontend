import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PhaselistComponent } from './phaselist.component';

describe('PhaselistComponent', () => {
  let component: PhaselistComponent;
  let fixture: ComponentFixture<PhaselistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PhaselistComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PhaselistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
