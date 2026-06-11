import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AlumniImportComponent } from './alumni-import.component';

describe('AlumniImportComponent', () => {
  let component: AlumniImportComponent;
  let fixture: ComponentFixture<AlumniImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AlumniImportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AlumniImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
