import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AttandanceComponent } from './attandance/attandance.component';
import { MarkattendanceComponent } from './markattendance/markattendance.component';
import { PermissionGuard } from '../../../shared/permission.guard';

const routes: Routes = [
  {
    path: '',
    component: AttandanceComponent,
    title: 'Student Attendance',
    canActivate: [PermissionGuard],
    data: { permission: 'attendance:list' }
  },
  {
    path: 'mark',
    component: MarkattendanceComponent,
    title: 'Student Attendance',
    canActivate: [PermissionGuard],
    data: { permission: ['attendance:mark', 'attendance:edit'] }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AttendanceRoutingModule {}
