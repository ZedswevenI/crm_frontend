import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
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

const routes: Routes = [
  {
    path: 'institute',
    component: InstituteComponent
  },
  {
    path: 'centers',
    component: CenterComponent
  },
  {
    path: 'centers/view/:id',
    component: CenterviewComponent
  },
  {
    path: 'staff',
    component: StaffComponent
  },
  {
    path: 'programs',
    component: ProgramComponent
  },
  {
    path: 'departments',
    component: DepartmentComponent
  },
  {
    path: 'subject',
    component: SubjectComponent
  },
  {
    path: 'bankaccounts',
    component: BankaccountsComponent
  },
  {
    path: 'exam/category',
    component: ExamcategoryComponent
  },
  {
    path: 'exam/subcategory',
    component: ExamsubcategoryComponent
  },
  {
    path: 'topics',
    component: TopicComponent
  },
  {
    path: 'subtopics',
    component: SubtopicComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrgmastersRoutingModule {}
