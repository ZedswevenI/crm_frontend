import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { StudentsRoutingModule } from './students-routing.module';
import { StudentsComponent } from './students/students.component';
import { StudentsviewComponent } from './studentsview/studentsview.component';
import { RpaimportComponent } from './rpaimport/rpaimport.component';
import { BoardExamImportComponent } from './board-exam-import/board-exam-import.component';
import { AlumniImportComponent } from './alumni-import/alumni-import.component';

@NgModule({
  declarations: [StudentsComponent, StudentsviewComponent, RpaimportComponent, BoardExamImportComponent, AlumniImportComponent],
  imports: [CommonModule, StudentsRoutingModule, UiElementsModule, FormsModule, ReactiveFormsModule]
})
export class StudentsModule {}
