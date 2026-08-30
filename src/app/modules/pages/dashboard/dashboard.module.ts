import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UiElementsModule } from '../../ui-elements/ui-elements.module';
import { PermissionSharedModule } from '../../../shared/permission-shared.module';

import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard/dashboard.component';
import { NewdashboardComponent } from './newdashboard/newdashboard.component';

@NgModule({
  declarations: [DashboardComponent, NewdashboardComponent],
  imports: [CommonModule, DashboardRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule, PermissionSharedModule]
})
export class DashboardModule {}
