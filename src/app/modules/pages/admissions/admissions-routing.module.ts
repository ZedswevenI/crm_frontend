import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListComponent } from './list/list.component';

import { AdmissionsComponent } from './admissions/admissions.component';
import { AdmissionviewComponent } from './admissionview/admissionview.component';
import { AdmissionreportsComponent } from './admissionreports/admissionreports.component';
import { AdmissioncommunicationComponent } from './admissioncommunication/admissioncommunication.component';
import { AdmissionfeecalComponent } from './admissionfeecal/admissionfeecal.component';
import { AdmissionpaymentsEditorComponent } from './admissionpayments-editor/admissionpayments-editor.component';
import { AdmissionEditComponent } from './admission-edit/admission-edit.component';
import { AdmissionbugComponent } from './admissionbug/admissionbug.component';
import { AdmissionWaitComponent } from './admission-wait/admission-wait.component';
import { AdmissionviewnewComponent } from './admissionviewnew/admissionviewnew.component';
import { StudentuploadComponent } from './studentupload/studentupload.component';
import { Admissionviewnew1Component } from './admissionviewnew1/admissionviewnew1.component';

const routes: Routes = [
  { path: '', component: ListComponent },
  { path: 'waitforapproval', component: AdmissionWaitComponent },
  { path: 'new1', component: AdmissionsComponent },
  { path: 'new', component: AdmissionbugComponent },
  { path: 'view/:id', component: AdmissionviewnewComponent },
  { path: 'reports', component: AdmissionreportsComponent },
  { path: 'communication', component: AdmissioncommunicationComponent },
  { path: 'fee-calculator', component: AdmissionfeecalComponent },
  { path: 'payments/edit/:id', component: AdmissionpaymentsEditorComponent },
  { path: 'edit/:id', component: AdmissionEditComponent },
  { path: 'student/upload', component: StudentuploadComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdmissionsRoutingModule {}
