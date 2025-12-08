import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DoceditorComponent } from './doceditor.component';

describe('DoceditorComponent', () => {
  let component: DoceditorComponent;
  let fixture: ComponentFixture<DoceditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DoceditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DoceditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
