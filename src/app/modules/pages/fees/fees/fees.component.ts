import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

type PayMode = 'NEFT' | 'CASH' | 'CARD' | 'CHEQUE';

@Component({
  selector: 'app-fees',
  standalone: false,
  templateUrl: './fees.component.html',
  styleUrl: './fees.component.scss'
})
export class FeesComponent implements OnInit {
  search = '';
  saving = false;

  showCollect = false;
  selected: any = null;

  lastReceiptNo: string | null = null;

  students: any[] = [
    { id: 'STD-1', regNo: '9001111012809250093', name: 'NIDHIN K', programName: 'Aspire 4 Year', centerName: 'Gandhipuram', finalFee: 835000, paidAmount: 150000, pendingAmount: 685000, status: 'pending' },
    { id: 'STD-2', regNo: 'JEE26-0001', name: 'Rohit Sharma', programName: 'JEE 2 Year', centerName: 'Gandhipuram', finalFee: 500000, paidAmount: 500000, pendingAmount: 0, status: 'paid' }
  ];
  filtered = [...this.students];
  
  //list
  collection = [];
  totalRecords = 0;
  loading = false;

  columns = [
    { key: 'regNo', label: 'Reg No', sortable: true },
    { key: 'name', label: 'Student', sortable: true },
    { key: 'programName', label: 'Program', sortable: true },
    { key: 'centerName', label: 'Centre', sortable: true },
    { key: 'finalFee', label: 'Final Fee', sortable: true },
    { key: 'paidAmount', label: 'Collected', sortable: true },
    { key: 'pendingAmount', label: 'Pending', sortable: true },
    { key: 'status', label: 'Status', sortable: false }
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-solid fa-indian-rupee-sign',
      tooltip: 'Collect Fee',
      color: '#2563EB',
      callback: (row: any) => this.openCollect(row)
    }
  ];

  collectForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private api: CommonapiService
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Fees' }, { label: 'Fee Collection' }]);
  }

  ngOnInit(): void {
    this.collectForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      mode: ['NEFT' as PayMode, Validators.required],
      paidOn: [this.todayISO()],

      utrNo: [''],
      txnRef: [''],

      chequeNo: [''],
      bank: [''],
      chequeDate: [null],

      remarks: ['']
    });

    this.collectForm.get('mode')?.valueChanges.subscribe((mode: PayMode) => {
      // reset validators each change
      this.collectForm.get('utrNo')?.clearValidators();
      this.collectForm.get('chequeNo')?.clearValidators();
      this.collectForm.get('bank')?.clearValidators();
      this.collectForm.get('chequeDate')?.clearValidators();

      if (mode === 'NEFT') this.collectForm.get('utrNo')?.setValidators([Validators.required, Validators.minLength(6)]);
      if (mode === 'CHEQUE') {
        this.collectForm.get('chequeNo')?.setValidators([Validators.required]);
        this.collectForm.get('bank')?.setValidators([Validators.required]);
        this.collectForm.get('chequeDate')?.setValidators([Validators.required]);
      }

      this.collectForm.get('utrNo')?.updateValueAndValidity();
      this.collectForm.get('chequeNo')?.updateValueAndValidity();
      this.collectForm.get('bank')?.updateValueAndValidity();
      this.collectForm.get('chequeDate')?.updateValueAndValidity();
    });
  }

   fetchTableData(params: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: string;
  }) {
    this.loading = true;

    // Pagination & Sort
    let sortParam = '';
    if (params.sortKey) {
      sortParam =
        params.sortDirection === 'desc'
          ? `-${params.sortKey}`
          : params.sortKey;
    }

    const query: any = {
      page: params.page,
      limit: params.pageSize
    };
    if (sortParam) query.sort = sortParam;
    if (params.search) query.search = params.search;

    // Build query string
    const queryString = Object.keys(query)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`
      )
      .join('&');

    const body = {
      entiId: localStorage.getItem('tenantId')
    };

    this.api.fetchData(body, 'ims/user', `list?list=full`).subscribe({
      next: (res: any) => {
        this.collection = res.data;
        this.totalRecords = res.data?.total || 0;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.alert.error('Error loading admissions');
      }
    });
  }

  f(name: string) {
    return this.collectForm.get(name)!;
  }

  applyFilter(): void {
    const q = (this.search || '').toLowerCase().trim();
    if (!q) {
      this.filtered = [...this.students];
      return;
    }
    this.filtered = this.students.filter(s =>
      String(s.regNo).toLowerCase().includes(q) ||
      String(s.name).toLowerCase().includes(q) ||
      String(s.centerName).toLowerCase().includes(q)
    );
  }

  reload(): void {
    this.applyFilter();
    this.alert.success('List refreshed (dummy).');
  }

  submitCollection(): void {
    if (this.collectForm.invalid || !this.selected) {
      this.collectForm.markAllAsTouched();
      return;
    }

    const amt = Number(this.collectForm.value.amount || 0);
    if (amt <= 0) return;

    // dummy update
    this.saving = true;
    setTimeout(() => {
      this.saving = false;

      this.selected.paidAmount = Number(this.selected.paidAmount || 0) + amt;
      this.selected.pendingAmount = Math.max(0, Number(this.selected.finalFee || 0) - this.selected.paidAmount);
      this.selected.status = this.selected.pendingAmount === 0 ? 'paid' : 'pending';

      this.lastReceiptNo = `RCPT-${Date.now().toString().slice(-6)}`;
      this.alert.success('Fee collected successfully (dummy).');

      this.applyFilter();
    }, 300);
  }

  printReceipt(): void {
    this.alert.success('Print receipt (dummy).');
  }

  private todayISO(): string {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  openCollect(row: any): void {
    this.selected = row;
    this.lastReceiptNo = null;

    document.body.classList.add('modal-open'); // ✅ add

    this.collectForm.reset({
      amount: row.pendingAmount > 0 ? Math.min(50000, row.pendingAmount) : null,
      mode: 'NEFT',
      paidOn: this.todayISO(),
      utrNo: '',
      txnRef: '',
      chequeNo: '',
      bank: '',
      chequeDate: null,
      remarks: ''
    });

    this.showCollect = true;
  }

  closeCollect(): void {
    this.showCollect = false;
    this.selected = null;
    this.lastReceiptNo = null;

    document.body.classList.remove('modal-open'); // ✅ remove
  }

}