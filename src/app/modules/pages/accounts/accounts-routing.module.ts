import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ChequeComponent } from './cheque/cheque.component';
import { ChequeViewComponent } from './cheque-view/cheque-view.component';
import { ChequeDepositComponent } from './deposit-batch/cheque-deposit/cheque-deposit.component';
import { ChequeExtensionComponent } from './cheque-extension/cheque-extension/cheque-extension.component';
import { NeftRegisterComponent } from './neft-register/neft-register.component';
import { PaymentsComponent } from './payments/payments/payments.component';
import { ChequeDepositViewComponent } from './deposit-batch/cheque-deposit-view/cheque-deposit-view.component';
import { ChequeExtensionViewComponent } from './cheque-extension/cheque-extension-view/cheque-extension-view.component';
import { ChequeReplaceHistoryComponent } from './cheque-replace-history/cheque-replace-history.component';
import { StudentFeePaymentComponent } from './student-fee-payment/student-fee-payment.component';
import { PermissionGuard } from '../../../shared/permission.guard';

const routes: Routes = [
  {
    path: 'student-fee',
    component: StudentFeePaymentComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'accounts:addPayment' }
  },
  {
    path: 'cheques',
    component: ChequeComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'accounts:listCheques' }
  },
  {
    path: 'cheques/:id',
    component: ChequeViewComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'accounts:listCheques' }
  },
  {
    path: 'deposit',
    component: ChequeDepositComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'accounts:depositBatch' }
  },
  {
    path: 'deposit/:id',
    component: ChequeDepositViewComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'accounts:depositBatch' }
  },
  {
    path: 'extention',
    component: ChequeExtensionComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'accounts:chequeExtension' }
  },
  {
    path: 'extention/:id',
    component: ChequeExtensionViewComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'accounts:chequeExtension' }
  },
  {
    path: 'neft',
    component: NeftRegisterComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'accounts:listNeft' }
  },
  {
    path: 'payments',
    component: PaymentsComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'accounts:listPayments' }
  },
  {
    path: 'replacements',
    component: ChequeReplaceHistoryComponent,
    canActivate: [PermissionGuard],
    data: { permission: 'accounts:chequeReplacement' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AccountsRoutingModule {}
