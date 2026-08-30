import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TimetableComponent } from './timetable/timetable.component';
import { ViewComponent } from './view/view.component';
import { PermissionGuard } from '../../../shared/permission.guard';

const routes: Routes = [
  {
    path: '',
    component: TimetableComponent,
    canActivate: [PermissionGuard],
    data: { permission: ['timetable:list', 'timetable:view'] }
  },
  {
    path: 'view/:id',
    component: ViewComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'timetable:view' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TimetableRoutingModule {}
