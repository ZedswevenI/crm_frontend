import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-cheque-replace-history',
  standalone: false,
  templateUrl: './cheque-replace-history.component.html',
  styleUrl: './cheque-replace-history.component.scss'
})
export class ChequeReplaceHistoryComponent {
  entiId: any;
  private moduleName = 'accounts';

  searchForm!: FormGroup;

  loading = false;
  chain: any[] = [];

  showViewModal = false;
  viewRow: any = null;
  private historyEndpoint = 'cheque/replacement-history';

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
    private router: Router
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([{ label: 'Accounts' }, { label: 'Cheque Replacements' }]);

    this.searchForm = this.fb.group({
      paymentId: [''],
    });
  }

  loadHistory() {
    const paymentId = String(this.searchForm.value?.paymentId || '').trim();
    if (!paymentId) {
      this.alert.error('Please enter paymentId');
      return;
    }

    this.loading = true;
    const payload = { entiId: this.entiId, paymentId };

    this.commonApi.fetchData(payload, this.moduleName, this.historyEndpoint).subscribe({
      next: (res: any) => {
        const chain = res?.data?.chain;
        this.chain = Array.isArray(chain) ? chain : [];
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        this.chain = [];
        this.alert.error(err?.error?.message || 'Failed to load replacement history');
      },
    });
  }

  reset() {
    this.searchForm.reset({ paymentId: '' });
    this.chain = [];
  }

  statusBadge(status: string): string {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING') return 'bg-warning text-dark';
    if (s === 'SUBMITTED') return 'bg-info text-dark';
    if (s === 'DEPOSITED') return 'bg-primary';
    if (s === 'CLEARED') return 'bg-success';
    if (s === 'FAILED') return 'bg-danger';
    if (s === 'CANCELLED') return 'bg-secondary';
    return 'bg-light text-dark';
  }

  openView(row: any) {
    this.viewRow = row;
    this.showViewModal = true;
  }

  closeView() {
    this.showViewModal = false;
    this.viewRow = null;
  }

  openChequeView(paymentId: string) {
    const pid = String(paymentId || '').trim();
    if (!pid) return;
    // same style you used in cheque screens
    this.router.navigate(['/app/accounts/cheques', pid]);
  }
}
