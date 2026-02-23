import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PhaseCreateComponent } from './phase-create.component';

describe('PhaseCreateComponent', () => {
  let component: PhaseCreateComponent;
  let fixture: ComponentFixture<PhaseCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PhaseCreateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PhaseCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
