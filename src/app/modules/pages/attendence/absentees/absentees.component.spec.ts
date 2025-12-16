import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AbsenteesComponent } from './absentees.component';

describe('AbsenteesComponent', () => {
  let component: AbsenteesComponent;
  let fixture: ComponentFixture<AbsenteesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AbsenteesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AbsenteesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
