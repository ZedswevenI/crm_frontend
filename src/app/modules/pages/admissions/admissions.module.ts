import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { AdmissionsRoutingModule } from './admissions-routing.module';
import { AdmissionsComponent } from './admissions/admissions.component';
import { ListComponent } from './list/list.component';
import { AdmissionviewComponent } from './admissionview/admissionview.component';
import { AdmissionreportsComponent } from './admissionreports/admissionreports.component';
import { AdmissioncommunicationComponent } from './admissioncommunication/admissioncommunication.component';
import { AdmissionfeecalComponent } from './admissionfeecal/admissionfeecal.component';
import { AdmissionpaymentsEditorComponent } from './admissionpayments-editor/admissionpayments-editor.component';
import { AdmissionEditComponent } from './admission-edit/admission-edit.component';
import { AdmissionbugComponent } from './admissionbug/admissionbug.component';
import { AdmissionWaitComponent } from './admission-wait/admission-wait.component';
import { StudentuploadComponent } from './studentupload/studentupload.component';
import { AdmissionviewnewComponent } from './admissionviewnew/admissionviewnew.component';
import { PrintAcknowledgementComponent } from './print-acknowledgement/print-acknowledgement.component';

@NgModule({
  declarations: [
    AdmissionsComponent,
    ListComponent,
    AdmissionviewComponent,
    AdmissionreportsComponent,
    AdmissionWaitComponent,
    AdmissioncommunicationComponent,
    AdmissionfeecalComponent,
    AdmissionpaymentsEditorComponent,
    AdmissionEditComponent,
    AdmissionbugComponent,
    StudentuploadComponent,
    AdmissionviewnewComponent,
    PrintAcknowledgementComponent
  ],
  imports: [CommonModule, AdmissionsRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class AdmissionsModule {}
