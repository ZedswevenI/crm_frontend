import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { ClassesRoutingModule } from './classes-routing.module';
import { ClassesComponent } from './classes/classes.component';
import { RearrangeComponent } from './rearrange/rearrange.component';

@NgModule({
  declarations: [ClassesComponent, RearrangeComponent],
  imports: [CommonModule, ClassesRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class ClassesModule {}
