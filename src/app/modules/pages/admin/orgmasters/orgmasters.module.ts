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
import { TopicComponent } from './topic/topic.component';
import { SubtopicComponent } from './subtopic/subtopic.component';
import { ExamcategoryComponent } from './examcategory/examcategory.component';
import { ExamsubcategoryComponent } from './examsubcategory/examsubcategory.component';
import { CenterviewComponent } from './centerview/centerview.component';

@NgModule({
  declarations: [InstituteComponent, CenterComponent, StaffComponent, ProgramComponent, DepartmentComponent, SubjectComponent, BankaccountsComponent, TopicComponent, SubtopicComponent, ExamcategoryComponent, ExamsubcategoryComponent, CenterviewComponent],
  imports: [CommonModule, OrgmastersRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class OrgmastersModule {}
