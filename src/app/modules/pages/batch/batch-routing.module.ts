import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BatchComponent } from './batch/batch.component';
import { BatchviewComponent } from './batchview/batchview.component';

const routes: Routes = [
  {
    path: '',
    component: BatchComponent
  },
  { path: 'view/:batchId', component: BatchviewComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BatchRoutingModule {}
