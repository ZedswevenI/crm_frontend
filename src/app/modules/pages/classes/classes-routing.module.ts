import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClassesComponent } from './classes/classes.component';
import { RearrangeComponent } from './rearrange/rearrange.component';

const routes: Routes = [
  {
    path: '',
    component: ClassesComponent
  },
  {
    path: 'rearranged-report',
    component: RearrangeComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClassesRoutingModule {}
