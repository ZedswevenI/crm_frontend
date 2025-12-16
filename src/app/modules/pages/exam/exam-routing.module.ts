import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ExamComponent } from './exam/exam.component';
import { ExammarksComponent } from './exammarks/exammarks.component';
import { ExamreportsComponent } from './examreports/examreports.component';

const routes: Routes = [
  {
    path: '',
    component: ExamComponent
  },
  {
    path: 'marks-entry/:id',
    component: ExammarksComponent
  },
  {
    path: 'reports',
    component: ExamreportsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ExamRoutingModule {}
