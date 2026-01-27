import { Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-cheque-extension-view',
  standalone: false,
  templateUrl: './cheque-extension-view.component.html',
  styleUrl: './cheque-extension-view.component.scss'
})
export class ChequeExtensionViewComponent implements OnInit {
  private moduleName = 'accounts';
  entiId: any;
  requestId = '';
  loading = false;
  doc: any = null;
  showApproveModal = false;
  showRejectModal = false;
  approveForm!: FormGroup;
  rejectForm!: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private commonApi: CommonapiService,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private fb: FormBuilder,
    private location: Location
  ) {
    this.entiId = localStorage.getItem('tenantId');
  }

  ngOnInit(): void {
    this.requestId = String(this.route.snapshot.paramMap.get('id') || '').trim();
    this.breadcrumb.set([
      { label: 'Accounts' },
      { label: 'Cheque Extensions' },
      { label: 'View' },
    ]);
    this.approveForm = this.fb.group({
      approvalRemarks: [''],
    });
    this.rejectForm = this.fb.group({
      approvalRemarks: ['', [Validators.required, Validators.maxLength(500)]],
    });
    if (!this.requestId) {
      this.alert.error('Invalid requestId');
      return;
    }
    this.load();
  }

  back() {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigate(['/app/accounts/extension']);
  }

  canApproveReject(): boolean {
    const st = String(this.doc?.status || '').toUpperCase();
    return !!this.doc && !this.loading && st === 'PENDING';
  }

  statusBadge(status: string): string {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING') return 'bg-warning text-dark';
    if (s === 'APPROVED') return 'bg-success';
    if (s === 'REJECTED') return 'bg-danger';
    return 'bg-light text-dark';
  }

  load() {
    this.loading = true;
    const payload = { entiId: this.entiId, requestId: this.requestId };
    this.commonApi.fetchData(payload, this.moduleName, 'cheque/extension/view').subscribe({
      next: (res: any) => {
        this.loading = false;
        const d = res?.data || {};
        this.doc = d?.request || d || null;
      },
      error: (err: any) => {
        this.loading = false;
        this.doc = null;
        this.alert.error(err?.error?.message || 'Failed to load request');
      },
    });
  }

  openChequeView() {
    const pid = String(this.doc?.paymentId || '').trim();
    if (!pid) return;
    this.router.navigate(['/app/accounts/cheques', pid]);
  }

  openApproveModal() {
    if (!this.canApproveReject()) return;
    this.approveForm.reset({ approvalRemarks: '' });
    this.showApproveModal = true;
  }

  closeApproveModal() {
    this.showApproveModal = false;
  }

  approve() {
    if (!this.canApproveReject()) return;
    const v = this.approveForm.value || {};
    const payload = {
      entiId: this.entiId,
      requestId: this.requestId,
      approvalRemarks: String(v.approvalRemarks || '').trim() || null,
    };
    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, 'cheque/extension/approve').subscribe({
      next: (res: any) => {
        this.loading = false;
        this.alert.success(res?.message || 'Request approved');
        this.showApproveModal = false;
        this.load();
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Failed to approve request');
      },
    });
  }

  openRejectModal() {
    if (!this.canApproveReject()) return;
    this.rejectForm.reset({ approvalRemarks: '' });
    this.showRejectModal = true;
  }

  closeRejectModal() {
    this.showRejectModal = false;
  }

  reject() {
    if (!this.canApproveReject()) return;
    if (this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      this.alert.error('Rejection remarks required');
      return;
    }
    const v = this.rejectForm.value || {};
    const payload = {
      entiId: this.entiId,
      requestId: this.requestId,
      approvalRemarks: String(v.approvalRemarks || '').trim(),
    };
    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, 'cheque/extension/reject').subscribe({
      next: (res: any) => {
        this.loading = false;
        this.alert.success(res?.message || 'Request rejected');
        this.showRejectModal = false;
        this.load();
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Failed to reject request');
      },
    });
  }
}
