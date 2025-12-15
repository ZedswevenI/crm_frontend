import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FeesComponent } from './fees/fees.component';
import { FeesreportsComponent } from './feesreports/feesreports.component';

const routes: Routes = [
  {
    path: '',
    component: FeesComponent
  },
  {
    path: 'reports',
    component: FeesreportsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FeesRoutingModule {}
