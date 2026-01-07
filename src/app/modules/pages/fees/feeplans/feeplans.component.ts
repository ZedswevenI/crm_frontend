import { Component, OnInit } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-feeplans',
  standalone: false,
  templateUrl: './feeplans.component.html',
  styleUrl: './feeplans.component.scss',
})
export class FeeplansComponent implements OnInit {
  feePlanForm!: FormGroup;
  totalRecords = 0;
  feePlanData: any[] = [];
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingRecId: string | null = null;
  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';
  entiId: any;
  totalBaseFee = 0;
  totalGST = 0;
  totalFee = 0;
  instalmentSum = 0;
  instalmentMismatch = false;
  showImport = false;
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;
  importAcademicYearCtrl = new FormControl('', Validators.required);
  private moduleName = 'ims/feeplan';

  columns = [
    { key: 'feePlanName', label: 'Fee Plan Name', sortable: true },
    { key: 'programCode', label: 'Program Code', sortable: true },
    { key: 'academicYear', label: 'Academic Year', sortable: true },
    { key: 'totalFeeDisplay', label: 'Total Fee', sortable: true },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View',
      callback: (row: any) => this.view(row),
    },
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

  academicYearOptions = [
    { label: '2026-27', value: '2026-27' },
    { label: '2025-26', value: '2025-26' },
    { label: '2024-25', value: '2024-25' },
  ];

  // FeeHead meta helper
  private FEEHEAD_META: any = {
    AM: { label: 'Administrative Charges', discountAllowed: false },
    AF: { label: 'Admission Fee', discountAllowed: false },
    IF: { label: 'Infra Fee', discountAllowed: false },
    TF: { label: 'Tuition Fee', discountAllowed: true },
    EF: { label: 'Exam Fee', discountAllowed: false },
    BS: { label: 'Books Fee', discountAllowed: false },
    GM: { label: 'GMP Fee', discountAllowed: false },
  };

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private router: Router,
    private commonApi: CommonapiService
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Fee Plans' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadFeePlans({ page: 1, pageSize: 10 });
  }

  view(row: any) {
    this.router.navigate(['/app/fees/plans/view', row.recId]);
  }

  initForm() {
    this.feePlanForm = this.fb.group({
      academicYear: ['', Validators.required],
      programCode: ['', Validators.required],
      feePlanName: ['', Validators.required],
      isActive: [true],
      feeHeads: this.fb.array([]),
      instalments: this.fb.array([]),
    });
    this.feePlanForm.valueChanges.subscribe(() => {
      this.recalcTotals();
    });
  }

  get feeHeads(): FormArray {
    return this.feePlanForm.get('feeHeads') as FormArray;
  }

  get instalments(): FormArray {
    return this.feePlanForm.get('instalments') as FormArray;
  }

  private buildFeeHeadRow(p?: any) {
    return this.fb.group({
      key: [p?.key || '', Validators.required],
      label: [p?.label || '', Validators.required],
      amount: [p?.amount ?? 0, [Validators.required, Validators.min(0)]],
      gstPercent: [
        p?.gstPercent ?? 0,
        [Validators.required, Validators.min(0), Validators.max(100)],
      ],
      gstAmount: [{ value: p?.gstAmount ?? 0, disabled: true }],
      totalAmount: [{ value: p?.totalAmount ?? 0, disabled: true }],
      discountAllowed: [!!p?.discountAllowed],
    });
  }

  private buildInstalmentRow(p?: any) {
    return this.fb.group({
      seq: [
        p?.seq ?? this.instalments.length + 1,
        [Validators.required, Validators.min(1)],
      ],
      label: [p?.label || '', Validators.required],
      amount: [p?.amount ?? 0, [Validators.required, Validators.min(0)]],
    });
  }

  addFeeHead() {
    this.feeHeads.push(this.buildFeeHeadRow({ gstPercent: 18 }));
    this.recalcTotals();
  }

  removeFeeHead(i: number) {
    this.feeHeads.removeAt(i);
    this.recalcTotals();
  }

  addInstalment() {
    this.instalments.push(
      this.buildInstalmentRow({ seq: this.instalments.length + 1 })
    );
    this.recalcTotals();
  }

  removeInstalment(i: number) {
    this.instalments.removeAt(i);
    // re-seq
    this.instalments.controls.forEach((c, idx) =>
      c.get('seq')?.setValue(idx + 1, { emitEvent: false })
    );
    this.recalcTotals();
  }

  onFeeHeadKeyBlur(i: number) {
    const row = this.feeHeads.at(i) as FormGroup;
    const key = String(row.get('key')?.value || '')
      .trim()
      .toUpperCase();
    if (!key) return;

    row.get('key')?.setValue(key, { emitEvent: false });

    const meta = this.FEEHEAD_META[key];
    if (meta) {
      row.get('label')?.setValue(meta.label, { emitEvent: false });
      row
        .get('discountAllowed')
        ?.setValue(!!meta.discountAllowed, { emitEvent: false });
    }

    // enforce discount rule
    if (key !== 'TF') {
      row.get('discountAllowed')?.setValue(false, { emitEvent: false });
    }

    this.recalcTotals();
  }

  onDiscountToggle(i: number) {
    const row = this.feeHeads.at(i) as FormGroup;
    const key = String(row.get('key')?.value || '')
      .trim()
      .toUpperCase();
    if (key !== 'TF') {
      row.get('discountAllowed')?.setValue(false, { emitEvent: false });
      this.alert.error('Discount can be applied only on Tuition Fee (TF)');
    }
  }

  recalcTotals() {
    // fee heads calc
    let base = 0;
    let gst = 0;
    let total = 0;

    this.feeHeads.controls.forEach((c) => {
      const fg = c as FormGroup;
      const amount = Number(fg.get('amount')?.value || 0);
      const gstPercent = Number(fg.get('gstPercent')?.value || 0);

      const gstAmount = Number(((amount * gstPercent) / 100).toFixed(2));
      const totalAmount = Number((amount + gstAmount).toFixed(2));

      fg.get('gstAmount')?.setValue(gstAmount, { emitEvent: false });
      fg.get('totalAmount')?.setValue(totalAmount, { emitEvent: false });

      base += amount;
      gst += gstAmount;
      total += totalAmount;
    });

    this.totalBaseFee = Number(base.toFixed(2));
    this.totalGST = Number(gst.toFixed(2));
    this.totalFee = Number(total.toFixed(2));

    // instalment sum should equal totalFee
    const instSum = this.instalments.controls.reduce(
      (s, c) => s + Number((c as FormGroup).get('amount')?.value || 0),
      0
    );
    this.instalmentSum = Number(instSum.toFixed(2));

    this.instalmentMismatch = this.instalmentSum !== this.totalFee;
  }

  // ---------------- LIST ----------------
  loadFeePlans(event?: {
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
      feePlanName: 'feePlanName',
      academicYear: 'academicYear',
      programCode: 'programCode',
      totalFee: 'totalFee',
    };
    const sortKey = event?.sortKey ? sortMap[event.sortKey] : null;
    const sort = sortKey
      ? event?.sortDirection === 'asc'
        ? sortKey
        : `-${sortKey}`
      : '';

    const qp = this.buildQueryParams({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
    });

    this.commonApi
      .fetchData({ entiId: this.entiId }, this.moduleName, `list${qp}`)
      .subscribe({
        next: (res: any) => {
          this.totalRecords = res?.count || 0;
          this.feePlanData = (res?.data || []).map((p: any) => {
            const total = Number(p.totalFee || 0);
            return {
              recId: p._id,
              feePlanName: p.feePlanName,
              academicYear: p.academicYear,
              programCode: p.programCode,
              totalFeeDisplay: `₹${total.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`,
              _raw: p,
            };
          });
        },
        error: () => this.alert.error('Failed to load fee plans'),
      });
  }

  private buildQueryParams(params: Record<string, any>) {
    const keys = Object.keys(params || {}).filter(
      (k) => params[k] !== undefined && params[k] !== null && params[k] !== ''
    );
    if (!keys.length) return '';
    const qs = keys
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`
      )
      .join('&');
    return `?${qs}`;
  }

  // ---------------- ADD / EDIT ----------------
  add() {
    this.formMode = 'create';
    this.editingRecId = null;

    this.feePlanForm.reset({ isActive: true });
    this.feeHeads.clear();
    this.instalments.clear();

    // default one row each
    this.addFeeHead();
    this.addInstalment();

    this.showForm = true;
  }

  edit(row: any) {
    const p = row._raw;

    this.formMode = 'edit';
    this.editingRecId = p._id;

    this.feePlanForm.patchValue({
      academicYear: p.academicYear,
      programCode: p.programCode,
      feePlanName: p.feePlanName,
      isActive: p.status === 'Active',
    });

    this.feeHeads.clear();
    (p.feeHeads || []).forEach((h: any) =>
      this.feeHeads.push(this.buildFeeHeadRow(h))
    );

    this.instalments.clear();
    (p.instalments || []).forEach((i: any) =>
      this.instalments.push(this.buildInstalmentRow(i))
    );

    this.recalcTotals();
    this.showForm = true;
  }

  cancel() {
    this.showForm = false;
  }

  // ---------------- SAVE ----------------
  save() {
    if (this.feePlanForm.invalid) {
      this.feePlanForm.markAllAsTouched();
      this.alert.error('Please fill all required fields');
      return;
    }
    if (!this.feeHeads.length) {
      this.alert.error('At least one fee head is required');
      return;
    }
    if (!this.instalments.length) {
      this.alert.error('At least one instalment is required');
      return;
    }
    if (this.instalmentMismatch) {
      this.alert.error('Instalment total must match total fee');
      return;
    }

    const payload = this.buildPayload(
      this.feePlanForm.value,
      this.editingRecId || ''
    );

    const endpoint = this.formMode === 'create' ? 'create' : 'update';
    this.commonApi.fetchData(payload, this.moduleName, endpoint).subscribe({
      next: () => {
        this.alert.success(
          this.formMode === 'create'
            ? 'Fee plan created successfully'
            : 'Fee plan updated successfully'
        );
        this.showForm = false;
        this.loadFeePlans({ page: 1, pageSize: 10 });
      },
      error: (err: any) =>
        this.alert.error(err?.error?.message || 'Operation failed'),
    });
  }

  private buildPayload(form: any, recId?: string) {
    const feeHeads = this.feeHeads.getRawValue().map((h: any) => ({
      key: String(h.key || '')
        .trim()
        .toUpperCase(),
      label: String(h.label || '').trim(),
      amount: Number(h.amount || 0),
      gstPercent: Number(h.gstPercent || 0),
      gstAmount: Number(h.gstAmount || 0),
      totalAmount: Number(h.totalAmount || 0),
      discountAllowed: !!h.discountAllowed,
    }));

    const instalments = this.instalments.getRawValue().map((i: any) => ({
      seq: Number(i.seq || 1),
      label: String(i.label || '').trim(),
      amount: Number(i.amount || 0),
    }));

    return {
      entiId: this.entiId,
      ...(recId ? { recId } : {}),
      academicYear: form.academicYear,
      programCode: String(form.programCode || '').trim(),
      feePlanName: String(form.feePlanName || '').trim(),
      feeHeads,
      instalments,
      totalBaseFee: this.totalBaseFee,
      totalGST: this.totalGST,
      totalFee: this.totalFee,
      status: form.isActive ? 'Active' : 'Inactive',
    };
  }

  // ---------------- DELETE ----------------
  openDelete(row: any) {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete "${row.feePlanName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    this.commonApi
      .fetchData(
        { entiId: this.entiId, recId: this.deleteTarget.recId },
        this.moduleName,
        'delete'
      )
      .subscribe({
        next: () => {
          this.alert.success('Fee plan deleted successfully');
          this.loadFeePlans({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Delete failed'),
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
    this.importAcademicYearCtrl.setValue('');
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
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, {
          defval: '',
        }) as any[];

        const mapped = rawRows.map((r: any, idx: number) =>
          this.mapExcelRow(r, idx + 2)
        );
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
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '')
          return String(r[k]).trim();
      }
      return '';
    };

    const feeplancode = get('feeplancode', 'feePlanCode', 'FeePlanCode');
    const programcode = get('programcode', 'programCode', 'ProgramCode');
    const feehead = get('feehead', 'feeHead', 'FeeHead');
    const amount = get('amount', 'Amount');
    const strate = get('strate', 'GST', 'gstPercent');
    const insdate = get('insdate', 'insDate', 'InstalmentDate');

    const errors: string[] = [];
    if (!feeplancode) errors.push('feeplancode required');
    if (!programcode) errors.push('programcode required');
    if (!feehead) errors.push('feehead required');
    if (!amount || isNaN(Number(amount))) errors.push('amount invalid');
    if (strate !== '' && isNaN(Number(strate))) errors.push('strate invalid');

    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,

      feeplancode,
      programcode,
      feehead,
      amount: Number(amount || 0),
      strate: strate === '' ? 0 : Number(strate || 0),
      insdate: insdate || 'On Admission',
    };
  }

  private computeImportValidation() {
    const invalid = (this.importPreviewRows || []).filter((x) => !x._valid);
    this.importInvalidCount = invalid.length;
    this.importHasInvalidRows = invalid.length > 0;
  }

  confirmImport() {
    if (!this.importAcademicYearCtrl.value) {
      this.alert.error('Academic year is required for import');
      return;
    }
    if (!this.importPreviewRows.length) {
      this.alert.error('Please upload an Excel file first');
      return;
    }
    if (this.importHasInvalidRows) {
      this.alert.error('Fix invalid rows before importing');
      return;
    }

    const rows = this.importPreviewRows.map((r) => ({
      feeplancode: r.feeplancode,
      programcode: r.programcode,
      feehead: r.feehead,
      amount: r.amount,
      strate: r.strate,
      insdate: r.insdate,
    }));

    const payload = {
      entiId: this.entiId,
      academicYear: this.importAcademicYearCtrl.value,
      rows,
    };

    // backend method name is bulkUpsertFeePlansFromRows
    this.commonApi.fetchData(payload, this.moduleName, 'bulkupload').subscribe({
      next: (res: any) => {
        const processed = res?.data?.processed?.length || 0;
        const skipped = res?.data?.skipped?.length || 0;
        const errors = res?.data?.errors?.length || 0;

        this.alert.success(
          `Import completed. Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`
        );
        this.closeImport();
        this.loadFeePlans({ page: 1, pageSize: 10 });
      },
      error: (err: any) =>
        this.alert.error(err?.error?.message || 'Import failed'),
    });
  }

  downloadSampleExcel() {
    const rows = [
      {
        feeplancode: '1110_Base Fee_Plan',
        programcode: '1110',
        feehead: 'TF',
        amount: 50000,
        strate: 18,
        insdate: 'On Admission',
      },
      {
        feeplancode: '1110_Base Fee_Plan',
        programcode: '1110',
        feehead: 'AF',
        amount: 10000,
        strate: 18,
        insdate: '10/01/2026',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FeeRows');
    XLSX.writeFile(wb, 'FeePlan_Import_Sample.xlsx');
  }
}
