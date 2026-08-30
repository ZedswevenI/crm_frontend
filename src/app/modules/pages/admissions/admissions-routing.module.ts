import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListComponent } from './list/list.component';

import { AdmissionreportsComponent } from './admissionreports/admissionreports.component';
import { AdmissioncommunicationComponent } from './admissioncommunication/admissioncommunication.component';
import { AdmissionfeecalComponent } from './admissionfeecal/admissionfeecal.component';
import { AdmissionpaymentsEditorComponent } from './admissionpayments-editor/admissionpayments-editor.component';
import { AdmissionEditComponent } from './admission-edit/admission-edit.component';
import { AdmissionbugComponent } from './admissionbug/admissionbug.component';
import { AdmissionNewFlatComponent } from './admission-new-flat/admission-new-flat.component';
import { AdmissionWaitComponent } from './admission-wait/admission-wait.component';
import { AdmissionviewnewComponent } from './admissionviewnew/admissionviewnew.component';
import { StudentuploadComponent } from './studentupload/studentupload.component';
import { PrintAcknowledgementComponent } from './print-acknowledgement/print-acknowledgement.component';
import { AdmissionApproveComponent } from './admission-approve/admission-approve.component';
import { PermissionGuard } from '../../../shared/permission.guard';

const routes: Routes = [
  { path: '', component: ListComponent, canActivate: [PermissionGuard], data: { permission: ['admission:list', 'admission:view'] } },
  { path: 'waitforapproval', component: AdmissionWaitComponent, canActivate: [PermissionGuard], data: { permission: ['admission:list', 'admission:review'] } },
  { path: 'new', component: AdmissionbugComponent, canActivate: [PermissionGuard], data: { permission: 'admission:create' } },
  { path: 'new-flat', component: AdmissionNewFlatComponent, canActivate: [PermissionGuard], data: { permission: 'admission:create' } },
  { path: 'print/acknowledgement', component: PrintAcknowledgementComponent, canActivate: [PermissionGuard], data: { permission: 'admission:create' } },
  { path: 'view/:id', component: AdmissionviewnewComponent, canActivate: [PermissionGuard], data: { permission: 'admission:view' } },
  { path: 'reports', component: AdmissionreportsComponent, canActivate: [PermissionGuard], data: { permission: 'admission:export' } },
  { path: 'communication', component: AdmissioncommunicationComponent, canActivate: [PermissionGuard], data: { permission: 'admission:list' } },
  { path: 'fee-calculator', component: AdmissionfeecalComponent, canActivate: [PermissionGuard], data: { permission: 'admission:create' } },
  { path: 'payments/edit/:id', component: AdmissionpaymentsEditorComponent, canActivate: [PermissionGuard], data: { permission: 'admission:update' } },
  { path: 'edit/:id', component: AdmissionEditComponent, canActivate: [PermissionGuard], data: { permission: 'admission:update' } },
  { path: 'student/upload', component: StudentuploadComponent, canActivate: [PermissionGuard], data: { permission: 'admission:bulkUpload' } },
  { path: 'approve/:id', component: AdmissionApproveComponent, canActivate: [PermissionGuard], data: { permission: ['admission:approve', 'admission:reject', 'admission:review'] } }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdmissionsRoutingModule {}
