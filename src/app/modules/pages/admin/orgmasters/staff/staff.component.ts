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
  viewRelievingDate = '';
  showImport = false;
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;
  importing = false; // FIX #16
  importMode: 'upsert' | 'insert' = 'upsert'; // FIX #11
  centerOptions: any[] = [];
  departmentOptions: any[] = [];
  subjectOptions: any[] = [];
  private centerCodeToId = new Map<string, string>();
  private centerIdToCode = new Map<string, string>();
  private centerIdToName = new Map<string, string>();
  // FIX #1/#2/#4: track actual portal access state separately
  systemAccessDisabled = false; // true  = already has a user account
  systemAccessLinked = false; // alias for template clarity

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
    // FIX #7: show portal access status in table
    { key: 'hasSystemAccess', label: 'Portal Access', sortable: false },
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
      { label: 'Org Configs' },
      { label: 'Staff' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadMasters();
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
      joiningDate: ['', Validators.required],
      relievingDate: [''],
      payroll: ['', Validators.required],
      department: ['', Validators.required],
      facultyType: [null],
      subject: [null],
      weekoff: [[]],
      salaryCtc: [null],
      monthlySalary: [null],
      createSystemAccess: [false],
      status: ['Active'],
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
    const query: any = { page: params.page, limit: params.pageSize };
    if (sortParam) query.sort = sortParam;
    if (params.search) query.search = params.search;
    const queryString = Object.keys(query)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
      .join('&');

    this.commonApi
      .fetchData({ entiId: this.entiId }, 'ims', `staff/list?${queryString}`)
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
            centerId: s.centerId,
            status: s.status,
            // FIX #6 & #7: preserve userId so edit() can detect portal access
            userId: s.userId || null,
            hasSystemAccess: s.hasSystemAccess ?? !!s.userId,
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
    this.systemAccessDisabled = false;
    this.systemAccessLinked = false;
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
      salaryCtc: null,
      monthlySalary: null,
      createSystemAccess: false,
      weekoff: [],
      status: 'Active',
    });
    this.staffForm.get('createSystemAccess')?.enable({ emitEvent: false });
    this.showForm = true;
  }

  edit(row: any) {
    // FIX #3: set formMode FIRST so any downstream logic sees correct mode
    this.formMode = 'edit';
    const s = row?._raw || {};
    this.editingRecId = s._id || null;
    this.editingStatus = s.status === 'Inactive' ? 'Inactive' : 'Active';

    // FIX #1/#2/#4/#5: determine portal access state
    this.systemAccessDisabled = !!(s.userId || row?.userId);
    this.systemAccessLinked = this.systemAccessDisabled;

    const accessCtrl = this.staffForm.get('createSystemAccess');
    if (accessCtrl) {
      // FIX #1: if already linked, show true (has access) and disable
      // if not linked, allow toggle to grant access
      accessCtrl.setValue(this.systemAccessLinked, { emitEvent: false });
      if (this.systemAccessLinked) {
        accessCtrl.disable({ emitEvent: false });
      } else {
        accessCtrl.enable({ emitEvent: false });
      }
    }

    const centerValue =
      s?.centerId?.centerId || s?.centerId?._id || s?.centerId || '';
    // FIX #8: prefer _id for department since departmentOptions.value = d._id
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
      salaryCtc: s.salaryCtc ?? null,
      monthlySalary: s.monthlySalary ?? null,
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
    const createSystemAccess = form.createSystemAccess === true;

    if (createSystemAccess && !(form.email || '').toString().trim()) {
      this.alert.error('Email is required to create a system access account');
      return;
    }
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
      // FIX #10: renamed to actingUserId so it does NOT collide with Staff.userId field
      actingUserId: localStorage.getItem('userId') || '',
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
      // FIX #5: only send createSystemAccess=true when NOT already linked
      createSystemAccess: this.systemAccessLinked ? false : createSystemAccess,
      department: form.department,
      facultyType: form.role === 'Faculty' ? form.facultyType : null,
      subject:
        form.role === 'Faculty' && form.facultyType === 'TEACHING'
          ? form.subject
          : null,
      salaryCtc: form.salaryCtc ? Number(form.salaryCtc) : null,
      monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : null,
      weekoff: Array.isArray(form.weekoff) ? form.weekoff : [],
      status:
        this.formMode === 'create' ? 'Active' : this.editingStatus || 'Active',
    };

    if (this.formMode === 'edit') payload.recId = this.editingRecId;

    this.commonApi
      .fetchData(
        payload,
        this.moduleName,
        this.formMode === 'create' ? 'staff/create' : 'staff/update',
      )
      .subscribe({
        next: () => {
          this.alert.success(
            this.formMode === 'create' ? 'Staff created' : 'Staff updated',
          );
          this.showForm = false;
          this.fetchTableData({ page: 1, pageSize: 5 });
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

  // ======================================
  // VIEW
  // ======================================
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
    if (!(this.viewRelievingDate || '').toString().trim()) {
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
          this.fetchTableData({ page: 1, pageSize: 5 });
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
    this.commonApi
      .fetchData(
        { entiId: this.entiId, recId: this.deleteTarget.recId },
        this.moduleName,
        'staff/delete',
      )
      .subscribe({
        next: () => {
          this.alert.success('Staff deleted successfully');
          this.fetchTableData({ page: 1, pageSize: 10 });
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
    // FIX #17: always reset on close so stale rows never show on reopen
    this.resetImport();
  }

  resetImport() {
    this.importFileName = '';
    this.importPreviewRows = [];
    this.importHasInvalidRows = false;
    this.importInvalidCount = 0;
    this.importing = false;
    this.importMode = 'upsert';
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
        this.importPreviewRows = rawRows.map((r, idx) =>
          this.mapExcelRow(r, idx + 2),
        );
        this.computeImportValidation();
      } catch (err) {
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
    // FIX #13: lowercase payroll so it matches backend enum (suguna / z7i)
    const payroll = (get('payroll') || '').toLowerCase();
    const facultyType = get('faculty type', 'facultytype') || null;
    const salaryCtcRaw = get('salary ctc', 'salaryctc', 'ctc');
    const salaryCtc = salaryCtcRaw ? Number(salaryCtcRaw) : null;
    const monthlySalaryRaw = get('monthly salary', 'monthlysalary');
    const monthlySalary = monthlySalaryRaw ? Number(monthlySalaryRaw) : null;
    const weekoffText = get('weekoff') || '';
    const status = get('status') === 'Inactive' ? 'Inactive' : 'Active';
    const createSystemAccessText = get(
      'create system access',
      'createsystemaccess',
      'system access',
      'systemaccess',
    );
    const createSystemAccess = [
      '1',
      'true',
      'yes',
      'y',
      'enable',
      'enabled',
    ].includes((createSystemAccessText || '').toLowerCase());

    const errors: string[] = [];
    if (!staffName) errors.push('Staff Name required');
    if (!staffCode) errors.push('Staff Code required');
    if (!employeeId) errors.push('Employee ID required');
    if (!role) errors.push('Role required');
    if (!phone) errors.push('Phone required');
    // FIX #14: validate phone format
    if (phone && !/^\d{10}$/.test(phone))
      errors.push('Phone must be 10 digits');
    if (!centerCode) errors.push('Center Code required');
    if (!joiningDate) errors.push('Joining Date required');
    if (!payroll) errors.push('Payroll required');
    if (!department) errors.push('Department required');
    if (role === 'Faculty') {
      if (!facultyType) errors.push('Faculty Type required');
      if (facultyType === 'TEACHING' && !subject)
        errors.push('Subject required for TEACHING');
    }
    if (createSystemAccess && !email)
      errors.push('Email required for System Access');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push('Invalid email');

    const resolvedCenterId = this.resolveCenterIdByCode(centerCode);
    // FIX #15: if centerCode given but cannot resolve, mark row invalid
    if (centerCode && !resolvedCenterId)
      errors.push(`Center Code "${centerCode}" not found`);

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
      salaryCtc,
      monthlySalary,
      createSystemAccess,
      subject,
      weekoffText,
      status,
    };
  }

  private computeImportValidation() {
    const invalid = (this.importPreviewRows || []).filter(
      (x) => !x._valid || x._importOk === false,
    );
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
    if (this.importing) return; // FIX #16: prevent double-click

    const rows = this.importPreviewRows.map((r) => {
      const joiningMs = this.parseDDMMMYYYY(r.joiningDate);
      const relievingMs = this.parseDDMMMYYYY(r.relievingDate);
      const centerCode = (r.centerCode || '').toString().trim().toUpperCase();
      const centerId =
        r.centerId || this.resolveCenterIdByCode(centerCode) || null;
      return {
        _rowNo: r._rowNo,
        staffName: r.staffName,
        staffCode: r.staffCode,
        employeeId: r.employeeId,
        role: r.role,
        phone: r.phone,
        email: r.email,
        center: centerCode,
        centerId,
        joiningDate: joiningMs,
        relievingDate: relievingMs || null,
        facultyType: r.role === 'Faculty' ? r.facultyType : null,
        subject: r.subject,
        // FIX #13: already lowercased in mapExcelRow
        payroll: r.payroll,
        department: r.department,
        salaryCtc: r.salaryCtc || null,
        monthlySalary: r.monthlySalary || null,
        weekoff: r.weekoffText,
        status: r.status,
        createSystemAccess: r.createSystemAccess === true,
      };
    });

    // FIX #11: use importMode selected by admin
    const payload = { entiId: this.entiId, mode: this.importMode, rows };
    this.importing = true; // FIX #16

    this.commonApi
      .fetchData(payload, this.moduleName, 'staff/import')
      .subscribe({
        next: (res: any) => {
          const { summary, results } = this.pickImportPayload(res);
          if (results.length) this.applyImportResultsToPreview(results);
          const inserted = Number(summary?.inserted || summary?.created || 0);
          const upserted = Number(summary?.upserted || summary?.updated || 0);
          const failedComputed =
            Number(summary?.failed || 0) ||
            (results.length
              ? results.filter(
                (x: any) => !(x?.ok === true || x?.status === true),
              ).length
              : 0);
          this.importing = false;
          const msg = `Import completed. Inserted: ${inserted}, Updated: ${upserted}, Failed: ${failedComputed}`;
          if (failedComputed > 0) {
            this.alert.error(msg);
            return;
          }
          this.alert.success(msg);
          this.closeImport();
          this.fetchTableData({ page: 1, pageSize: 5 });
        },
        error: (err: any) => {
          this.importing = false;
          const resp = err?.error || err;
          const { summary, results } = this.pickImportPayload(resp);
          if (Array.isArray(results) && results.length) {
            this.applyImportResultsToPreview(results);
            const inserted = Number(summary?.inserted || summary?.created || 0);
            const upserted = Number(summary?.upserted || summary?.updated || 0);
            const failed =
              Number(summary?.failed || 0) ||
              results.filter(
                (x: any) => !(x?.ok === true || x?.status === true),
              ).length;
            this.alert.error(
              resp?.message ||
              `Import completed with errors. Inserted: ${inserted}, Updated: ${upserted}, Failed: ${failed}`,
            );
            return;
          }
          this.alert.error(
            resp?.message ||
            resp?.error?.message ||
            err?.message ||
            'Import failed',
          );
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
        'Joining Date': '01-Jan-2026',
        'Relieving Date': '',
        Payroll: 'z7i',
        Department: 'ACADEMICS',
        'Faculty Type': 'TEACHING',
        Subject: 'PHYSICS',
        'Salary CTC': '600000',
        'Monthly Salary': '50000',
        Weekoff: 'Sunday',
        Status: 'Active',
        'Create System Access': 'Yes',
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
        'dept/list?list=full',
      )
      .subscribe({
        next: (res: any) => {
          this.departmentOptions = (res?.data || []).map((d: any) => ({
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
        'subject/list?list=full',
      )
      .subscribe({
        next: (res: any) => {
          this.subjectOptions = (res?.data || []).map((s: any) => ({
            label: s.subjectName,
            value: s._id,
          }));
        },
        error: () => this.alert.error('Failed to load subjects'),
      });

    this.commonApi
      .fetchData({ entiId: this.entiId }, 'ims/center', 'list?list=full')
      .subscribe({
        next: (res: any) => {
          this.centerCodeToId.clear();
          this.centerIdToCode.clear();
          this.centerIdToName.clear();
          this.centerOptions = (res?.data || []).map((c: any) => {
            const centerId = String(c.centerId || c._id || '').trim();
            const code = String(c.centerCode || c.code || '')
              .trim()
              .toUpperCase();
            const name = String(c.centerName || c.name || '').trim();
            if (code && centerId) this.centerCodeToId.set(code, centerId);
            if (centerId) this.centerIdToCode.set(centerId, code);
            if (centerId) this.centerIdToName.set(centerId, name);
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
    return code ? this.centerCodeToId.get(code) || null : null;
  }

  getCenterDisplayFromValue(centerValue: any): string {
    const id = String(
      centerValue?.centerId || centerValue?._id || centerValue || '',
    ).trim();
    if (!id) return '-';
    const code = this.centerIdToCode.get(id) || '';
    const name = this.centerIdToName.get(id) || '';
    return code ? `${code} - ${name}` : name || id;
  }

  // ======================================
  // Date helpers
  // ======================================
  private dateInputToMs(v: any): number | null {
    const s = v === null || v === undefined ? '' : String(v).trim();
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) {
      const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return Number.isFinite(ms) ? ms : null;
    }
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }

  private msToDateInput(ms: any): string {
    const n = Number(ms);
    if (!Number.isFinite(n) || !n) return '';
    return new Date(n).toISOString().slice(0, 10);
  }

  // ======================================
  // Import helpers
  // ======================================
  private pickImportPayload(resp: any) {
    const root = resp || {};
    const data = root?.data && typeof root.data === 'object' ? root.data : null;
    const summary = data?.summary || root?.summary || {};
    const resultsRaw =
      data?.results ||
      root?.results ||
      data?.invalidRows ||
      root?.invalidRows ||
      [];
    return { summary, results: Array.isArray(resultsRaw) ? resultsRaw : [] };
  }

  private applyImportResultsToPreview(results: any[]) {
    const idxMap = new Map<number, any>();
    const rowNoMap = new Map<number, any>();
    (results || []).forEach((x: any) => {
      const idx = Number(x?.index);
      if (Number.isFinite(idx) && idx >= 0) idxMap.set(idx, x);
      const rn = Number(x?.rowNo);
      if (Number.isFinite(rn) && rn > 0) rowNoMap.set(rn, x);
    });
    this.importPreviewRows = (this.importPreviewRows || []).map(
      (r: any, i: number) => {
        const rr = rowNoMap.get(Number(r._rowNo)) || idxMap.get(i) || null;
        if (!rr) return r;
        const ok = rr?.ok === true || rr?.status === true;
        const msg =
          rr?.message ||
          rr?.error ||
          rr?.reason ||
          (Array.isArray(rr?.errors) ? rr.errors.join(', ') : '') ||
          '';
        if (ok) return { ...r, _importOk: true, _importError: '' };
        return {
          ...r,
          _importOk: false,
          _importError: msg || 'Import failed',
          _valid: false,
          _errors: [msg || 'Import failed'],
        };
      },
    );
    this.computeImportValidation();
  }

  private parseDDMMMYYYY(dateStr: any): number | null {
    if (dateStr instanceof Date && !isNaN(dateStr.getTime()))
      return Date.UTC(
        dateStr.getFullYear(),
        dateStr.getMonth(),
        dateStr.getDate(),
      );
    if (
      typeof dateStr === 'number' &&
      Number.isFinite(dateStr) &&
      dateStr > 59 &&
      dateStr < 2958466
    ) {
      const ms = (Math.round(dateStr) - 25569) * 86400 * 1000;
      const d = new Date(ms);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    const raw =
      dateStr === undefined || dateStr === null ? '' : String(dateStr).trim();
    if (!raw) return null;
    if (/^\d{5,6}(\.\d+)?$/.test(raw)) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 59 && n < 2958466) {
        const ms = (Math.round(n) - 25569) * 86400 * 1000;
        const d = new Date(ms);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      }
    }
    const s = raw.split(/[\sT]/)[0].trim();
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const [, y, mo, dd] = iso.map(Number);
      if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
      return Date.UTC(y, mo - 1, dd);
    }
    const named = s.match(
      /^(\d{1,2})[-\/\s]([A-Za-z]{3,9})[-\/\s](\d{2}|\d{4})$/,
    );
    if (named) {
      const months: Record<string, number> = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        oct: 9,
        nov: 10,
        dec: 11,
      };
      const dd = Number(named[1]);
      const mo = months[named[2].slice(0, 3).toLowerCase()];
      let yyyy = Number(named[3]);
      if (yyyy < 100) yyyy += yyyy < 50 ? 2000 : 1900;
      if (mo === undefined || dd < 1 || dd > 31 || yyyy < 1900) return null;
      return Date.UTC(yyyy, mo, dd);
    }
    return null;
  }
}
