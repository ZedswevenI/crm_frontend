import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FollowupComponent } from './followup.component';

describe('FollowupComponent', () => {
  let component: FollowupComponent;
  let fixture: ComponentFixture<FollowupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FollowupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FollowupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
