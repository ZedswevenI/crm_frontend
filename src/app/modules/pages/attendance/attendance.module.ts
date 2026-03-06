import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { AttendanceRoutingModule } from './attendance-routing.module';
import { AttandanceComponent } from './attandance/attandance.component';
import { MarkattendanceComponent } from './markattendance/markattendance.component';
import { PresentCountPipe, AbsentCountPipe, AbsentStudentsFilterPipe, NotMarkedCountPipe } from './attendance-count.pipe';

@NgModule({
  declarations: [AttandanceComponent, MarkattendanceComponent, PresentCountPipe, AbsentCountPipe, AbsentStudentsFilterPipe, NotMarkedCountPipe],
  imports: [CommonModule, AttendanceRoutingModule, UiElementsModule, FormsModule, ReactiveFormsModule]
})
export class AttendanceModule {}
