import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
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
  userId: any;

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
    { type: 'icon', icon: 'fa-regular fa-eye', tooltip: 'View', callback: (row: any) => this.view(row) },
    { type: 'icon', icon: 'fa-regular fa-pen-to-square', tooltip: 'Edit', callback: (row: any) => this.edit(row) },
    { type: 'icon', icon: 'fa-regular fa-trash-can', tooltip: 'Delete', callback: (row: any) => this.openDelete(row) },
  ];

  academicYearOptions = [
    { label: '2026-27', value: '2026-27' },
    { label: '2025-26', value: '2025-26' },
    { label: '2024-25', value: '2024-25' },
  ];

  private FEEHEAD_META: any = {
    AM: { label: 'Administrative Charges', discountAllowed: false },
    AF: { label: 'Admission Fee', discountAllowed: false },
    IF: { label: 'Infra Fee', discountAllowed: false },
    TF: { label: 'Tuition Fee', discountAllowed: true },
    EF: { label: 'Exam Fee', discountAllowed: false },
    BS: { label: 'Books Fee', discountAllowed: false },
    GM: { label: 'GMP Fee', discountAllowed: false },
  };

  feeHeadKeyOptions: string[] = ['AM', 'AF', 'IF', 'TF', 'EF', 'BS', 'GM'];

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private router: Router,
    private commonApi: CommonapiService,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.userId = localStorage.getItem('userId') || localStorage.getItem('userid') || ''; // follow your pattern
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Masters' }, { label: 'Fee Plans' }]);
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

      // optional top fields
      centerCode: [''],
      testDate: [null],   // epoch ms
      validTill: [null],  // epoch ms

      feeHeads: this.fb.array([]),
      instalments: this.fb.array([]),
    });

    this.feePlanForm.valueChanges.subscribe(() => this.recalcTotals());
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
      gstPercent: [p?.gstPercent ?? 0, [Validators.required, Validators.min(0), Validators.max(100)]],
      gstAmount: [{ value: p?.gstAmount ?? 0, disabled: true }],
      totalAmount: [{ value: p?.totalAmount ?? 0, disabled: true }],
      discountAllowed: [!!p?.discountAllowed],
    });
  }

  // ✅ updated instalment row for new schema
  private buildInstalmentRow(p?: any) {
    const feeHead = this.normKey(p?.feeHead || p?.feehead || p?.feeHeadKey || '');
    const label = String(p?.label ?? '').trim();
    const instalmentDate = this.toEpochMs(p?.instalmentDate);

    return this.fb.group({
      seq: [p?.seq ?? this.instalments.length + 1, [Validators.required, Validators.min(1)]],
      feeHead: [feeHead || '', Validators.required],
      label: [label || '', Validators.required],
      instalmentDate: [instalmentDate ?? 0], // backend expects number; On Admission -> 0
      mode: [p?.mode ? String(p.mode).trim() : null],
      chequeFavour: [p?.chequeFavour ? String(p.chequeFavour).trim() : (p?.chequefavour ? String(p.chequefavour).trim() : null)],
      discountApplied: [feeHead === 'TF'],
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
      this.buildInstalmentRow({
        seq: this.instalments.length + 1,
        feeHead: 'TF',
        label: 'On Admission',
        instalmentDate: 0,
      }),
    );
    this.recalcTotals();
  }

  removeInstalment(i: number) {
    this.instalments.removeAt(i);
    this.instalments.controls.forEach((c, idx) => c.get('seq')?.setValue(idx + 1, { emitEvent: false }));
    this.recalcTotals();
  }

  onFeeHeadKeyBlur(i: number) {
    const row = this.feeHeads.at(i) as FormGroup;
    const key = this.normKey(row.get('key')?.value || '');
    if (!key) return;

    row.get('key')?.setValue(key, { emitEvent: false });

    const meta = this.FEEHEAD_META[key];
    if (meta) {
      row.get('label')?.setValue(meta.label, { emitEvent: false });
      row.get('discountAllowed')?.setValue(!!meta.discountAllowed, { emitEvent: false });
    }
    if (key !== 'TF') row.get('discountAllowed')?.setValue(false, { emitEvent: false });

    this.recalcTotals();
  }

  onDiscountToggle(i: number) {
    const row = this.feeHeads.at(i) as FormGroup;
    const key = this.normKey(row.get('key')?.value || '');
    if (key !== 'TF') {
      row.get('discountAllowed')?.setValue(false, { emitEvent: false });
      this.alert.error('Discount can be applied only on Tuition Fee (TF)');
    }
  }

  onInstalmentHeadChange(i: number) {
    const row = this.instalments.at(i) as FormGroup;
    const k = this.normKey(row.get('feeHead')?.value || '');
    row.get('feeHead')?.setValue(k, { emitEvent: false });

    // discountApplied is derived
    row.get('discountApplied')?.setValue(k === 'TF', { emitEvent: false });
  }

  onInstalmentDiscountToggle(i: number) {
    const row = this.instalments.at(i) as FormGroup;
    const k = this.normKey(row.get('feeHead')?.value || '');
    if (k !== 'TF') {
      row.get('discountApplied')?.setValue(false, { emitEvent: false });
      this.alert.error('discountApplied can be enabled only for Tuition Fee (TF)');
      return;
    }
    // keep as true only (derived)
    row.get('discountApplied')?.setValue(true, { emitEvent: false });
  }

  onInstalmentDatePicked(i: number, ev: any) {
    const row = this.instalments.at(i) as FormGroup;
    const v = ev?.target?.value || '';
    if (!v) {
      // If empty, treat as On Admission => 0
      row.get('instalmentDate')?.setValue(0, { emitEvent: false });
      return;
    }
    const ms = this.toEpochMs(v) || 0;
    row.get('instalmentDate')?.setValue(ms, { emitEvent: false });

    const curLabel = String(row.get('label')?.value || '').trim();
    if (!curLabel || this.looksLikeDate(curLabel)) {
      row.get('label')?.setValue(this.formatDDMMYYYY(ms), { emitEvent: false });
    }
  }

  syncInstalmentDateFromLabel(i: number) {
    const row = this.instalments.at(i) as FormGroup;
    const label = String(row.get('label')?.value || '').trim();
    if (!label) return;

    if (/^on\s*admission$/i.test(label)) {
      row.get('instalmentDate')?.setValue(0, { emitEvent: false });
      return;
    }
    const ms = this.toEpochMs(label);
    if (ms) row.get('instalmentDate')?.setValue(ms, { emitEvent: false });
  }

  // top-level optional date pickers
  onTopDatePicked(ctrlName: 'testDate' | 'validTill', ev: any) {
    const v = ev?.target?.value || '';
    if (!v) {
      this.feePlanForm.get(ctrlName)?.setValue(null, { emitEvent: false });
      return;
    }
    const ms = this.toEpochMs(v);
    this.feePlanForm.get(ctrlName)?.setValue(ms ?? null, { emitEvent: false });
  }

  recalcTotals() {
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

    const instSum = this.instalments.controls.reduce(
      (s, c) => s + Number((c as FormGroup).get('amount')?.value || 0),
      0,
    );
    this.instalmentSum = Number(instSum.toFixed(2));
    this.instalmentMismatch = this.instalmentSum !== this.totalFee;
  }

  // ---------------- LIST ----------------
  loadFeePlans(event?: { page: number; pageSize: number; search?: string; sortKey?: string; sortDirection?: 'asc' | 'desc' }) {
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
    const sort = sortKey ? (event?.sortDirection === 'asc' ? sortKey : `-${sortKey}`) : '';

    const qp = this.buildQueryParams({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
    });

    this.commonApi.fetchData({ entiId: this.entiId }, this.moduleName, `list${qp}`).subscribe({
      next: (res: any) => {
        this.totalRecords = res?.count || 0;
        this.feePlanData = (res?.data || []).map((p: any) => {
          const totalFee = Number(p.totalFee || 0);
          return {
            recId: p._id,
            feePlanName: p.feePlanName,
            academicYear: p.academicYear,
            programCode: p.programCode,
            totalFeeDisplay: `₹${totalFee.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            _raw: p,
          };
        });
      },
      error: () => this.alert.error('Failed to load fee plans'),
    });
  }

  private buildQueryParams(params: Record<string, any>) {
    const keys = Object.keys(params || {}).filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '');
    if (!keys.length) return '';
    const qs = keys.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`).join('&');
    return `?${qs}`;
  }

  add() {
    this.formMode = 'create';
    this.editingRecId = null;

    this.feePlanForm.reset({
      isActive: true,
      centerCode: '',
      testDate: null,
      validTill: null,
    });

    this.feeHeads.clear();
    this.instalments.clear();
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

      centerCode: p.centerCode || '',
      testDate: p.testDate ?? null,
      validTill: p.validTill ?? null,
    });

    this.feeHeads.clear();
    (p.feeHeads || []).forEach((h: any) => this.feeHeads.push(this.buildFeeHeadRow(h)));

    this.instalments.clear();
    (p.instalments || []).forEach((ins: any) => this.instalments.push(this.buildInstalmentRow(ins)));

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

    // feeHead validation
    const headKeys = new Set(this.feeHeads.getRawValue().map((h: any) => this.normKey(h.key)));
    const bad = this.instalments.controls.find((c) => {
      const fg = c as FormGroup;
      const k = this.normKey(fg.get('feeHead')?.value || '');
      return !k || !headKeys.has(k);
    });
    if (bad) {
      this.alert.error('Each instalment must have a valid Fee Head (must exist in Fee Heads table)');
      return;
    }

    const payload = this.buildPayload(this.feePlanForm.value, this.editingRecId || '');

    const endpoint = this.formMode === 'create' ? 'create' : 'update';
    this.commonApi.fetchData(payload, this.moduleName, endpoint).subscribe({
      next: () => {
        this.alert.success(this.formMode === 'create' ? 'Fee plan created successfully' : 'Fee plan updated successfully');
        this.showForm = false;
        this.loadFeePlans({ page: 1, pageSize: 10 });
      },
      error: (err: any) => this.alert.error(err?.error?.message || 'Operation failed'),
    });
  }

  private buildPayload(form: any, recId?: string) {
    const feeHeads = this.feeHeads.getRawValue().map((h: any) => {
      const key = this.normKey(h.key);
      return {
        key,
        label: String(h.label || '').trim(),
        amount: Number(h.amount || 0),
        gstPercent: Number(h.gstPercent || 0),
        gstAmount: Number(h.gstAmount || 0),
        totalAmount: Number(h.totalAmount || 0),
        discountAllowed: key === 'TF' ? !!h.discountAllowed : false,
      };
    });

    const instalments = this.instalments.getRawValue().map((i: any) => {
      const feeHead = this.normKey(i.feeHead);
      const label = String(i.label || '').trim();
      let instalmentDate = this.toEpochMs(i.instalmentDate);

      // schema expects number; On Admission -> 0
      if (/^on\s*admission$/i.test(label)) instalmentDate = 0;
      if (instalmentDate === null) instalmentDate = 0;

      return {
        seq: Number(i.seq || 1),
        feeHead,
        label,
        instalmentDate,
        mode: i.mode ? String(i.mode).trim() : null,
        chequeFavour: i.chequeFavour ? String(i.chequeFavour).trim() : null,
        discountApplied: feeHead === 'TF',
        amount: Number(i.amount || 0),
      };
    });

    return {
      entiId: this.entiId,
      userId: this.userId || undefined,
      ...(recId ? { recId } : {}),
      academicYear: form.academicYear,
      programCode: String(form.programCode || '').trim(),
      feePlanName: String(form.feePlanName || '').trim(),

      centerCode: String(form.centerCode || '').trim() || null,
      testDate: form.testDate ? Number(form.testDate) : null,
      validTill: form.validTill ? Number(form.validTill) : null,

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

    this.commonApi.fetchData({ entiId: this.entiId, recId: this.deleteTarget.recId, userId: this.userId }, this.moduleName, 'delete').subscribe({
      next: () => {
        this.alert.success('Fee plan deleted successfully');
        this.loadFeePlans({ page: 1, pageSize: 10 });
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
    const getAny = (...keys: string[]) => {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return String(r[k]).trim();
      }
      return '';
    };

    const centres = getAny('centres', 'center', 'centerCode');
    const feeplancode = getAny('feeplancode', 'feePlanCode', 'FeePlanCode');
    const programcode = getAny('programcode', 'programCode', 'ProgramCode');
    const feehead = this.normKey(getAny('feehead', 'feeHead', 'FeeHead'));
    const feefor = getAny('feefor', 'label', 'Label');
    const mode = getAny('mode', 'Mode');
    const chequefavour = getAny('chequefavour', 'chequeFavour', 'ChequeFavour');
    const amountStr = getAny('amount', 'Amount');
    const strateStr = getAny('strate', 'GST', 'gstPercent');
    const insdate = getAny('insdate', 'insDate', 'InstalmentDate') || 'On Admission';

    // optional plan-level dates per row (we keep to send; backend will take first row values)
    const testdate = getAny('testdate', 'testDate');
    const validity = getAny('validity', 'validTill');

    const errors: string[] = [];
    if (!feeplancode) errors.push('feeplancode required');
    if (!programcode) errors.push('programcode required');
    if (!feehead) errors.push('feehead required');
    if (!amountStr || isNaN(Number(amountStr))) errors.push('amount invalid');
    if (strateStr !== '' && isNaN(Number(strateStr))) errors.push('strate invalid');

    // insdate can be On Admission or valid date
    const ms = this.toEpochMs(insdate);
    if (!/^on\s*admission$/i.test(String(insdate).trim()) && !ms) errors.push('insdate invalid');

    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,

      centres,
      testdate,
      validity,

      feeplancode,
      programcode,
      feehead,
      feefor,
      mode,
      chequefavour,

      amount: Number(amountStr || 0),
      strate: strateStr === '' ? 0 : Number(strateStr || 0),
      insdate,
      _instalmentDate: ms, // epoch or null (On Admission => null)
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

    // Take plan-level fields from first row (same sheet style)
    const first = this.importPreviewRows[0] || {};

    const rows = this.importPreviewRows.map((r) => ({
      centres: r.centres,           // backend reads as centerCode
      testdate: r.testdate,
      validity: r.validity,

      feeplancode: r.feeplancode,
      programcode: r.programcode,
      feehead: r.feehead,
      amount: r.amount,
      strate: r.strate,
      insdate: r.insdate,
      mode: r.mode,
      chequefavour: r.chequefavour,
      feefor: r.feefor,
    }));

    const payload = {
      entiId: this.entiId,
      userId: this.userId || undefined,
      academicYear: this.importAcademicYearCtrl.value,
      rows,
      // optional top pass (backend will anyway pick from rows[0], but keeping is harmless)
      centerCode: first.centres || null,
      testDate: first.testdate || null,
      validTill: first.validity || null,
    };

    this.commonApi.fetchData(payload, this.moduleName, 'bulkupload').subscribe({
      next: (res: any) => {
        const processed = res?.data?.processed?.length || 0;
        const skipped = res?.data?.skipped?.length || 0;
        const errors = res?.data?.errors?.length || 0;

        this.alert.success(`Import completed. Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
        this.closeImport();
        this.loadFeePlans({ page: 1, pageSize: 10 });
      },
      error: (err: any) => this.alert.error(err?.error?.message || 'Import failed'),
    });
  }

  downloadSampleExcel() {
    const rows = [
      {
        centres: '64',
        testdate: '28-Sep-25',
        validity: '31-Dec-25',
        feeplancode: '1110_Base Fee_Plan',
        programcode: '1110',
        feehead: 'AM',
        feefor: 'Class 11 & 12',
        amount: 56620,
        strate: 18,
        insdate: 'On Admission',
        mode: 'Online/DD',
        chequefavour: 'ZEDSWEVEN I Private Limited',
      },
      {
        centres: '64',
        testdate: '28-Sep-25',
        validity: '31-Dec-25',
        feeplancode: '1110_Base Fee_Plan',
        programcode: '1110',
        feehead: 'AF',
        feefor: 'Class 11 & 12',
        amount: 83258,
        strate: 18,
        insdate: '10/01/2026',
        mode: 'PDC',
        chequefavour: 'ZEDSWEVEN I Private Limited',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FeeRows');
    XLSX.writeFile(wb, 'FeePlan_Import_Sample.xlsx');
  }

  // ===================== utils =====================
  private normKey(v: any) {
    return String(v || '').trim().toUpperCase();
  }

  private looksLikeDate(s: string) {
    return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s) || !isNaN(Date.parse(s));
  }

  // ✅ fix: accept null/undefined to avoid TS2345
  private formatDDMMYYYY(ms?: number | null): string {
    const n = Number(ms || 0);
    if (!n) return '';
    const d = new Date(n);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  toDateInputValue(ms: any) {
    const n = Number(ms || 0);
    if (!n || !Number.isFinite(n)) return '';
    const d = new Date(n);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // epoch parser: supports yyyy-mm-dd, dd/mm/yyyy, dd-MMM-yy, Date.parse
  private toEpochMs(v: any): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v > 0 ? Math.trunc(v) : null;

    const s = String(v || '').trim();
    if (!s) return null;
    if (/^on\s*admission$/i.test(s)) return null;

    // yyyy-mm-dd
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const dt = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      const ms = dt.getTime();
      return isNaN(ms) ? null : ms;
    }

    // dd/mm/yyyy or dd-mm-yyyy
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m1) {
      const dd = Number(m1[1]);
      const mm = Number(m1[2]);
      let yy = Number(m1[3]);
      if (yy < 100) yy = 2000 + yy;
      const dt = new Date(yy, mm - 1, dd);
      const ms = dt.getTime();
      return isNaN(ms) ? null : ms;
    }

    // dd-MMM-yy (28-Sep-25)
    const m2 = s.match(/^(\d{1,2})[\-\s]([A-Za-z]{3})[\-\s](\d{2,4})$/);
    if (m2) {
      const dd = Number(m2[1]);
      const mon = String(m2[2] || '').toLowerCase();
      const map: any = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
      let yy = Number(m2[3]);
      if (yy < 100) yy = 2000 + yy;
      if (map[mon] === undefined) return null;
      const dt = new Date(yy, map[mon], dd);
      const ms = dt.getTime();
      return isNaN(ms) ? null : ms;
    }
    const t = Date.parse(s);
    if (!isNaN(t)) return t;

    return null;
  }
}