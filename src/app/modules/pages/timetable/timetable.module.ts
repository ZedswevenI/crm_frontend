import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { TimetableRoutingModule } from './timetable-routing.module';
import { TimetableComponent } from './timetable/timetable.component';
import { ViewComponent } from './view/view.component';

@NgModule({
  declarations: [TimetableComponent, ViewComponent],
  imports: [CommonModule, TimetableRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class TimetableModule {}
