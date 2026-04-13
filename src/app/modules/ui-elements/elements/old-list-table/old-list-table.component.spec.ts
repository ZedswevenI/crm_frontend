import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OldListTableComponent } from './old-list-table.component';

describe('OldListTableComponent', () => {
  let component: OldListTableComponent;
  let fixture: ComponentFixture<OldListTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OldListTableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OldListTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
