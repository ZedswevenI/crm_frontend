import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AttandanceComponent } from './attandance/attandance.component';
import { MarkattendanceComponent } from './markattendance/markattendance.component';

const routes: Routes = [{ path: '', component: AttandanceComponent, title: 'Student Attendance' }, { path: 'mark', component: MarkattendanceComponent, title: 'Student Attendance' }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AttendanceRoutingModule {}
