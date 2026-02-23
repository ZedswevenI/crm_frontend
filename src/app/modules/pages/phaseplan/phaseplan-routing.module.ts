import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PhaseCreateComponent } from './phase-create/phase-create.component';
import { PhaselistComponent } from './phaselist/phaselist.component';
import { PhaseViewComponent } from './phase-view/phase-view.component';

const routes: Routes = [{ path: 'create', component: PhaseCreateComponent, title: 'Phase Plan' }, { path: '', component: PhaselistComponent, title: 'Phase Plan' }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PhaseplanRoutingModule {}
