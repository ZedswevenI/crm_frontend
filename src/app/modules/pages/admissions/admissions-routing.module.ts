import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListComponent } from './list/list.component';

import { AdmissionsComponent } from './admissions/admissions.component';

const routes: Routes = [{ path: '', component: ListComponent }, { path: 'new', component: AdmissionsComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdmissionsRoutingModule {}
