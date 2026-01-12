import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChequeMergeComponent } from './cheque-merge.component';

describe('ChequeMergeComponent', () => {
  let component: ChequeMergeComponent;
  let fixture: ComponentFixture<ChequeMergeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ChequeMergeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChequeMergeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
