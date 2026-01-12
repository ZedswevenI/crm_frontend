import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-bankaccounts',
  standalone: false,
  templateUrl: './bankaccounts.component.html',
  styleUrl: './bankaccounts.component.scss'
})
export class BankaccountsComponent implements OnInit {
  bankForm!: FormGroup;

  totalRecords = 0;
  bankData: any[] = [];

  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingRecId: string | null = null;

  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  // import modal
  showImport = false;
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;
  importDefaultCount = 0;
  importing = false;

  entiId: any;
  private moduleName = 'ims';

  columns = [
    { key: 'bankName', label: 'Bank', sortable: true },
    { key: 'accountName', label: 'Account Name', sortable: true },
    { key: 'accountNumber', label: 'Account Number', sortable: true },
    { key: 'ifsc', label: 'IFSC', sortable: false },
    { key: 'branch', label: 'Branch', sortable: false },
    { key: 'isDefault', label: 'Default', sortable: true },
    { key: 'statusFlag', label: 'Status', sortable: true },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      callback: (row: any) => this.edit(row),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      callback: (row: any) => this.openDelete(row),
    },
  ];

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Accounts' },
      { label: 'Bank Accounts' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadBankAccounts({ page: 1, pageSize: 10 });
  }

  // ---------------- FORM ----------------
  initForm() {
    this.bankForm = this.fb.group({
      bankName: ['', Validators.required],
      accountName: ['', Validators.required],
      accountNumber: ['', Validators.required],
      ifsc: [''],
      branch: [''],
      isDefault: [false],
      isActive: [true],
    });
  }

  private buildQueryParams(params: Record<string, any>) {
    const keys = Object.keys(params || {}).filter(
      (k) => params[k] !== undefined && params[k] !== null && params[k] !== ''
    );
    if (!keys.length) return '';
    const qs = keys
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
      .join('&');
    return `?${qs}`;
  }

  loadBankAccounts(event?: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
  }) {
    const page = event?.page || 1;
    const limit = event?.pageSize || 10;
    const search = (event?.search || '').toString().trim();
    const sortMap: any = {
      bankName: 'bankName',
      accountName: 'accountName',
      accountNumber: 'accountNumber',
      isDefault: 'isDefault',
      statusFlag: 'statusFlag',
    };
    const sortKey = event?.sortKey ? sortMap[event.sortKey] : null;
    const sort = sortKey ? (event?.sortDirection === 'asc' ? sortKey : `-${sortKey}`) : '';
    const payload = { entiId: this.entiId };
    const qp = this.buildQueryParams({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
    });
    this.commonApi.fetchData(payload, this.moduleName, `bankac/list${qp}`).subscribe({
      next: (res: any) => {
        const d = res?.data;
        const rows = Array.isArray(d?.rows) ? d.rows : Array.isArray(d) ? d : [];
        const total = d?.total ?? res?.count ?? rows.length ?? 0;
        this.totalRecords = total;
        this.bankData = rows.map((x: any) => ({
          recId: x._id,
          bankName: x.bankName,
          accountName: x.accountName,
          accountNumber: x.accountNumber,
          ifsc: x.ifsc || '-',
          branch: x.branch || '-',
          isDefault: x.isDefault === true,
          statusFlag: x.statusFlag || 'Active',
          _raw: x,
        }));
      },
      error: () => this.alert.error('Failed to load bank accounts'),
    });
  }

  add() {
    this.formMode = 'create';
    this.editingRecId = null;
    this.bankForm.reset({
      bankName: '',
      accountName: '',
      accountNumber: '',
      ifsc: '',
      branch: '',
      isDefault: false,
      isActive: true,
    });
    this.showForm = true;
  }

  edit(row: any) {
    const d = row._raw;
    this.formMode = 'edit';
    this.editingRecId = d._id;

    this.bankForm.patchValue({
      bankName: d.bankName || '',
      accountName: d.accountName || '',
      accountNumber: d.accountNumber || '',
      ifsc: d.ifsc || '',
      branch: d.branch || '',
      isDefault: d.isDefault === true,
      isActive: (d.statusFlag || 'Active') !== 'Inactive',
    });

    this.showForm = true;
  }

  save() {
    if (this.bankForm.invalid) {
      this.bankForm.markAllAsTouched();
      this.alert.error('Please fill all required fields');
      return;
    }

    const f = this.bankForm.value || {};
    const payload: any = {
      entiId: this.entiId,
      bankName: (f.bankName || '').toString().trim(),
      accountName: (f.accountName || '').toString().trim(),
      accountNumber: (f.accountNumber || '').toString().trim(),
      ifsc: (f.ifsc || '').toString().trim() || null,
      branch: (f.branch || '').toString().trim() || null,
      isDefault: f.isDefault === true,
      statusFlag: f.isActive === false ? 'Inactive' : 'Active',
    };

    const endpoint = this.formMode === 'create' ? 'bankac/create' : 'bankac/update';
    if (this.formMode === 'edit') payload.recId = this.editingRecId;

    this.commonApi.fetchData(payload, this.moduleName, endpoint).subscribe({
      next: () => {
        this.alert.success(this.formMode === 'create' ? 'Bank account created successfully' : 'Bank account updated successfully');
        this.showForm = false;
        this.loadBankAccounts({ page: 1, pageSize: 10 });
      },
      error: (err: any) => this.alert.error(err?.error?.message || 'Operation failed'),
    });
  }

  cancel() {
    this.showForm = false;
  }

  // ---------------- DELETE ----------------
  openDelete(row: any) {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete "${row.bankName} - ${row.accountNumber}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    const payload = {
      entiId: this.entiId,
      recId: this.deleteTarget.recId,
    };

    this.commonApi.fetchData(payload, this.moduleName, 'bankac/delete').subscribe({
      next: () => {
        this.alert.success('Bank account deleted successfully');
        this.loadBankAccounts({ page: 1, pageSize: 10 });
      },
      error: (err: any) => this.alert.error(err?.error?.message || 'Delete failed'),
    });

    this.deleteTarget = null;
  }

  // ===================== IMPORT =====================
  openImport() {
    this.showImport = true;
    this.resetImport();
  }

  closeImport() {
    this.showImport = false;
  }

  resetImport() {
    this.importFileName = '';
    this.importPreviewRows = [];
    this.importHasInvalidRows = false;
    this.importInvalidCount = 0;
    this.importDefaultCount = 0;
    this.importing = false;
  }

  onExcelSelected(ev: any) {
    const file: File = ev?.target?.files?.[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      this.alert.error('Please upload a valid Excel file (.xlsx / .xls)');
      return;
    }
    this.importFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = e.target.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
        const mapped = rawRows.map((r: any, idx: number) => this.mapExcelRow(r, idx + 2));
        this.importPreviewRows = mapped;
        this.computeImportValidation();
      } catch (err) {
        this.alert.error('Unable to read Excel file');
        this.importPreviewRows = [];
        this.computeImportValidation();
      }
    };
    reader.onerror = () => this.alert.error('Unable to read file');
    reader.readAsBinaryString(file);
  }

  private mapExcelRow(r: any, rowNo: number) {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return String(r[k]).trim();
      }
      return '';
    };
    const bankName = get('Bank Name', 'BankName', 'bankName').trim();
    const accountName = get('Account Name', 'AccountName', 'accountName').trim();
    const accountNumber = get('Account Number', 'AccountNumber', 'accountNumber').trim();
    const ifsc = get('IFSC', 'ifsc').trim() || null;
    const branch = get('Branch', 'branch').trim() || null;
    const defaultRaw = get('Default', 'Is Default', 'isDefault').trim().toUpperCase();
    const isDefault = ['YES', 'Y', 'TRUE', '1'].includes(defaultRaw);
    const statusRaw = get('Status', 'status').trim();
    const status = statusRaw === 'Inactive' ? 'Inactive' : 'Active';
    const errors: string[] = [];
    if (!bankName) errors.push('Bank Name required');
    if (!accountName) errors.push('Account Name required');
    if (!accountNumber) errors.push('Account Number required');
    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,
      bankName,
      accountName,
      accountNumber,
      ifsc,
      branch,
      isDefault,
      status,
    };
  }

  private computeImportValidation() {
    const invalid = (this.importPreviewRows || []).filter((x) => !x._valid);
    this.importInvalidCount = invalid.length;
    this.importHasInvalidRows = invalid.length > 0;
    this.importDefaultCount = (this.importPreviewRows || []).filter((x) => x.isDefault).length;
  }

  confirmImport() {
    if (!this.importPreviewRows.length) {
      this.alert.error('Please upload an Excel file first');
      return;
    }
    if (this.importHasInvalidRows) {
      this.alert.error('Fix invalid rows before importing');
      return;
    }
    const rows = this.importPreviewRows.map((r) => ({
      bankName: r.bankName,
      accountName: r.accountName,
      accountNumber: r.accountNumber,
      ifsc: r.ifsc,
      branch: r.branch,
      isDefault: r.isDefault === true,
      statusFlag: r.status === 'Inactive' ? 'Inactive' : 'Active',
    }));
    const payload = {
      entiId: this.entiId,
      userId: localStorage.getItem('userId') || '',
      rows,
      skipDuplicates: true,
    };
    this.importing = true;
    this.commonApi.fetchData(payload, this.moduleName, 'bankac/bulkupload').subscribe({
      next: (res: any) => {
        this.importing = false;
        const d = res?.data || {};
        const inserted = d?.inserted ?? d?.insertedCount;
        const dup = d?.duplicatesSkipped ?? d?.skippedCount ?? 0;
        if (inserted !== undefined) {
          this.alert.success(`Import completed. Inserted: ${inserted}, Duplicates skipped: ${dup}`);
        } else {
          this.alert.success('Import completed');
        }
        this.closeImport();
        this.loadBankAccounts({ page: 1, pageSize: 10 });
      },
      error: (err: any) => {
        this.importing = false;
        this.alert.error(err?.error?.message || 'Import failed');
      },
    });
  }

  downloadSampleExcel() {
    const rows = [
      {
        'Bank Name': 'HDFC',
        'Account Name': 'ZEDSWEVEN I PRIVATE LIMITED',
        'Account Number': '1234567890',
        IFSC: 'HDFC0000123',
        Branch: 'COIMBATORE',
        Default: 'YES',
        Status: 'Active',
      },
      {
        'Bank Name': 'SBI',
        'Account Name': 'ZEDSWEVEN I PRIVATE LIMITED',
        'Account Number': '9876543210',
        IFSC: 'SBIN0000456',
        Branch: 'CHENNAI',
        Default: 'NO',
        Status: 'Active',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BankAccounts');
    XLSX.writeFile(wb, 'BankAccounts_Import_Sample.xlsx');
  }
}
