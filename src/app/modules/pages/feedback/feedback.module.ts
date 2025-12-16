import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { FeedbackRoutingModule } from './feedback-routing.module';
import { StudentfeedbackComponent } from './studentfeedback/studentfeedback.component';
import { FacultyfeedbackComponent } from './facultyfeedback/facultyfeedback.component';
import { FeedbackreportsComponent } from './feedbackreports/feedbackreports.component';

@NgModule({
  declarations: [StudentfeedbackComponent, FacultyfeedbackComponent, FeedbackreportsComponent],
  imports: [CommonModule, FeedbackRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class FeedbackModule {}
