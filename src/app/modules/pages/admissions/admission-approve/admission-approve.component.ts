import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

interface ApprovalListItem {
  id: string;
  admissionNo: string;
  name: string;
  regNo: string;
  programName: string;
  centerName: string;
  finalFee: number;
}

interface AdmissionDetail {
  admissionId: string;
  admissionNo: string;
  workflowStage: string;
  reviewRemarks?: string | null;
  rejectionReason?: string | null;
  student: {
    name: string;
    regNo?: string | null;
    phone: string;
    parentName: string;
    parentPhone: string;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  };
  academics: {
    centreName: string;
    programName: string;
    batchName?: string | null;
    duration?: any;
  };
  test: {
    testName?: string | null;
    score?: number | null;
  };
  fee: {
    feePlanName: string;
    baseFee: number;
    finalFee: number;
    testScholarshipPct: number;
    scholarshipPct: number;
    additionalScholarshipPct: number;
    breakup: Array<{ label: string; total: number; scholBenefits: number }>;
  };
  payments: {
    neftSplitAmount: number;
    neftTotalEntered: number;
    neftRefs: Array<{ utrNo: string; amount: number; paidOn?: number | null }>;
    chequeSummary: {
      totalCheques: number;
      totalAmount: number;
      pendingCount: number;
    };
    cheques: Array<{
      sno: number;
      chequeDate: number | null;
      dueDate: number | null;
      favourOf: string;
      amount: number;
      chequeNo: string;
      mode: string;
      status: string;
    }>;
    otherPayments: Array<{
      mode: string;
      refNo: string;
      amount: number;
      paidOn: number | null;
    }>;
  };
  schoolMarks?: {
    overallPct?: any;
    coreSubjectPct?: any;
    remarks?: string | null;
  };
  createdByName?: string;
}

@Component({
  selector: 'app-admission-approve',
  standalone: false,
  templateUrl: './admission-approve.component.html',
  styleUrl: './admission-approve.component.scss',
})
export class AdmissionApproveComponent implements OnInit {
  // Queue
  queue: ApprovalListItem[] = [];
  queueLoading = true;
  currentIndex = 0;

  // Current admission
  admission!: AdmissionDetail;
  admissionNo = '';
  rawPayments: any[] = [];
  loading = false;

  // Actions
  actionBusy = false;

  // Reject modal
  rejectModalOpen = false;
  rejectReason = '';

  // Hold modal
  holdModalOpen = false;
  holdRemarks = '';

  // Done state
  allDone = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private api: CommonapiService,
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Admissions' },
      { label: 'Approve Queue' },
    ]);
  }

  ngOnInit(): void {
    const startId = String(this.route.snapshot.paramMap.get('id') || '').trim();
    this.loadQueue(startId);
  }

  // ─── Queue ───────────────────────────────────────────────

  private loadQueue(startId: string): void {
    this.queueLoading = true;
    const tenantId = this.pickTenantId();
    const body = { entiId: tenantId };
    this.api
      .fetchData(body, 'admi', 'list?status=waiting&limit=200&page=1')
      .subscribe({
        next: (res: any) => {
          this.queueLoading = false;
          const raw = Array.isArray(res.data)
            ? res.data
            : res.data?.rows || res.data?.items || [];

          this.queue = (Array.isArray(raw) ? raw : [])
            .filter((a: any) =>
              String(a?.workflow?.stage || a?.status || '')
                .toUpperCase()
                .includes('APPROVAL_SENT'),
            )
            .map((a: any) => ({
              id: String(a.admissionId || a._id || a.id || '').trim(),
              admissionNo: String(a.admissionNo || '').trim(),
              name: String(a?.student?.name || '').trim(),
              regNo: String(a.registrationNumber || a.regNo || '').trim(),
              programName: String(a.programName || '').trim(),
              centerName: String(a.centerName || '').trim(),
              finalFee: Number(a?.fee?.finalFee || 0),
            }))
            .filter((a: ApprovalListItem) => !!a.id);

          if (!this.queue.length) {
            this.allDone = true;
            return;
          }

          // Find start index
          const idx = this.queue.findIndex((q) => q.id === startId);
          this.currentIndex = idx >= 0 ? idx : 0;
          this.loadAdmission(this.queue[this.currentIndex].id);
        },
        error: () => {
          this.queueLoading = false;
          this.alert.error('Failed to load approval queue');
        },
      });
  }

  // ─── Current Admission ───────────────────────────────────

  loadAdmission(id: string): void {
    this.loading = true;
    const tenantId = this.pickTenantId();
    this.api
      .fetchData({ admissionId: id, entiId: tenantId }, 'admi', 'view')
      .subscribe({
        next: (resp: any) => {
          this.loading = false;
          if (!resp?.status || !resp?.data?.admission) {
            this.alert.error('Failed to load admission');
            return;
          }
          this.rawPayments = Array.isArray(resp.data.payments)
            ? resp.data.payments
            : [];
          this.admission = this.mapAdmission(
            resp.data.admission,
            this.rawPayments,
          );
          this.admissionNo = this.admission.admissionNo;
          // Update URL without navigation
          window.history.replaceState({}, '', `/app/admissions/approve/${id}`);
        },
        error: () => {
          this.loading = false;
          this.alert.error('Failed to load admission details');
        },
      });
  }

  private mapAdmission(adm: any, payments: any[]): AdmissionDetail {
    const neftRefs = payments
      .filter((p) => String(p.paymentType || '').toUpperCase() === 'NEFT')
      .map((p) => ({
        utrNo: String(p.neft?.utr || '').trim(),
        amount: Number(p.amount || 0),
        paidOn: typeof p.neft?.paidOn === 'number' ? p.neft.paidOn : null,
      }))
      .filter((x) => !!x.utrNo && x.amount > 0);

    const cheques = payments
      .filter((p) => String(p.paymentType || '').toUpperCase() === 'CHEQUE')
      .map((p, idx) => ({
        sno: typeof p.cheque?.sno === 'number' ? p.cheque.sno : idx + 1,
        chequeDate:
          typeof p.cheque?.chequeDate === 'number' ? p.cheque.chequeDate : null,
        dueDate:
          typeof p.cheque?.dueDate === 'number' ? p.cheque.dueDate : null,
        favourOf: String(p.cheque?.favourOf || '').trim(),
        amount: Number(p.amount || 0),
        chequeNo: String(p.cheque?.chequeNo || '').trim(),
        mode: String(p.cheque?.mode || 'PDC').trim(),
        status: String(p.status || 'pending').toLowerCase(),
      }))
      .filter((x) => x.amount > 0);

    const otherPayments = payments
      .filter((p) => String(p.paymentType || '').toUpperCase() === 'OTHER')
      .map((p) => ({
        mode: String(p.other?.mode || 'OTHER').toUpperCase(),
        refNo: String(p.other?.refNo || '—'),
        amount: Number(p.amount || 0),
        paidOn:
          typeof p.other?.paidOn === 'number' ? p.other.paidOn : p.submittedOn,
      }))
      .filter((x) => x.amount > 0);

    const breakup = (
      Array.isArray(adm?.fee?.breakup) ? adm.fee.breakup : []
    ).map((h: any) => ({
      label: String(h.label || '').trim(),
      total: Number(h.total ?? 0),
      scholBenefits: Number(h.scholBenefits ?? 0),
    }));

    const cs = adm?.payments?.chequeSummary || {};

    return {
      admissionId: String(adm.admissionId || ''),
      admissionNo: String(adm.admissionNo || ''),
      workflowStage: String(adm?.workflow?.stage || '').toUpperCase(),
      reviewRemarks: adm?.workflow?.reviewRemarks || null,
      rejectionReason: adm?.workflow?.rejectionReason || null,
      createdByName: adm.createdBy?.name || 'Admin',
      student: {
        name: adm.student?.name || '',
        regNo: adm.registrationNumber || null,
        phone: adm.student?.phone || '',
        parentName: adm.student?.parentName || adm.student?.fatherName || '',
        parentPhone: adm.student?.parentPhone || '',
        email: adm.student?.email || null,
        address: adm.student?.address || null,
        city: adm.student?.city || null,
        state: adm.student?.state || null,
        pincode: adm.student?.pincode || null,
      },
      academics: {
        centreName: adm.centerName || '',
        programName: adm.programName || '',
        batchName: adm.batchName || null,
        duration:
          adm.programId && typeof adm.programId === 'object'
            ? adm.programId.duration
            : null,
      },
      test: {
        testName: adm.test?.testName || null,
        score: adm.test?.normalizedScore
          ? Number(adm.test.normalizedScore)
          : null,
      },
      schoolMarks: {
        overallPct: adm?.schoolMarks?.overallPct ?? null,
        coreSubjectPct: adm?.schoolMarks?.coreSubjectPct ?? null,
        remarks: adm?.schoolMarks?.remarks || null,
      },
      fee: {
        feePlanName: adm.feePlanName || '',
        baseFee: Number(adm.fee?.baseFee || 0),
        finalFee: Number(adm.fee?.finalFee || 0),
        testScholarshipPct: Number(adm.fee?.testScholarshipPct || 0),
        scholarshipPct: Number(adm.fee?.scholarshipPct || 0),
        additionalScholarshipPct: Number(
          adm.fee?.additionalScholarshipPct || 0,
        ),
        breakup,
      },
      payments: {
        neftSplitAmount: Number(adm?.payments?.neft?.splitAmount || 0),
        neftTotalEntered: Number(adm?.payments?.neft?.totalEntered || 0),
        neftRefs,
        chequeSummary: {
          totalCheques: Number(cs.totalCheques || 0),
          totalAmount: Number(cs.totalAmount || 0),
          pendingCount: Number(cs.pendingCount || 0),
        },
        cheques,
        otherPayments,
      },
    };
  }

  // ─── Navigation ──────────────────────────────────────────

  get currentQueueItem(): ApprovalListItem | null {
    return this.queue[this.currentIndex] || null;
  }

  get hasPrev(): boolean {
    return this.currentIndex > 0;
  }

  get hasNext(): boolean {
    return this.currentIndex < this.queue.length - 1;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get positionLabel(): string {
    return `${this.currentIndex + 1} of ${this.queue.length}`;
  }

  goNext(): void {
    if (!this.hasNext) {
      this.allDone = true;
      return;
    }
    this.currentIndex++;
    this.loadAdmission(this.queue[this.currentIndex].id);
  }

  goPrev(): void {
    if (!this.hasPrev) return;
    this.currentIndex--;
    this.loadAdmission(this.queue[this.currentIndex].id);
  }

  private advanceAfterAction(): void {
    // Remove current from queue
    this.queue.splice(this.currentIndex, 1);
    if (!this.queue.length) {
      this.allDone = true;
      return;
    }
    // Stay at same index (which is now the next item) or go to last
    if (this.currentIndex >= this.queue.length) {
      this.currentIndex = this.queue.length - 1;
    }
    this.loadAdmission(this.queue[this.currentIndex].id);
  }

  // ─── Actions ─────────────────────────────────────────────

  approve(): void {
    if (this.actionBusy) return;
    const tenantId = this.pickTenantId();
    this.actionBusy = true;
    this.api
      .fetchData(
        { entiId: tenantId, admissionId: this.admission.admissionId },
        'admi',
        'approve',
      )
      .subscribe({
        next: (resp: any) => {
          this.actionBusy = false;
          if (!resp?.status) {
            this.alert.error(resp?.message || 'Approval failed');
            return;
          }
          this.alert.success('Admission approved ✓');
          this.advanceAfterAction();
        },
        error: () => {
          this.actionBusy = false;
          this.alert.error('Approval failed');
        },
      });
  }

  // Reject
  openRejectModal(): void {
    this.rejectReason = '';
    this.rejectModalOpen = true;
  }
  closeRejectModal(): void {
    this.rejectModalOpen = false;
    this.rejectReason = '';
  }
  rejectNow(): void {
    const reason = (this.rejectReason || '').trim();
    if (!reason) {
      this.alert.warning('Please enter rejection remarks.');
      return;
    }
    if (this.actionBusy) return;
    const tenantId = this.pickTenantId();
    this.actionBusy = true;
    this.api
      .fetchData(
        {
          entiId: tenantId,
          admissionId: this.admission.admissionId,
          reason,
        },
        'admi',
        'reject',
      )
      .subscribe({
        next: (resp: any) => {
          this.actionBusy = false;
          if (!resp?.status) {
            this.alert.error(resp?.message || 'Reject failed');
            return;
          }
          this.alert.success('Admission rejected');
          this.closeRejectModal();
          this.advanceAfterAction();
        },
        error: () => {
          this.actionBusy = false;
          this.alert.error('Reject failed');
        },
      });
  }

  // Put On Hold
  openHoldModal(): void {
    this.holdRemarks = '';
    this.holdModalOpen = true;
  }
  closeHoldModal(): void {
    this.holdModalOpen = false;
    this.holdRemarks = '';
  }
  putOnHold(): void {
    const remarks = (this.holdRemarks || '').trim();
    if (!remarks) {
      this.alert.warning('Please enter hold remarks.');
      return;
    }
    if (this.actionBusy) return;
    const tenantId = this.pickTenantId();
    this.actionBusy = true;
    this.api
      .fetchData(
        {
          entiId: tenantId,
          admissionId: this.admission.admissionId,
          reviewRemarks: remarks,
        },
        'admi',
        'review',
      )
      .subscribe({
        next: (resp: any) => {
          this.actionBusy = false;
          if (!resp?.status) {
            this.alert.error(resp?.message || 'Failed to put on hold');
            return;
          }
          this.alert.success('Admission put on hold');
          this.closeHoldModal();
          this.advanceAfterAction();
        },
        error: () => {
          this.actionBusy = false;
          this.alert.error('Failed to put on hold');
        },
      });
  }

  // ─── Helpers ─────────────────────────────────────────────

  get neftTotal(): number {
    return (this.admission?.payments?.neftRefs || []).reduce(
      (s, n) => s + Number(n.amount || 0),
      0,
    );
  }

  get chequeTotal(): number {
    return (this.admission?.payments?.cheques || []).reduce(
      (s, c) => s + Number(c.amount || 0),
      0,
    );
  }

  get otherTotal(): number {
    return (this.admission?.payments?.otherPayments || []).reduce(
      (s, o) => s + Number(o.amount || 0),
      0,
    );
  }

  get grandTotal(): number {
    return this.neftTotal + this.chequeTotal + this.otherTotal;
  }

  goBack(): void {
    this.location.back();
  }

  private pickTenantId(): string {
    return (localStorage.getItem('tenantId') || '').trim();
  }

  get studentAddress(): string {
    if (!this.admission) return '—';
    const s = this.admission.student;
    return (
      [s.address, s.city, s.state, s.pincode].filter((v) => !!v).join(', ') ||
      '—'
    );
  }
}
