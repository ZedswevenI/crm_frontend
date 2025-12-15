import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { FacultyRoutingModule } from './faculty-routing.module';
import { FacultyComponent } from './faculty/faculty.component';

@NgModule({
  declarations: [FacultyComponent],
  imports: [CommonModule, FacultyRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class FacultyModule {}
