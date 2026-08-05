import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { UiElementsModule } from '../../ui-elements/ui-elements.module';

import { AccountsRoutingModule } from './accounts-routing.module';
import { PaymentsComponent } from './payments/payments/payments.component';
import { ChequeComponent } from './cheque/cheque.component';
import { ChequeDepositComponent } from './deposit-batch/cheque-deposit/cheque-deposit.component';
import { ChequeExtensionComponent } from './cheque-extension/cheque-extension/cheque-extension.component';
import { ChequeMergeComponent } from './cheque-merge/cheque-merge.component';
import { NeftRegisterComponent } from './neft-register/neft-register.component';
import { PaymentsviewComponent } from './payments/paymentsview/paymentsview.component';
import { ChequeDepositCreateComponent } from './deposit-batch/cheque-deposit-create/cheque-deposit-create.component';
import { ChequeDepositViewComponent } from './deposit-batch/cheque-deposit-view/cheque-deposit-view.component';
import { ChequeExtensionRequestComponent } from './cheque-extension/cheque-extension-request/cheque-extension-request.component';
import { ChequeExtensionViewComponent } from './cheque-extension/cheque-extension-view/cheque-extension-view.component';
import { ChequeReplaceHistoryComponent } from './cheque-replace-history/cheque-replace-history.component';
import { ChequeViewComponent } from './cheque-view/cheque-view.component';
import { StudentFeePaymentComponent } from './student-fee-payment/student-fee-payment.component';

@NgModule({
  declarations: [
    PaymentsComponent,
    ChequeComponent,
    ChequeDepositComponent,
    ChequeExtensionComponent,
    ChequeMergeComponent,
    NeftRegisterComponent,
    PaymentsviewComponent,
    ChequeDepositCreateComponent,
    ChequeDepositViewComponent,
    ChequeExtensionRequestComponent,
    ChequeExtensionViewComponent,
    ChequeReplaceHistoryComponent,
    ChequeViewComponent,
    StudentFeePaymentComponent
  ],
  imports: [CommonModule, AccountsRoutingModule, FormsModule, ReactiveFormsModule, UiElementsModule]
})
export class AccountsModule {}
