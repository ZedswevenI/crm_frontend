import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { EnrollmentRoutingModule } from './enrollment-routing.module';
import { EnrolmentComponent } from './enrolment/enrolment.component';

@NgModule({
  declarations: [EnrolmentComponent],
  imports: [CommonModule, EnrollmentRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class EnrollmentModule {}
