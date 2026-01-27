import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StudentfeedbackComponent } from './studentfeedback/studentfeedback.component';
import { FacultyfeedbackComponent } from './facultyfeedback/facultyfeedback.component';
import { FeedbackreportsComponent } from './feedbackreports/feedbackreports.component';

const routes: Routes = [
  {
    path: 'student',
    component: StudentfeedbackComponent
  },
  {
    path: 'faculty',
    component: FacultyfeedbackComponent
  },
  {
    path: 'reports',
    component: FeedbackreportsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FeedbackRoutingModule {}
