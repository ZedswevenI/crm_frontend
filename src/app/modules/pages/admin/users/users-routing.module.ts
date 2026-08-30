import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UsersComponent } from './users/users.component';
import { PermissionGuard } from '../../../../shared/permission.guard';

const routes: Routes = [
  {
    path: '',
    component: UsersComponent,
    canActivate: [PermissionGuard],
    data: { permission: ['orgUser:list', 'orgUser:view'], requireAll: true }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UsersRoutingModule {}
