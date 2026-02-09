import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-staff',
  standalone: false,
  templateUrl: './staff.component.html',
  styleUrl: './staff.component.scss',
})
export class StaffComponent implements OnInit {
  staffForm!: FormGroup;

  totalRecords = 0;
  staffData: any[] = [];
  loading = false;

  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingRecId: string | null = null;
  private editingStatus: 'Active' | 'Inactive' = 'Active';

  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  showView = false;
  viewRec: any | null = null;

  retireModalVisible = false;
  retireMessage = '';
  retireTarget: any | null = null;

  // view date input string (yyyy-MM-dd)
  viewRelievingDate = '';

  // import
  showImport = false;
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;

  // masters
  centerOptions: any[] = [];
  departmentOptions: any[] = [];
  subjectOptions: any[] = [];

  // center lookups
  private centerCodeToId = new Map<string, string>();
  private centerIdToCode = new Map<string, string>();
  private centerIdToName = new Map<string, string>();

  roleOptions = [
    { label: 'Faculty', value: 'Faculty' },
    { label: 'Center Head', value: 'Center Head' },
    { label: 'Counsellor', value: 'Counsellor' },
    { label: 'Admin', value: 'Admin' },
  ];

  facultyTypeOptions = [
    { label: 'Teaching', value: 'TEACHING' },
    { label: 'Non Teaching', value: 'NON_TEACHING' },
  ];

  payrollOptions = [
    { label: 'Suguna', value: 'suguna' },
    { label: 'Z7I', value: 'z7i' },
  ];

  weekoffDays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  private moduleName = 'ims';
  entiId: any;

  columns = [
    { key: 'staffName', label: 'Staff Name', sortable: true },
    { key: 'staffCode', label: 'Staff Code', sortable: true },
    { key: 'employeeId', label: 'Employee ID', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'centerId.centerCode', label: 'Center Code', sortable: false },
    { key: 'centerId.centerName', label: 'Center Name', sortable: false },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View',
      callback: (row: any) => this.openView(row),
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

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Staff' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadMasters();
    // this.loadStaff({ page: 1, pageSize: 10 });
    this.setupFacultyRules();
  }

  private initForm() {
    this.staffForm = this.fb.group({
      staffName: ['', [Validators.required, Validators.minLength(3)]],
      staffCode: ['', [Validators.required, Validators.minLength(2)]],
      employeeId: ['', [Validators.required, Validators.minLength(2)]],

      role: ['', Validators.required],

      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      email: ['', [Validators.email]],
      centerId: ['', Validators.required],

      // UI keeps yyyy-MM-dd; backend expects epoch ms
      joiningDate: ['', Validators.required],
      relievingDate: [''],

      payroll: ['', Validators.required],
      department: ['', Validators.required],

      facultyType: [null],
      subject: [null],
      weekoff: [[]],

      // kept to preserve edit status, but NOT shown in form UI
      status: ['Active'],
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

  fetchTableData(params: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: string;
  }) {
    this.loading = true;

    // map UI columns to backend fields (optional safety)
    const sortMap: any = {
      staffName: 'staffName',
      staffCode: 'staffCode',
      employeeId: 'employeeId',
      role: 'role',
      phone: 'phone',
      email: 'email',
    };

    let sortParam = '';
    if (params.sortKey) {
      const k = sortMap[params.sortKey] || params.sortKey;
      sortParam = params.sortDirection === 'desc' ? `-${k}` : k;
    }

    const query: any = {
      page: params.page,
      limit: params.pageSize,
    };
    if (sortParam) query.sort = sortParam;
    if (params.search) query.search = params.search;

    const queryString = Object.keys(query)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`,
      )
      .join('&');

    const body = { entiId: this.entiId };

    this.commonApi
      .fetchData(body, 'ims', `staff/list?${queryString}`)
      .subscribe({
        next: (res: any) => {
          this.totalRecords = res?.count || 0;
          this.staffData = (res?.data || []).map((s: any) => ({
            recId: s._id,
            staffId: s.staffId,
            staffName: s.staffName,
            staffCode: s.staffCode,
            employeeId: s.employeeId,
            role: s.role,
            phone: s.phone,
            email: s.email,
            centerId: s.centerId, // populated object (centerCode/centerName)
            status: s.status,
            _raw: s,
          }));
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.alert.error('Failed to load staff');
        },
      });
  }

  add() {
    this.formMode = 'create';
    this.editingRecId = null;
    this.editingStatus = 'Active';

    this.staffForm.reset({
      staffName: '',
      staffCode: '',
      employeeId: '',
      role: '',
      phone: '',
      email: '',
      centerId: '',
      joiningDate: '',
      relievingDate: '',
      payroll: '',
      department: '',
      facultyType: null,
      subject: null,
      weekoff: [],
      status: 'Active',
    });

    this.showForm = true;
  }

  edit(row: any) {
    const s = row?._raw || {};
    this.formMode = 'edit';
    this.editingRecId = s._id || null;
    this.editingStatus = s.status === 'Inactive' ? 'Inactive' : 'Active';

    // ✅ FIX: centerId may be string OR populated object OR {centerId}
    const centerValue =
      s?.centerId?.centerId || s?.centerId?._id || s?.centerId || '';

    // dept/subject may be string OR populated object
    const deptValue = s?.department?._id || s?.department || '';
    const subjValue = s?.subject?._id || s?.subject || null;

    this.staffForm.patchValue({
      staffName: s.staffName || '',
      staffCode: s.staffCode || '',
      employeeId: s.employeeId || '',

      role: s.role || '',
      phone: s.phone || '',
      email: s.email || '',
      centerId: centerValue,

      joiningDate: this.msToDateInput(s.joiningDate),
      relievingDate: this.msToDateInput(s.relievingDate),

      payroll: s.payroll || '',
      department: deptValue,
      facultyType: s.facultyType || null,
      subject: subjValue,
      weekoff: Array.isArray(s.weekoff) ? s.weekoff : [],
      status: this.editingStatus,
    });

    this.showForm = true;
  }

  cancel() {
    this.showForm = false;
  }

  save() {
    if (this.staffForm.invalid) {
      this.staffForm.markAllAsTouched();
      this.alert.error('Please fix validations and submit');
      return;
    }
    const form = this.staffForm.getRawValue() || {};
    if (form.role === 'Faculty') {
      if (!form.facultyType) {
        this.alert.error('Faculty Type is required for Faculty role');
        return;
      }
      if (form.facultyType === 'TEACHING' && !form.subject) {
        this.alert.error('Subject is required for TEACHING faculty');
        return;
      }
    }
    const joiningMs = this.dateInputToMs(form.joiningDate);
    if (!joiningMs) {
      this.alert.error('Joining Date is required');
      return;
    }
    const relievingMs = this.dateInputToMs(form.relievingDate);
    const payload: any = {
      entiId: this.entiId,
      userId: localStorage.getItem('userId') || '',
      staffName: (form.staffName || '').toString().trim(),
      staffCode: (form.staffCode || '').toString().trim().toUpperCase(),
      employeeId: (form.employeeId || '').toString().trim(),
      role: form.role,
      phone: (form.phone || '').toString().trim(),
      email: (form.email || '').toString().trim() || null,
      centerId: form.centerId,
      joiningDate: joiningMs,
      relievingDate: relievingMs || null,
      payroll: form.payroll,
      department: form.department,
      facultyType: form.role === 'Faculty' ? form.facultyType : null,
      subject:
        form.role === 'Faculty' && form.facultyType === 'TEACHING'
          ? form.subject
          : null,
      weekoff: Array.isArray(form.weekoff) ? form.weekoff : [],
    };
    payload.status =
      this.formMode === 'create' ? 'Active' : this.editingStatus || 'Active';
    const endpoint =
      this.formMode === 'create' ? 'staff/create' : 'staff/update';
    if (this.formMode === 'edit') payload.recId = this.editingRecId;
    this.commonApi.fetchData(payload, this.moduleName, endpoint).subscribe({
      next: () => {
        this.alert.success(
          this.formMode === 'create' ? 'Staff created' : 'Staff updated',
        );
        this.showForm = false;
        this.fetchTableData({ page: 1, pageSize: 10 });
      },
      error: (err: any) =>
        this.alert.error(err?.error?.message || 'Operation failed'),
    });
  }

  isWeekoffSelected(day: string) {
    const arr = this.staffForm.get('weekoff')?.value;
    return Array.isArray(arr) ? arr.includes(day) : false;
  }

  toggleWeekoff(day: string, ev: any) {
    const checked = !!ev?.target?.checked;
    const arr = Array.isArray(this.staffForm.get('weekoff')?.value)
      ? [...this.staffForm.get('weekoff')?.value]
      : [];
    const idx = arr.indexOf(day);
    if (checked && idx === -1) arr.push(day);
    if (!checked && idx >= 0) arr.splice(idx, 1);
    this.staffForm.get('weekoff')?.setValue(arr);
    this.staffForm.get('weekoff')?.markAsDirty();
  }

  private setupFacultyRules() {
    this.staffForm.get('role')?.valueChanges.subscribe((role) => {
      const ftCtrl = this.staffForm.get('facultyType');
      const subCtrl = this.staffForm.get('subject');

      if (role !== 'Faculty') {
        ftCtrl?.setValue(null, { emitEvent: false });
        subCtrl?.setValue(null, { emitEvent: false });
        ftCtrl?.clearValidators();
        subCtrl?.clearValidators();
        ftCtrl?.updateValueAndValidity({ emitEvent: false });
        subCtrl?.updateValueAndValidity({ emitEvent: false });
        return;
      }
      ftCtrl?.setValidators([Validators.required]);
      ftCtrl?.updateValueAndValidity({ emitEvent: false });
    });

    this.staffForm.get('facultyType')?.valueChanges.subscribe((ft) => {
      const subCtrl = this.staffForm.get('subject');
      if (ft !== 'TEACHING') {
        subCtrl?.setValue(null, { emitEvent: false });
        subCtrl?.clearValidators();
        subCtrl?.updateValueAndValidity({ emitEvent: false });
        return;
      }
      subCtrl?.setValidators([Validators.required]);
      subCtrl?.updateValueAndValidity({ emitEvent: false });
    });
  }

  openView(row: any) {
    const recId = row?.recId || row?._raw?._id;
    if (!recId) return;

    this.showView = true;
    this.viewRec = null;
    this.viewRelievingDate = '';

    this.commonApi
      .fetchData({ entiId: this.entiId, recId }, this.moduleName, 'staff/view')
      .subscribe({
        next: (res: any) => {
          this.viewRec = res?.data || null;
          this.viewRelievingDate = this.msToDateInput(
            this.viewRec?.relievingDate,
          );
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Failed to load staff');
          this.showView = false;
        },
      });
  }

  closeView() {
    this.showView = false;
    this.viewRec = null;
    this.viewRelievingDate = '';
  }

  updateRelievingDate() {
    if (!this.viewRec?._id) return;
    const relievingMs = this.dateInputToMs(this.viewRelievingDate) || null;

    this.commonApi
      .fetchData(
        {
          entiId: this.entiId,
          recId: this.viewRec._id,
          relievingDate: relievingMs,
        },
        this.moduleName,
        'staff/update',
      )
      .subscribe({
        next: () => {
          this.alert.success('Relieving date updated');
          this.openView({ recId: this.viewRec._id });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Update failed'),
      });
  }

  openRetire() {
    if (!this.viewRec?._id) return;
    const rd = (this.viewRelievingDate || '').toString().trim();
    if (!rd) {
      this.alert.error('Please select relieving date to retire employee');
      return;
    }
    this.retireTarget = this.viewRec;
    this.retireMessage = `Are you sure you want to retire "${this.viewRec.staffName}"?`;
    this.retireModalVisible = true;
  }

  onRetireModalClosed(confirmed: boolean) {
    this.retireModalVisible = false;
    if (!confirmed || !this.retireTarget) return;

    const relievingMs = this.dateInputToMs(this.viewRelievingDate) || null;

    this.commonApi
      .fetchData(
        {
          entiId: this.entiId,
          recId: this.retireTarget._id,
          status: 'Inactive',
          relievingDate: relievingMs,
        },
        this.moduleName,
        'staff/update',
      )
      .subscribe({
        next: () => {
          this.alert.success('Employee retired successfully');
          this.fetchTableData({ page: 1, pageSize: 10 });
          // this.loadStaff({ page: 1, pageSize: 10 });
          this.openView({ recId: this.retireTarget._id });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Retire failed'),
      });

    this.retireTarget = null;
  }

  // ======================================
  // DELETE
  // ======================================
  openDelete(row: any) {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete "${row.staffName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    const payload = { entiId: this.entiId, recId: this.deleteTarget.recId };
    this.commonApi
      .fetchData(payload, this.moduleName, 'staff/delete')
      .subscribe({
        next: () => {
          this.alert.success('Staff deleted successfully');
          this.fetchTableData({ page: 1, pageSize: 10 });
          // this.loadStaff({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Delete failed'),
      });

    this.deleteTarget = null;
  }

  // ======================================
  // IMPORT
  // ======================================
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
        const data: ArrayBuffer = e.target.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, {
          defval: '',
        }) as any[];
        const mapped = rawRows.map((r: any, idx: number) =>
          this.mapExcelRow(r, idx + 2),
        );
        this.importPreviewRows = mapped;
        this.computeImportValidation();
      } catch (err) {
        console.error(err);
        this.alert.error('Unable to read Excel file');
        this.importPreviewRows = [];
        this.computeImportValidation();
      }
    };
    reader.onerror = () => this.alert.error('Unable to read file');
    reader.readAsArrayBuffer(file);
  }

  private mapExcelRow(r: any, rowNo: number) {
    const map: any = {};
    Object.keys(r || {}).forEach(
      (k) => (map[String(k).trim().toLowerCase()] = r[k]),
    );
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const v = map[String(k).trim().toLowerCase()];
        if (v !== undefined && v !== null && String(v).trim() !== '')
          return String(v).trim();
      }
      return '';
    };
    const staffName = get('staff name', 'staffname');
    const staffCode = (get('staff code', 'staffcode') || '').toUpperCase();
    const employeeId = get('employee id', 'employeeid', 'emp id', 'empid');
    const role = get('role');
    const phone = get('phone');
    const email = get('email') || null;
    const centerCode = (get('center code', 'centercode') || '').toUpperCase();
    const department = get('department', 'departmentid');
    const subject = get('subject', 'subjectid');
    const joiningDate = get('joining date', 'joiningdate');
    const relievingDate = get('relieving date', 'relievingdate') || null;
    const payroll = get('payroll');
    const facultyType = get('faculty type', 'facultytype') || null;
    const weekoffText = get('weekoff') || '';
    const status = get('status') === 'Inactive' ? 'Inactive' : 'Active';
    const errors: string[] = [];
    if (!staffName) errors.push('Staff Name required');
    if (!staffCode) errors.push('Staff Code required');
    if (!employeeId) errors.push('Employee ID required');
    if (!role) errors.push('Role required');
    if (!phone) errors.push('Phone required');
    if (!centerCode) errors.push('Center Code required');
    if (!joiningDate) errors.push('Joining Date required');
    if (!payroll) errors.push('Payroll required');
    if (!department) errors.push('Department required');
    if (role === 'Faculty') {
      if (!facultyType) errors.push('Faculty Type required');
      if (facultyType === 'TEACHING' && !subject)
        errors.push('Subject required for TEACHING');
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push('Invalid email');
    const resolvedCenterId = this.resolveCenterIdByCode(centerCode);
    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,
      staffName,
      staffCode,
      employeeId,
      role,
      phone,
      email,
      centerCode,
      centerId: resolvedCenterId || null,
      joiningDate,
      relievingDate,
      payroll,
      department,
      facultyType,
      subject,
      weekoffText,
      status,
    };
  }

  private computeImportValidation() {
    const invalid = (this.importPreviewRows || []).filter((x) => !x._valid);
    this.importInvalidCount = invalid.length;
    this.importHasInvalidRows = invalid.length > 0;
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
    const mode = 'upsert';
    const rows = this.importPreviewRows.map((r) => {
      const joiningMs = this.dateInputToMs(r.joiningDate);
      const relievingMs = this.dateInputToMs(r.relievingDate);
      const centerCode = (r.centerCode || '').toString().trim().toUpperCase();
      const centerId =
        r.centerId || this.resolveCenterIdByCode(centerCode) || null;
      return {
        staffName: r.staffName,
        staffCode: r.staffCode,
        employeeId: r.employeeId,
        role: r.role,
        phone: r.phone,
        email: r.email,
        center: centerCode,
        centerId: centerId,
        joiningDate: joiningMs,
        relievingDate: relievingMs || null,
        facultyType: r.role === 'Faculty' ? r.facultyType : null,
        subject: r.subject,
        payroll: r.payroll,
        department: r.department,
        weekoff: r.weekoffText,
        status: r.status,
      };
    });
    const payload = {
      entiId: this.entiId,
      mode,
      rows,
    };
    this.commonApi
      .fetchData(payload, this.moduleName, 'staff/import')
      .subscribe({
        next: (res: any) => {
          const s = res?.summary || {};
          this.alert.success(
            `Import completed. Inserted: ${s.inserted || 0}, Updated: ${s.upserted || 0}`,
          );
          this.closeImport();
          this.fetchTableData({ page: 1, pageSize: 10 });
        },
        error: (err: any) => {
          const msg = err?.error?.message || 'Import failed';
          this.alert.error(msg);
        },
      });
  }

  downloadSampleExcel() {
    const rows = [
      {
        'Staff Name': 'RAJESH K',
        'Staff Code': 'STF001',
        'Employee ID': 'EMP001',
        Role: 'Faculty',
        Phone: '9876543210',
        Email: 'rajesh@example.com',
        'Center Code': '64',
        'Joining Date': '2026-01-01',
        'Relieving Date': '',
        Payroll: 'z7i',
        Department: 'ACADEMICS',
        'Faculty Type': 'TEACHING',
        Subject: 'PHYSICS',
        Weekoff: 'Sunday',
        Status: 'Active',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff');
    XLSX.writeFile(wb, 'Staff_Import_Sample.xlsx');
  }

  // ======================================
  // Masters
  // ======================================
  private loadMasters() {
    this.commonApi
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `dept/list?list=full`,
      )
      .subscribe({
        next: (res: any) => {
          const rows = res?.data || [];
          this.departmentOptions = rows.map((d: any) => ({
            label: d.departmentName,
            value: d._id,
          }));
        },
        error: () => this.alert.error('Failed to load departments'),
      });

    this.commonApi
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `subject/list?list=full`,
      )
      .subscribe({
        next: (res: any) => {
          const rows = res?.data || [];
          this.subjectOptions = rows.map((s: any) => ({
            label: s.subjectName,
            value: s._id,
          }));
        },
        error: () => this.alert.error('Failed to load subjects'),
      });

    // centers
    this.commonApi
      .fetchData({ entiId: this.entiId }, 'ims/center', `list?list=full`)
      .subscribe({
        next: (res: any) => {
          const rows = res?.data || [];

          this.centerCodeToId.clear();
          this.centerIdToCode.clear();
          this.centerIdToName.clear();

          this.centerOptions = rows.map((c: any) => {
            const centerId = String(c.centerId || c._id || '').trim();
            const code = String(c.centerCode || c.code || '')
              .trim()
              .toUpperCase();
            const name = String(c.centerName || c.name || '').trim();

            if (code && centerId) this.centerCodeToId.set(code, centerId);
            if (centerId) this.centerIdToCode.set(centerId, code);
            if (centerId) this.centerIdToName.set(centerId, name);

            // ✅ show "CODE - NAME"
            const label = code ? `${code} - ${name}` : name || centerId;

            return { label, value: centerId };
          });
        },
        error: () => {
          this.centerOptions = [];
          this.centerCodeToId.clear();
          this.centerIdToCode.clear();
          this.centerIdToName.clear();
        },
      });
  }

  private resolveCenterIdByCode(centerCodeRaw: string): string | null {
    const code = (centerCodeRaw || '').toString().trim().toUpperCase();
    if (!code) return null;
    return this.centerCodeToId.get(code) || null;
  }

  // ======================================
  // Date helpers (ms <-> yyyy-MM-dd)
  // ======================================
  private dateInputToMs(v: any): number | null {
    const s = v === null || v === undefined ? '' : String(v).trim();
    if (!s) return null;

    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const ms = Date.UTC(y, mo, d);
      return Number.isFinite(ms) ? ms : null;
    }

    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }

  private msToDateInput(ms: any): string {
    const n = Number(ms);
    if (!Number.isFinite(n) || !n) return '';
    const d = new Date(n);
    return d.toISOString().slice(0, 10);
  }

  // helpers for view display (optional)
  getCenterDisplayFromValue(centerValue: any): string {
    const id = String(
      centerValue?.centerId || centerValue?._id || centerValue || '',
    ).trim();
    if (!id) return '-';
    const code = this.centerIdToCode.get(id) || '';
    const name = this.centerIdToName.get(id) || '';
    return code ? `${code} - ${name}` : name || id;
  }
}
