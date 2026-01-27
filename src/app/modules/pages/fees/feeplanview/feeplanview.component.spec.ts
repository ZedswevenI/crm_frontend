import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeeplanviewComponent } from './feeplanview.component';

describe('FeeplanviewComponent', () => {
  let component: FeeplanviewComponent;
  let fixture: ComponentFixture<FeeplanviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FeeplanviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FeeplanviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
