import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InstituteComponent } from './institute/institute.component';
import { CenterComponent } from './center/center.component';
import { StaffComponent } from './staff/staff.component';
import { ProgramComponent } from './program/program.component';

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
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrgmastersRoutingModule {}
