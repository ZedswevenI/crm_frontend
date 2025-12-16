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

@NgModule({
  declarations: [AdmissionsComponent, ListComponent, AdmissionviewComponent, AdmissionreportsComponent, AdmissioncommunicationComponent, AdmissionfeecalComponent],
  imports: [CommonModule, AdmissionsRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class AdmissionsModule {}
