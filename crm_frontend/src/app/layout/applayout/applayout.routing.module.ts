import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ApplayoutComponent } from './applayout/applayout.component';

const routes: Routes = [
  {
    path: '',
    component: ApplayoutComponent,
    children: [
      {
        path: '',
        loadChildren: () =>
          import('../../modules/pages/pages.module').then((m) => m.PagesModule),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ApplayoutRoutingModule {}
