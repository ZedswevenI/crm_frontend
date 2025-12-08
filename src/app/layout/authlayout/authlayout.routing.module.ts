import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthlayoutComponent } from './authlayout/authlayout.component';

const routes: Routes = [
  {
    path: '',
    component: AuthlayoutComponent,
    children: [
      {
        path: '',
        loadChildren: () =>
          import('../../modules/auth/auth.module').then((m) => m.AuthModule),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AuthlayoutRoutingModule {}
