import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InwardComponent } from './inward/inward.component';

const routes: Routes = [

  { path: '', title: 'Inward', component: InwardComponent},

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InwardRoutingModule {}
