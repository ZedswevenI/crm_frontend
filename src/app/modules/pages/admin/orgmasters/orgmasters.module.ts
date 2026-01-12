import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../../ui-elements/ui-elements.module';
import { OrgmastersRoutingModule } from './orgmasters-routing.module';
import { InstituteComponent } from './institute/institute.component';
import { CenterComponent } from './center/center.component';
import { StaffComponent } from './staff/staff.component';
import { ProgramComponent } from './program/program.component';
import { DepartmentComponent } from './department/department.component';
import { SubjectComponent } from './subject/subject.component';
import { BankaccountsComponent } from './bankaccounts/bankaccounts.component';

@NgModule({
  declarations: [InstituteComponent, CenterComponent, StaffComponent, ProgramComponent, DepartmentComponent, SubjectComponent, BankaccountsComponent],
  imports: [CommonModule, OrgmastersRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class OrgmastersModule {}
