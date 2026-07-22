import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthlayoutRoutingModule } from './authlayout.routing.module';
import { AuthlayoutComponent } from './authlayout/authlayout.component';

import { LoginComponent } from '../../modules/auth/components/login/login.component';
import { RegisterComponent } from '../../modules/auth/components/register/register.component';
import { Routes } from '@angular/router';
import { UiElementsModule } from '../../modules/ui-elements/ui-elements.module';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent }
];


@NgModule({
  declarations: [AuthlayoutComponent],
  imports: [CommonModule, AuthlayoutRoutingModule, UiElementsModule],
})
export class AuthlayoutModule {}
