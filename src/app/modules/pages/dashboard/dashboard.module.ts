import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardRoutingModule } from './dashboard.routing.module';

import { SampleComponent } from './sample/sample.component';
import { UiElementsModule } from '../../ui-elements/ui-elements.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    SampleComponent
  ],
  imports: [
    CommonModule, 
    DashboardRoutingModule, 
    UiElementsModule,
    ReactiveFormsModule,
    FormsModule
  ],
})
export class DashboardModule {}