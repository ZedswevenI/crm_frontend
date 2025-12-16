import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { AttendenceRoutingModule } from './attendence-routing.module';
import { EntryComponent } from './entry/entry.component';
import { AbsenteesComponent } from './absentees/absentees.component';
import { FollowupComponent } from './followup/followup.component';
import { ReportsComponent } from './reports/reports.component';

@NgModule({
  declarations: [EntryComponent, AbsenteesComponent, FollowupComponent, ReportsComponent],
  imports: [CommonModule, AttendenceRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class AttendenceModule {}
