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

const routes: Routes = [
  { path: '', component: ListComponent },
  { path: 'new', component: AdmissionsComponent },
  { path: 'view/:id', component: AdmissionviewComponent },
  { path: 'reports', component: AdmissionreportsComponent },
  { path: 'communication', component: AdmissioncommunicationComponent },
  { path: 'fee-calculator', component: AdmissionfeecalComponent },
  { path: 'payments/edit/:id', component: AdmissionpaymentsEditorComponent },
  { path: 'edit/:id', component: AdmissionEditComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdmissionsRoutingModule {}
