import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RpaimportComponent } from './rpaimport.component';

describe('RpaimportComponent', () => {
  let component: RpaimportComponent;
  let fixture: ComponentFixture<RpaimportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RpaimportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RpaimportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
