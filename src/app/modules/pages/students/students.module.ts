import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { StudentsRoutingModule } from './students-routing.module';
import { StudentsComponent } from './students/students.component';
import { StudentsviewComponent } from './studentsview/studentsview.component';

@NgModule({
  declarations: [StudentsComponent, StudentsviewComponent],
  imports: [CommonModule, StudentsRoutingModule, UiElementsModule, FormsModule, ReactiveFormsModule]
})
export class StudentsModule {}
