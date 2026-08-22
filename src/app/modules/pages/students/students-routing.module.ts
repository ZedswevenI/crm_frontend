import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { StudentsComponent } from './students/students.component';
import { StudentsviewComponent } from './studentsview/studentsview.component';
import { PermissionGuard } from '../../../shared/permission.guard';

const routes: Routes = [
  {
    path: '',
    component: StudentsComponent,
    canActivate: [PermissionGuard],
    data: { permission: ['student:list', 'student:view'] }
  },
  {
    path: 'view/:id',
    component: StudentsviewComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'student:view' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StudentsRoutingModule {}
