import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommondeleteComponent } from './commondelete.component';

describe('CommondeleteComponent', () => {
  let component: CommondeleteComponent;
  let fixture: ComponentFixture<CommondeleteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CommondeleteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommondeleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
