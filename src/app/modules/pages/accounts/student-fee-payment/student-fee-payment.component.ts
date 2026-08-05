import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

interface StudentHit {
  admissionNo: string;
  name: string;
  programName: string;
  centerName: string;
}

const CATEGORY_OPTIONS = [
  { value: 'HOSTEL', label: 'Hostel' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous' },
  { value: 'OTHER', label: 'Other' },
];

@Component({
  selector: 'app-student-fee-payment',
  standalone: false,
  templateUrl: './student-fee-payment.component.html',
  styleUrl: './student-fee-payment.component.scss',
})
export class StudentFeePaymentComponent implements OnInit {
  private moduleName = 'accounts';
  private studentModule = 'student';

  readonly DEFAULT_FAVOUR_OF = 'ZEDSWEVEN I PRIVATE LIMITED';

  readonly bankNames: string[] = [
    'STATE BANK OF INDIA',
    'HDFC BANK',
    'ICICI BANK',
    'AXIS BANK',
    'KOTAK MAHINDRA BANK',
    'PUNJAB NATIONAL BANK',
    'BANK OF BARODA',
    'CANARA BANK',
    'UNION BANK OF INDIA',
    'IDFC FIRST BANK',
    'INDUSIND BANK',
    'YES BANK',
    'FEDERAL BANK',
    'INDIAN BANK',
    'IDBI BANK',
    'UCO BANK',
    'CENTRAL BANK OF INDIA',
    'BANK OF INDIA',
    'BANK OF MAHARASHTRA',
    'PUNJAB & SIND BANK',
  ];

  categoryOptions = CATEGORY_OPTIONS;

  form!: UntypedFormGroup;

  // ── Student search ──────────────────────────────────────────────────────
  studentSearch = '';
  studentResults: StudentHit[] = [];
  searching = false;
  selectedStudent: StudentHit | null = null;
  private searchDebounce: any;

  submitting = false;

  constructor(
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private location: Location,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private api: CommonapiService,
  ) {
    this.breadcrumb.set([{ label: 'Accounts' }, { label: 'Add Payment' }]);
  }

  cancel(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.buildForm();

    // Deep-linked from the student profile screen with the student already
    // known — skip the search step and prefill directly.
    const params = this.route.snapshot.queryParamMap;
    const admissionNo = params.get('admissionNo');
    if (admissionNo) {
      this.selectedStudent = {
        admissionNo,
        name: params.get('studentName') || '',
        programName: params.get('programName') || '',
        centerName: params.get('centerName') || '',
      };
    }
  }

  private buildForm(): void {
    this.form = this.fb.group({
      paymentCategory: ['HOSTEL', Validators.required],
      customCategory: [''],
      categoryLabel: [''],
      cheques: this.fb.array([]),
      neftRefs: this.fb.array([]),
      otherPayments: this.fb.array([]),
    });
  }

  get chequesFA(): UntypedFormArray {
    return this.form.get('cheques') as UntypedFormArray;
  }

  get neftRefsFA(): UntypedFormArray {
    return this.form.get('neftRefs') as UntypedFormArray;
  }

  get otherPaymentsFA(): UntypedFormArray {
    return this.form.get('otherPayments') as UntypedFormArray;
  }

  get isOtherCategory(): boolean {
    return this.form?.get('paymentCategory')?.value === 'OTHER';
  }

  // ── Student search ──────────────────────────────────────────────────────
  onStudentSearchInput(): void {
    clearTimeout(this.searchDebounce);
    if (!this.studentSearch || this.studentSearch.trim().length < 2) {
      this.studentResults = [];
      return;
    }
    this.searchDebounce = setTimeout(() => this.runStudentSearch(), 300);
  }

  private runStudentSearch(): void {
    const tenantId = localStorage.getItem('tenantId') || '';
    if (!tenantId) return;
    this.searching = true;
    const query = `list?page=1&limit=10&search=${encodeURIComponent(this.studentSearch.trim())}`;
    this.api
      .fetchData({ entiId: tenantId }, this.studentModule, query)
      .subscribe({
        next: (res: any) => {
          this.searching = false;
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.studentResults = rows.map((r: any) => ({
            admissionNo: r?.admissionNo || '',
            name: r?.student?.name || '',
            programName: r?.programName || '',
            centerName: r?.centerName || '',
          }));
        },
        error: () => {
          this.searching = false;
          this.studentResults = [];
        },
      });
  }

  pickStudent(student: StudentHit): void {
    this.selectedStudent = student;
    this.studentResults = [];
    this.studentSearch = '';
  }

  clearStudent(): void {
    this.selectedStudent = null;
  }

  // ── Cheque rows (manual add/remove) ────────────────────────────────────
  addChequeRow(): void {
    this.chequesFA.push(
      this.fb.group({
        chequeNo: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(20)]],
        chequeDate: ['', Validators.required],
        dueDate: ['', Validators.required],
        favourOf: [this.DEFAULT_FAVOUR_OF, Validators.required],
        mode: ['PDC', Validators.required],
        bankName: ['', Validators.required],
        amount: [null, [Validators.required, Validators.min(1)]],
        description: [''],
      }),
    );
  }

  removeChequeRow(i: number): void {
    this.chequesFA.removeAt(i);
  }

  // ── NEFT rows (manual add/remove) ──────────────────────────────────────
  addNeftRow(): void {
    this.neftRefsFA.push(
      this.fb.group({
        utr: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(40)]],
        amount: [null, [Validators.required, Validators.min(1)]],
        paidOn: ['', Validators.required],
        bankName: [''],
        branchName: [''],
        referenceNote: [''],
      }),
    );
  }

  removeNeftRow(i: number): void {
    this.neftRefsFA.removeAt(i);
  }

  // ── Other payment rows (manual add/remove) ─────────────────────────────
  addOtherRow(): void {
    this.otherPaymentsFA.push(
      this.fb.group({
        mode: ['UPI', Validators.required],
        amount: [null, [Validators.required, Validators.min(1)]],
        paidOn: [''],
        refNo: [''],
        bankName: [''],
        branchName: [''],
        referenceNote: [''],
      }),
    );
  }

  removeOtherRow(i: number): void {
    this.otherPaymentsFA.removeAt(i);
  }

  get totalRowCount(): number {
    return this.chequesFA.length + this.neftRefsFA.length + this.otherPaymentsFA.length;
  }

  get canSubmit(): boolean {
    return (
      !this.submitting &&
      !!this.selectedStudent &&
      this.totalRowCount > 0 &&
      this.form.valid
    );
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (!this.selectedStudent) {
      this.alert.error('Search and select a student first.');
      return;
    }
    if (!this.totalRowCount) {
      this.alert.error('Add at least one cheque, NEFT or other payment row.');
      return;
    }
    if (this.form.invalid) {
      this.alert.error('Please fill all required payment fields.');
      return;
    }
    const tenantId = localStorage.getItem('tenantId') || '';
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }
    const raw = this.form.getRawValue();
    const paymentCategory =
      raw.paymentCategory === 'OTHER'
        ? String(raw.customCategory || '').trim().toUpperCase() || 'OTHER'
        : raw.paymentCategory;

    const body: any = {
      tenantId,
      userId: localStorage.getItem('userid') || '',
      admissionNo: this.selectedStudent.admissionNo,
      paymentCategory,
      categoryLabel: raw.categoryLabel || undefined,
      cheques: raw.cheques,
      neftRefs: raw.neftRefs,
      otherPayments: raw.otherPayments,
    };

    this.submitting = true;
    this.api.fetchData(body, this.moduleName, 'student-fee/add').subscribe({
      next: (res: any) => {
        this.submitting = false;
        if (!res?.status) {
          this.alert.error(res?.message || 'Failed to add payment');
          return;
        }
        const count = res?.data?.count ?? this.totalRowCount;
        const total = res?.data?.totalAmount ?? 0;
        this.alert.success(`${count} payment row(s) added (₹${total}).`);
        this.resetRows();
      },
      error: (err: any) => {
        this.submitting = false;
        this.alert.error(err?.error?.message || 'Failed to add payment');
      },
    });
  }

  private resetRows(): void {
    // Keep the selected student — staff often log several fee categories
    // for the same student back to back.
    this.chequesFA.clear();
    this.neftRefsFA.clear();
    this.otherPaymentsFA.clear();
    this.form.patchValue({ categoryLabel: '', customCategory: '' });
  }
}
