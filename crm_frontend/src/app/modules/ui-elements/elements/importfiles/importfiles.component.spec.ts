import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportfilesComponent } from './importfiles.component';

describe('ImportfilesComponent', () => {
  let component: ImportfilesComponent;
  let fixture: ComponentFixture<ImportfilesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ImportfilesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportfilesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
