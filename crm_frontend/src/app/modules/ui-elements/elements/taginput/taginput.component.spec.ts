import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaginputComponent } from './taginput.component';

describe('TaginputComponent', () => {
  let component: TaginputComponent;
  let fixture: ComponentFixture<TaginputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaginputComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaginputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
