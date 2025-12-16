import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { ExamRoutingModule } from './exam-routing.module';
import { ExamComponent } from './exam/exam.component';
import { ExammarksComponent } from './exammarks/exammarks.component';
import { ExamreportsComponent } from './examreports/examreports.component';

@NgModule({
  declarations: [ExamComponent, ExammarksComponent, ExamreportsComponent],
  imports: [CommonModule, ExamRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class ExamModule {}
