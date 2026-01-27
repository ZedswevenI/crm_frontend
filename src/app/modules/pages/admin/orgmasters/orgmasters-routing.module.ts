import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InstituteComponent } from './institute/institute.component';
import { CenterComponent } from './center/center.component';
import { StaffComponent } from './staff/staff.component';
import { ProgramComponent } from './program/program.component';
import { DepartmentComponent } from './department/department.component';
import { SubjectComponent } from './subject/subject.component';
import { BankaccountsComponent } from './bankaccounts/bankaccounts.component';

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
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrgmastersRoutingModule {}
