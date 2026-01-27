import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeplansComponent } from './feeplans.component';

describe('FeeplansComponent', () => {
  let component: FeeplansComponent;
  let fixture: ComponentFixture<FeeplansComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FeeplansComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeplansComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
