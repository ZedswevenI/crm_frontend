import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InwardRoutingModule } from './inward.routing.module';

import { InwardComponent } from './inward/inward.component';
import { UiElementsModule } from '../../ui-elements/ui-elements.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    InwardComponent
  ],
  imports: [
    CommonModule, 
    InwardRoutingModule, 
    UiElementsModule,
    ReactiveFormsModule,
    FormsModule
  ],
})
export class InwardModule {}