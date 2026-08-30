import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BatchComponent } from './batch/batch.component';
import { BatchviewComponent } from './batchview/batchview.component';
import { PermissionGuard } from '../../../shared/permission.guard';

const routes: Routes = [
  {
    path: '',
    component: BatchComponent,
    canActivate: [PermissionGuard],
    data: { permission: ['batch:list', 'batch:view'] }
  },
  {
    path: 'view/:batchId',
    component: BatchviewComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'batch:view' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BatchRoutingModule {}
