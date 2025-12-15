import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { FeesRoutingModule } from './fees-routing.module';
import { FeesComponent } from './fees/fees.component';
import { FeesreportsComponent } from './feesreports/feesreports.component';

@NgModule({
  declarations: [FeesComponent, FeesreportsComponent],
  imports: [CommonModule, FeesRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class FeesModule {}
