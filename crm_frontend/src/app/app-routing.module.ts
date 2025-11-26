import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
   {
    path: '',
    pathMatch: 'full',
    redirectTo: 'auth/login',
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('../app/layout/authlayout/authlayout.module').then(
        (m) => m.AuthlayoutModule
      ),
  },
  {
    path: 'app',
    loadChildren: () =>
      import('../app/layout/applayout/applayout.module').then(
        (m) => m.ApplayoutModule
      ),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
