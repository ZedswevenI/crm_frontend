import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';

type ChequeMode = 'PDC' | 'CDC';

@Component({
  selector: 'app-admissionpayments-editor',
  standalone: false,
  templateUrl: './admissionpayments-editor.component.html',
  styleUrl: './admissionpayments-editor.component.scss'
})
export class AdmissionpaymentsEditorComponent implements OnChanges {
  @Input() admissionId = '';
  @Input() finalFee = 0;
  @Input() existingPayments: any[] = [];

  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  loading = false;
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private api: CommonapiService,
    private alert: AlertService
  ) {
    this.form = this.fb.group({
      neftRefs: this.fb.array([]),
      cheques: this.fb.array([]),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['existingPayments'] || changes['admissionId']) {
      this.buildFromExisting();
    }
  }

  get neftFA(): FormArray {
    return this.form.get('neftRefs') as FormArray;
  }
  get chequesFA(): FormArray {
    return this.form.get('cheques') as FormArray;
  }

  // ✅ these are what template will iterate (FormGroup[])
  get neftGroups(): FormGroup[] {
    return this.neftFA.controls as FormGroup[];
  }
  get chequeGroups(): FormGroup[] {
    return this.chequesFA.controls as FormGroup[];
  }

  private pickTenantId(): string {
    const t1 = (localStorage.getItem('entiId') || '').trim();
    const t2 = (localStorage.getItem('tenantId') || '').trim();
    return t1 || t2;
  }

  private pickUserId(): string {
    return String(localStorage.getItem('userId') || '').trim();
  }

  private buildFromExisting(): void {
    this.form.setControl('neftRefs', this.fb.array([]));
    this.form.setControl('cheques', this.fb.array([]));

    const payments = Array.isArray(this.existingPayments) ? this.existingPayments : [];
    const nefts = payments.filter(p => String(p.paymentType || '').toUpperCase() === 'NEFT');
    const cheques = payments.filter(p => String(p.paymentType || '').toUpperCase() === 'CHEQUE');

    if (!nefts.length) {
      this.addNeft();
    } else {
      nefts.forEach((p: any) => {
        this.neftFA.push(
          this.fb.group({
            utr: [String(p.neft?.utr || '').trim(), [Validators.required, Validators.minLength(6), Validators.maxLength(40)]],
            amount: [Number(p.amount || 0) || 0, [Validators.required, Validators.min(1)]],
            paidOn: [p.neft?.paidOn || null],
            bankName: [p.neft?.bankName || ''],
            referenceNote: [p.neft?.referenceNote || ''],
            remarks: [p.remarks || ''],
          })
        );
      });
    }

    if (cheques.length) {
      cheques.forEach((p: any, idx: number) => {
        this.chequesFA.push(
          this.fb.group({
            sno: [typeof p.cheque?.sno === 'number' ? p.cheque.sno : idx + 1],
            chequeDate: [{ value: p.cheque?.chequeDate || null, disabled: true }],
            dueDate: [p.cheque?.dueDate || null, [Validators.required]],
            favourOf: [{ value: p.cheque?.favourOf || '', disabled: true }],
            amount: [{ value: Number(p.amount || 0) || 0, disabled: true }],
            chequeNo: [String(p.cheque?.chequeNo || '').trim(), [Validators.required, Validators.minLength(4), Validators.maxLength(30)]],
            mode: [(p.cheque?.mode || 'PDC') as ChequeMode, [Validators.required]],
            bankName: [p.cheque?.bankName || ''],
            remarks: [p.remarks || ''],
          })
        );
      });
    }
  }

  addNeft(): void {
    this.neftFA.push(
      this.fb.group({
        utr: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(40)]],
        amount: [0, [Validators.required, Validators.min(1)]],
        paidOn: [null],
        bankName: [''],
        referenceNote: [''],
        remarks: [''],
      })
    );
  }

  removeNeft(i: number): void {
    if (this.neftFA.length <= 1) return;
    this.neftFA.removeAt(i);
  }

  save(): void {
    if (this.loading) return;

    const tenantId = this.pickTenantId();
    const userId = this.pickUserId();

    if (!tenantId || !userId) {
      this.alert.error('tenantId/userId missing. Please login again.');
      return;
    }
    if (!this.admissionId) {
      this.alert.error('admissionId missing');
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.alert.warning('Please fix validation errors');
      return;
    }

    const body: any = {
      entiId: tenantId,
      userId,
      admissionId: this.admissionId,
      neftRefs: this.neftFA.getRawValue(),
      cheques: this.chequesFA.getRawValue(),
    };

    this.loading = true;
    this.api.fetchData(body, 'admi', 'savepayments').subscribe({
      next: (resp: any) => {
        this.loading = false;
        if (!resp?.status) {
          this.alert.error(resp?.message || 'Failed to save payments');
          return;
        }
        this.saved.emit();
      },
      error: () => {
        this.loading = false;
        this.alert.error('Failed to save payments');
      }
    });
  }

  close(): void {
    this.cancel.emit();
  }
}