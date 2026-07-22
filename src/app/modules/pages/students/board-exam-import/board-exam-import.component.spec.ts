import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BoardExamImportComponent } from './board-exam-import.component';

describe('BoardExamImportComponent', () => {
  let component: BoardExamImportComponent;
  let fixture: ComponentFixture<BoardExamImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BoardExamImportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BoardExamImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
