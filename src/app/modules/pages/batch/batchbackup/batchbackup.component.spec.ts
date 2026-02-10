import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BatchbackupComponent } from './batchbackup.component';

describe('BatchbackupComponent', () => {
  let component: BatchbackupComponent;
  let fixture: ComponentFixture<BatchbackupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BatchbackupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BatchbackupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
