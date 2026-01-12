import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import * as XLSX from 'xlsx';
type ImportMode = 'insert' | 'upsert';

@Component({
  selector: 'app-staff',
  standalone: false,
  templateUrl: './staff.component.html',
  styleUrl: './staff.component.scss',
})
export class StaffComponent implements OnInit {
  staffForm!: FormGroup;
  totalRecords = 0;
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingRecId: string | null = null;
  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';
  entiId: any;
  staffData: any[] = [];
  showImport = false;
  importMode: ImportMode = 'upsert';
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;
  showView = false;
  viewRec: any | null = null;
  retireModalVisible = false;
  retireMessage = '';
  retireTarget: any | null = null;
  viewRelievingDate = '';
  private moduleName = 'ims';
  columns = [
    { key: 'staffName', label: 'Staff Name', sortable: true },
    { key: 'staffCode', label: 'Staff Code', sortable: true },
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
  centerOptions: any[] = [];
  departmentOptions: any[] = [];
  subjectOptions: any[] = [];

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

  statusOptions = [
    { label: 'Active', value: 'Active' },
    { label: 'Inactive', value: 'Inactive' },
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

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService
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
    this.loadStaff({ page: 1, pageSize: 10 });
    this.setupFacultyRules();
  }

  initForm() {
    this.staffForm = this.fb.group({
      staffName: ['', Validators.required],
      staffCode: ['', Validators.required],
      role: ['', Validators.required],
      phone: ['', Validators.required],
      email: [''],
      centerId: ['', Validators.required],
      joiningDate: ['', Validators.required],
      relievingDate: [''],
      payroll: ['', Validators.required],
      department: ['', Validators.required],
      status: ['Active', Validators.required],
      facultyType: [null],
      subject: [null],
      weekoff: [[]],
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

  getCenterName(centerId: string) {
    const f = (this.centerOptions || []).find(
      (x) => String(x.value) === String(centerId)
    );
    return f?.label || centerId || '-';
  }

  getDepartmentName(deptId: string) {
    const f = (this.departmentOptions || []).find(
      (x) => String(x.value) === String(deptId)
    );
    return f?.label || deptId || '-';
  }

  getSubjectName(subId: string) {
    const f = (this.subjectOptions || []).find(
      (x) => String(x.value) === String(subId)
    );
    return f?.label || subId || '-';
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
          this.viewRelievingDate = this.viewRec?.relievingDate || '';
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

  loadStaff(event?: {
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
      staffName: 'staffName',
      staffCode: 'staffCode',
      role: 'role',
      status: 'status',
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
      .fetchData({ entiId: this.entiId }, this.moduleName, `staff/list${qp}`)
      .subscribe({
        next: (res: any) => {
          this.totalRecords = res?.count || 0;
          this.staffData = (res?.data || []).map((s: any) => ({
            recId: s._id,
            staffId: s.staffId,
            staffName: s.staffName,
            staffCode: s.staffCode,
            role: s.role,
            phone: s.phone,
            email: s.email,
            centerId: s.centerId,
            status: s.status,
            _raw: s,
          }));
        },
        error: () => this.alert.error('Failed to load staff'),
      });
  }

  add() {
    this.formMode = 'create';
    this.editingRecId = null;
    this.staffForm.reset({
      staffName: '',
      staffCode: '',
      role: '',
      phone: '',
      email: '',
      centerId: '',
      joiningDate: '',
      relievingDate: '',
      payroll: '',
      department: '',
      status: 'Active',
      facultyType: null,
      subject: null,
      weekoff: [],
    });
    this.showForm = true;
  }

  edit(row: any) {
    const s = row._raw;
    this.formMode = 'edit';
    this.editingRecId = s._id;
    this.staffForm.patchValue({
      staffName: s.staffName || '',
      staffCode: s.staffCode || '',
      role: s.role || '',
      phone: s.phone || '',
      email: s.email || '',
      centerId: s.centerId || '',
      joiningDate: s.joiningDate || '',
      relievingDate: s.relievingDate || '',
      payroll: s.payroll || '',
      department: s.department || '',
      status: s.status || 'Active',
      facultyType: s.facultyType || null,
      subject: s.subject || null,
      weekoff: Array.isArray(s.weekoff) ? s.weekoff : [],
    });
    this.showForm = true;
  }

  cancel() {
    this.showForm = false;
  }

  save() {
    if (this.staffForm.invalid) {
      this.staffForm.markAllAsTouched();
      this.alert.error('Please fill all required fields');
      return;
    }
    const form = this.staffForm.value || {};
    if (form.role === 'Faculty') {
      if (!form.facultyType) {
        this.alert.error('Faculty Type is required for Faculty role');
        return;
      }
      if (form.facultyType === 'TEACHING' && !form.subject) {
        this.alert.error('Subject is required for Teaching faculty');
        return;
      }
    }
    const payload: any = {
      entiId: this.entiId,
      staffName: (form.staffName || '').toString().trim(),
      staffCode: (form.staffCode || '').toString().trim().toUpperCase(),
      role: form.role,
      phone: (form.phone || '').toString().trim(),
      email: (form.email || '').toString().trim() || null,
      centerId: form.centerId,
      joiningDate: (form.joiningDate || '').toString().trim(),
      relievingDate: (form.relievingDate || '').toString().trim() || null,
      payroll: form.payroll,
      department: form.department,
      status: form.status || 'Active',
      facultyType: form.role === 'Faculty' ? form.facultyType : null,
      subject:
        form.role === 'Faculty' && form.facultyType === 'TEACHING'
          ? form.subject
          : null,
      weekoff: Array.isArray(form.weekoff) ? form.weekoff : [],
    };
    const endpoint =
      this.formMode === 'create' ? 'staff/create' : 'staff/update';
    if (this.formMode === 'edit') payload.recId = this.editingRecId;
    this.commonApi.fetchData(payload, this.moduleName, endpoint).subscribe({
      next: () => {
        this.alert.success(
          this.formMode === 'create'
            ? 'Staff created successfully'
            : 'Staff updated successfully'
        );
        this.showForm = false;
        this.loadStaff({ page: 1, pageSize: 10 });
      },
      error: (err: any) =>
        this.alert.error(err?.error?.message || 'Operation failed'),
    });
  }

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
          this.loadStaff({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Delete failed'),
      });
    this.deleteTarget = null;
  }

  private setupFacultyRules() {
    this.staffForm.get('role')?.valueChanges.subscribe((role) => {
      if (role !== 'Faculty') {
        this.staffForm.patchValue(
          { facultyType: null, subject: null },
          { emitEvent: false }
        );
      }
    });
    this.staffForm.get('facultyType')?.valueChanges.subscribe((ft) => {
      if (ft !== 'TEACHING') {
        this.staffForm.patchValue({ subject: null }, { emitEvent: false });
      }
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

  private loadMasters() {
    this.commonApi
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `dept/list?list=full`
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
        `subject/list?list=full`
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
    this.commonApi
      .fetchData({ entiId: this.entiId }, 'ims/center', `list?list=full`)
      .subscribe({
        next: (res: any) => {
          const rows = res?.data || [];
          this.centerOptions = rows.map((c: any) => ({
            label: c.centerName || c.name || c.centerId,
            value: c.centerId || c._id,
          }));
        },
        error: () => {
          this.centerOptions = [];
        },
      });
  }

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
        const mapped = rawRows.map((r: any, idx: number) =>
          this.mapExcelRow(r, idx + 2)
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
      (k) => (map[String(k).trim().toLowerCase()] = r[k])
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
    const role = get('role');
    const phone = get('phone');
    const email = get('email') || null;
    const center = get('center', 'centername', 'center code', 'centerid');
    const department = get('department', 'departmentname', 'department code');
    const subject = get('subject', 'subjectname', 'subject code');
    const joiningDate = get('joining date', 'joiningdate');
    const relievingDate = get('relieving date', 'relievingdate') || null;
    const payroll = get('payroll');
    const facultyType = get('faculty type', 'facultytype') || null;
    const weekoffText = get('weekoff') || '';
    const status = get('status') === 'Inactive' ? 'Inactive' : 'Active';
    const errors: string[] = [];
    if (!staffName) errors.push('Staff Name required');
    if (!staffCode) errors.push('Staff Code required');
    if (!role) errors.push('Role required');
    if (!phone) errors.push('Phone required');
    if (!center) errors.push('CenterId required');
    if (!joiningDate) errors.push('Joining Date required');
    if (!payroll) errors.push('Payroll required');
    if (!department) errors.push('DepartmentId required');
    if (role === 'Faculty') {
      if (!facultyType) errors.push('Faculty Type required');
      if (facultyType === 'TEACHING' && !subject)
        errors.push('SubjectId required for TEACHING');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push('Invalid email');
    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,
      staffName,
      staffCode,
      role,
      phone,
      email,
      center,
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
    const rows = this.importPreviewRows.map((r) => ({
      staffName: r.staffName,
      staffCode: r.staffCode,
      role: r.role,
      phone: r.phone,
      email: r.email,
      center: r.center,
      joiningDate: r.joiningDate,
      relievingDate: r.relievingDate,
      facultyType: r.role === 'Faculty' ? r.facultyType : null,
      subject: r.subject,
      payroll: r.payroll,
      department: r.department,
      weekoff: r.weekoffText,
      status: r.status,
    }));
    const payload = {
      entiId: this.entiId,
      mode: this.importMode,
      rows,
    };
    this.commonApi
      .fetchData(payload, this.moduleName, 'staff/import')
      .subscribe({
        next: (res: any) => {
          const s = res?.summary || {};
          if (s.mode === 'insert') {
            this.alert.success(
              `Import completed. Inserted: ${s.inserted || 0}, Skipped: ${
                s.skipped || 0
              }`
            );
          } else {
            this.alert.success(
              `Import completed. Inserted: ${s.inserted || 0}, Updated: ${
                s.upserted || 0
              }`
            );
          }
          this.closeImport();
          this.loadStaff({ page: 1, pageSize: 10 });
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
        Role: 'Faculty',
        Phone: '9876543210',
        Email: 'rajesh@example.com',
        Center: 'Chennai Center',
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

  updateRelievingDate() {
    if (!this.viewRec?._id) return;
    const relievingDate =
      (this.viewRelievingDate || '').toString().trim() || null;
    this.commonApi
      .fetchData(
        { entiId: this.entiId, recId: this.viewRec._id, relievingDate },
        this.moduleName,
        'staff/update'
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
    const relievingDate =
      (this.viewRelievingDate || '').toString().trim() || null;
    this.commonApi
      .fetchData(
        {
          entiId: this.entiId,
          recId: this.retireTarget._id,
          status: 'Inactive',
          relievingDate,
        },
        this.moduleName,
        'staff/update'
      )
      .subscribe({
        next: () => {
          this.alert.success('Employee retired successfully');
          this.loadStaff({ page: 1, pageSize: 10 });
          this.openView({ recId: this.retireTarget._id });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Retire failed'),
      });

    this.retireTarget = null;
  }
}
