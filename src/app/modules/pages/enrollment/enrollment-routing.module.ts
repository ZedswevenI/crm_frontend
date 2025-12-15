import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EnrolmentComponent } from './enrolment/enrolment.component';

const routes: Routes = [{ path: '', component: EnrolmentComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EnrollmentRoutingModule {}
