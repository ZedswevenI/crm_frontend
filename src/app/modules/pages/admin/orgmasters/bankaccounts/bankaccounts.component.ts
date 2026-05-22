import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import * as XLSX from 'xlsx';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-bankaccounts',
  standalone: false,
  templateUrl: './bankaccounts.component.html',
  styleUrl: './bankaccounts.component.scss',
})
export class BankaccountsComponent implements OnInit {
  bankForm!: FormGroup;

  // table
  loading = false;
  totalRecords = 0;
  bankData: any[] = [];

  // modal
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingRecId: string | null = null;
  saving = false;

  // delete
  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  // import
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
    private commonApi: CommonapiService,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Org Configs' },
      { label: 'Bank Accounts' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
  }

  // ---------------- FORM ----------------
  initForm() {
    this.bankForm = this.fb.group({
      bankName: ['', [Validators.required, Validators.maxLength(60)]],
      accountName: ['', [Validators.required, Validators.maxLength(80)]],
      accountNumber: [
        '',
        [Validators.required, Validators.pattern(/^\d{6,25}$/)],
      ],
      ifsc: ['', [Validators.pattern(/^[A-Za-z0-9]{0,11}$/)]], // optional, if present must be 11
      branch: ['', [Validators.maxLength(60)]],
      isDefault: [false],
      isActive: [true],
    });
  }

  private buildQueryParams(params: Record<string, any>) {
    const keys = Object.keys(params || {}).filter(
      (k) => params[k] !== undefined && params[k] !== null && params[k] !== '',
    );
    if (!keys.length) return '';
    const qs = keys
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`,
      )
      .join('&');
    return `?${qs}`;
  }

  // ---------------- LIST ----------------
  fetchTableData(event?: {
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
      ifsc: 'ifsc',
      branch: 'branch',
      isDefault: 'isDefault',
      statusFlag: 'statusFlag',
    };
    const sortKey = event?.sortKey ? sortMap[event.sortKey] : null;
    const sort = sortKey
      ? event?.sortDirection === 'asc'
        ? sortKey
        : `-${sortKey}`
      : '';

    const payload = { entiId: this.entiId };
    const qp = this.buildQueryParams({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
    });

    this.loading = true;

    this.commonApi
      .fetchData(payload, this.moduleName, `bankac/list${qp}`)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: any) => {
          const d = res?.data;
          const rows = Array.isArray(d?.rows)
            ? d.rows
            : Array.isArray(d)
              ? d
              : [];
          const total = d?.total ?? res?.count ?? rows.length ?? 0;

          this.totalRecords = total;

          this.bankData = rows.map((x: any) => ({
            recId: x._id,
            bankName: x.bankName,
            accountName: x.accountName,
            accountNumber: x.accountNumber,
            ifsc: x.ifsc || '-',
            branch: x.branch || '-',
            isDefault: x.isDefault === true ? 'YES' : 'NO',
            statusFlag:
              (x.statusFlag || 'Active') === 'Inactive' ? 'Inactive' : 'Active',
            _raw: x,
          }));
        },
        error: () => this.alert.error('Failed to load bank accounts'),
      });
  }

  // ---------------- CREATE ----------------
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

  // ---------------- EDIT ----------------
  edit(row: any) {
    const d = row?._raw || {};

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

  // ---------------- SAVE ----------------
  save() {
    if (this.saving) return;

    if (this.bankForm.invalid) {
      this.bankForm.markAllAsTouched();
      return;
    }

    this.saving = true;

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

    const endpoint =
      this.formMode === 'create' ? 'bankac/create' : 'bankac/update';
    if (this.formMode === 'edit') payload.recId = this.editingRecId;

    this.commonApi
      .fetchData(payload, this.moduleName, endpoint)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alert.error(res?.message || 'Operation failed');
            return;
          }

          this.alert.success(
            this.formMode === 'create'
              ? 'Bank account created successfully'
              : 'Bank account updated successfully',
          );

          this.showForm = false;
          this.fetchTableData({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Operation failed'),
      });
  }

  cancel() {
    if (this.saving) return;
    this.showForm = false;
  }

  // ---------------- DELETE ----------------
  openDelete(row: any) {
    this.deleteTarget = row;
    const raw = row?._raw || {};
    this.deleteMessage = `Are you sure you want to delete "${raw.bankName || row.bankName} - ${raw.accountNumber || row.accountNumber}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    const payload = {
      entiId: this.entiId,
      recId: this.deleteTarget.recId,
    };

    this.commonApi
      .fetchData(payload, this.moduleName, 'bankac/delete')
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alert.error(res?.message || 'Delete failed');
            return;
          }
          this.alert.success('Bank account deleted successfully');
          this.fetchTableData({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Delete failed'),
      });

    this.deleteTarget = null;
  }

  // ===================== IMPORT =====================
  openImport() {
    if (this.importing) return;
    this.showImport = true;
    this.resetImport();
  }

  closeImport() {
    if (this.importing) return;
    this.showImport = false;
  }

  resetImport() {
    if (this.importing) return;
    this.importFileName = '';
    this.importPreviewRows = [];
    this.importHasInvalidRows = false;
    this.importInvalidCount = 0;
    this.importDefaultCount = 0;
  }

  onExcelSelected(ev: any) {
    if (this.importing) return;

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
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, {
          defval: '',
        }) as any[];

        const mapped = rawRows.map((r: any, idx: number) =>
          this.mapExcelRow(r, idx + 2),
        );

        // file duplicates by (BANKNAME + ACCOUNTNUMBER)
        const seen = new Set<string>();
        for (const row of mapped) {
          const key = `${String(row.bankName || '')
            .trim()
            .toUpperCase()}::${String(row.accountNumber || '').trim()}`;
          if (!key || key === '::') continue;

          if (seen.has(key)) {
            row._valid = false;
            row._errors = Array.isArray(row._errors) ? row._errors : [];
            row._errors.push('Duplicate in file');
          } else {
            seen.add(key);
          }
        }

        // keep only first default
        let firstDefaultSeen = false;
        for (const row of mapped) {
          if (row.isDefault === true) {
            if (!firstDefaultSeen) firstDefaultSeen = true;
            else row.isDefault = false;
          }
        }

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
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
          return String(r[k]).trim();
        }
      }
      return '';
    };

    const bankName = get('Bank Name', 'BankName', 'bankName');
    const accountName = get('Account Name', 'AccountName', 'accountName');
    const accountNumber = get(
      'Account Number',
      'AccountNumber',
      'accountNumber',
    );

    const ifsc = get('IFSC', 'ifsc') || null;
    const branch = get('Branch', 'branch') || null;

    const defaultRaw = get('Default', 'Is Default', 'isDefault');
    const def = String(defaultRaw || '')
      .trim()
      .toLowerCase();
    const isDefault =
      def === 'yes' || def === 'y' || def === 'true' || def === '1';

    const statusRaw = get('Status', 'status');
    const s = String(statusRaw || '')
      .trim()
      .toLowerCase();
    const status = s === 'inactive' ? 'Inactive' : 'Active';

    const errors: string[] = [];

    if (!bankName) errors.push('Bank Name required');
    if (!accountName) errors.push('Account Name required');
    if (!accountNumber) errors.push('Account Number required');
    if (accountNumber && !/^\d{6,25}$/.test(accountNumber))
      errors.push('Invalid Account Number');
    if (ifsc && !/^[A-Za-z0-9]{11}$/.test(ifsc)) errors.push('Invalid IFSC');
    if (s && s !== 'active' && s !== 'inactive') errors.push('Invalid Status');

    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,

      bankName: String(bankName || '').trim(),
      accountName: String(accountName || '').trim(),
      accountNumber: String(accountNumber || '').trim(),
      ifsc: ifsc ? String(ifsc).trim() : null,
      branch: branch ? String(branch).trim() : null,
      isDefault,
      status,
    };
  }

  private computeImportValidation() {
    const invalid = (this.importPreviewRows || []).filter((x) => !x._valid);
    this.importInvalidCount = invalid.length;
    this.importHasInvalidRows = invalid.length > 0;
    this.importDefaultCount = (this.importPreviewRows || []).filter(
      (x) => x.isDefault,
    ).length;
  }

  confirmImport() {
    if (this.importing) return;

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

    this.commonApi
      .fetchData(payload, this.moduleName, 'bankac/bulkupload')
      .pipe(finalize(() => (this.importing = false)))
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alert.error(res?.message || 'Import failed');
            return;
          }

          const d = res?.data || {};
          const inserted = d?.inserted;
          const dup = d?.duplicatesSkipped;

          if (inserted !== undefined) {
            this.alert.success(
              `Import completed. Inserted: ${inserted}, Duplicates skipped: ${dup || 0}`,
            );
          } else {
            this.alert.success('Import completed');
          }
          this.closeImport();
          this.fetchTableData({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Import failed'),
      });
  }

  downloadSampleExcel() {
    const rows = [
      {
        'Bank Name': 'HDFC',
        'Account Name': 'NAMITH SOFTWARE SOLUTIONS',
        'Account Number': '1234567890',
        IFSC: 'HDFC0000123',
        Branch: 'COIMBATORE',
        Default: 'YES',
        Status: 'Active',
      },
      {
        'Bank Name': 'SBI',
        'Account Name': 'NAMITH SOFTWARE SOLUTIONS',
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
