import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttandanceComponent } from './attandance.component';

describe('AttandanceComponent', () => {
  let component: AttandanceComponent;
  let fixture: ComponentFixture<AttandanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AttandanceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttandanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
