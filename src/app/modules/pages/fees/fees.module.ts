import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../ui-elements/ui-elements.module';
import { PermissionSharedModule } from '../../../shared/permission-shared.module';

import { FeesRoutingModule } from './fees-routing.module';
import { FeesComponent } from './fees/fees.component';
import { FeesreportsComponent } from './feesreports/feesreports.component';
import { FeeplansComponent } from './feeplans/feeplans.component';
import { FeeplanviewComponent } from './feeplanview/feeplanview.component';

@NgModule({
  declarations: [FeesComponent, FeesreportsComponent, FeeplansComponent, FeeplanviewComponent],
  imports: [CommonModule, FeesRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule, PermissionSharedModule]
})
export class FeesModule {}
