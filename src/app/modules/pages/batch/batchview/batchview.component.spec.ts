import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BatchviewComponent } from './batchview.component';

describe('BatchviewComponent', () => {
  let component: BatchviewComponent;
  let fixture: ComponentFixture<BatchviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BatchviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BatchviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
