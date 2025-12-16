import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EntryComponent } from './entry/entry.component';
import { AbsenteesComponent } from './absentees/absentees.component';
import { FollowupComponent } from './followup/followup.component';
import { ReportsComponent } from './reports/reports.component';

const routes: Routes = [{ path: 'entry', component: EntryComponent }, { path: 'absentees', component: AbsenteesComponent }, { path: 'followup', component: FollowupComponent }, { path: 'reports', component: ReportsComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AttendenceRoutingModule {}
