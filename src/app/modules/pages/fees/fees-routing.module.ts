import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FeesComponent } from './fees/fees.component';
import { FeesreportsComponent } from './feesreports/feesreports.component';
import { FeeplansComponent } from './feeplans/feeplans.component';
import { FeeplanviewComponent } from './feeplanview/feeplanview.component';

const routes: Routes = [
  {
    path: 'collection',
    component: FeesComponent,
    title: 'Fee Collections'
  },
  {
    path: 'reports',
    component: FeesreportsComponent,
    title: 'Fee Reports'
  },
  {
    path: 'plans',
    component: FeeplansComponent,
    title: 'Fee Plans'
  },
  {
    path: 'plans/view/:id',
    component: FeeplanviewComponent,
    title: 'Fee Plan View'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FeesRoutingModule {}
