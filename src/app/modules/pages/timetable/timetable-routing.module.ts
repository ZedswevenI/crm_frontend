import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TimetableComponent } from './timetable/timetable.component';
import { ViewComponent } from './view/view.component';

const routes: Routes = [{ path: '', component: TimetableComponent }, { path: 'view/:id', component: ViewComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TimetableRoutingModule {}
