import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './service/guard/auth.guard';
import { GuestGuard } from './service/guard/guest.guard';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'auth/login'
  },
  {
    path: 'auth',
    canActivate: [GuestGuard],
    loadChildren: () => import('../app/layout/authlayout/authlayout.module').then(m => m.AuthlayoutModule)
  },
  {
    path: 'app',
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    loadChildren: () => import('../app/layout/applayout/applayout.module').then(m => m.ApplayoutModule)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
