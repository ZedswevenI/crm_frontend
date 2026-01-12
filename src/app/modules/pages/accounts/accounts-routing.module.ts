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

const routes: Routes = [
  {
    path: 'cheques',
    component: ChequeComponent
  },
  {
    path: 'cheques/:id',
    component: ChequeViewComponent
  },
  {
    path: 'deposit',
    component: ChequeDepositComponent
  },
  {
    path: 'deposit/:id',
    component: ChequeDepositViewComponent
  },
  {
    path: 'extention',
    component: ChequeExtensionComponent
  },
  {
    path: 'extention/:id',
    component: ChequeExtensionViewComponent
  },
  {
    path: 'neft',
    component: NeftRegisterComponent
  },
  {
    path: 'payments',
    component: PaymentsComponent
  },
  {
    path: 'replacements',
    component: ChequeReplaceHistoryComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AccountsRoutingModule {}
