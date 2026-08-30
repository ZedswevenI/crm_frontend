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
import { PermissionGuard } from '../../../../shared/permission.guard';

const routes: Routes = [
  {
    // Left ungated, same as academy_frontend: single per-tenant profile
    // record, not a listable/CRUD-able entity in the permission catalog.
    path: 'institute',
    component: InstituteComponent
  },
  {
    path: 'centers',
    component: CenterComponent,
    canActivate: [PermissionGuard],
    data: { permission: ['orgCenter:list', 'orgCenter:view'], requireAll: true }
  },
  {
    path: 'centers/view/:id',
    component: CenterviewComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'orgCenter:view' }
  },
  {
    path: 'staff',
    component: StaffComponent,
    canActivate: [PermissionGuard],
    data: { permission: ['orgStaff:list', 'orgStaff:view'], requireAll: true }
  },
  {
    path: 'programs',
    component: ProgramComponent,
    canActivate: [PermissionGuard],
    data: { permission: ['orgProgram:list', 'orgProgram:view'], requireAll: true }
  },
  {
    path: 'departments',
    component: DepartmentComponent,
    canActivate: [PermissionGuard],
    data: { permission: ['orgDept:list', 'orgDept:edit'], requireAll: true }
  },
  {
    path: 'subject',
    component: SubjectComponent,
    canActivate: [PermissionGuard],
    data: { permission: ['orgSubject:list', 'orgSubject:create'], requireAll: true }
  },
  {
    path: 'bankaccounts',
    component: BankaccountsComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'orgBankAccount:list' }
  },
  {
    path: 'exam/category',
    component: ExamcategoryComponent,
    canActivate: [PermissionGuard],
    data: { permission: ['orgExamCategory:list', 'orgExamCategory:create'], requireAll: true }
  },
  {
    path: 'exam/subcategory',
    component: ExamsubcategoryComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'orgExamCategory:addSubCategories' }
  },
  {
    path: 'topics',
    component: TopicComponent,
    canActivate: [PermissionGuard],
    data: { permission: ['orgTopic:list', 'orgTopic:create'], requireAll: true }
  },
  {
    path: 'subtopics',
    component: SubtopicComponent,
    canActivate: [PermissionGuard],
    data: { permission: ['orgSubTopic:list', 'orgSubTopic:create'], requireAll: true }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrgmastersRoutingModule {}
