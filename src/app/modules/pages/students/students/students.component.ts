import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { forkJoin } from 'rxjs';
import * as XLSX from 'xlsx';

//Import
import { RpaimportComponent } from '../rpaimport/rpaimport.component';
import { BoardExamImportComponent } from '../board-exam-import/board-exam-import.component';
import { AlumniImportComponent } from '../alumni-import/alumni-import.component';

type ViewMode = 'list' | 'grid';

const safeTrim = (v: any) =>
  v === undefined || v === null ? '' : String(v).trim();

declare const bootstrap: any;

@Component({
  selector: 'app-students',
  standalone: false,
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
export class StudentsComponent implements OnInit {
  // ── ViewChild refs to child modal components ──────────────────────────────
  @ViewChild('rpaImportRef') rpaImportRef!: RpaimportComponent;
  @ViewChild('boardExamImportRef')
  boardExamImportRef!: BoardExamImportComponent;
  @ViewChild('alumniImportRef') alumniImportRef!: AlumniImportComponent;

  // ── Bulk Excel upload state ───────────────────────────────────────────────
  showBulkUpload = false;
  bulkFileName = '';
  bulkPreviewRows: any[] = [];
  bulkHasInvalidRows = false;
  bulkInvalidCount = 0;
  bulkUploading = false;

  // ── ZIP photo upload state ────────────────────────────────────────────────
  showImageUpload = false;
  zipFile: File | null = null;
  imageUploading = false;
  zipUploadResult: any = null;

  tenantId = localStorage.getItem('tenantId') || '';
  userId = localStorage.getItem('userId') || '';

  viewMode: ViewMode = 'list';
  loading = false;
  entiId: any;
  private moduleName = 'student';
  students: any[] = [];
  totalRecords = 0;
  currentPage = 1;
  pageSize = 20;
  searchText = '';
  selectedProgram = '';
  selectedCenter = '';
  selectedStatus = '';
  programsFull: any[] = [];
  centersFull: any[] = [];
  statusFilter = 'all';
  columns = [
    { key: 'student.name', label: 'Name', sortable: true },
    { key: 'admissionNo', label: 'Admission No', sortable: true },
    { key: 'programName', label: 'Program', sortable: true },
    { key: 'centerName', label: 'Center', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      type: 'badge',
      badgeColors: {
        ACTIVE: 'badge bg-success-subtle text-success',
        INACTIVE: 'badge bg-secondary-subtle text-secondary',
        DROPOUT: 'badge bg-danger-subtle text-danger',
        COMPLETED: 'badge bg-primary-subtle text-primary',
      },
    },
    { key: 'student.phone', label: 'Mobile', sortable: false },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View details',
      color: '#6B7280',
      callback: (row: any) => this.openDetail(row),
    },
  ];

  constructor(
    private router: Router,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([{ label: 'Students & Batches' }, { label: 'Students' }]);
  }

  ngOnInit(): void {
    this.loadAllLookupsAndInit();
    // this.loadPrograms();
    // this.loadCenters();
    // this.loadStudents();
  }

  // studentlist
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

    //filter (optional)
    if (this.statusFilter && this.statusFilter !== 'all') {
      query.status = this.statusFilter;
    }
    if (this.selectedProgram) {
      query.programId = this.selectedProgram;
    }
    if (this.selectedCenter) {
      query.centerId = this.selectedCenter;
    }

    // Build query string
    const queryString = Object.keys(query)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`
      )
      .join('&');

    const body = {
      entiId: localStorage.getItem('tenantId')
    };

    this.commonApi.fetchData(body, 'student', `list?${queryString}`).subscribe({
      next: (res: any) => {
        this.students = res.data;
        this.totalRecords = res?.count || 0;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.alert.error('Error loading admissions');
      }
    });
  }

  //program & center list
  loadAllLookupsAndInit() {
    const entiId = this.entiId;
    this.loading = true;

    forkJoin({
      program: this.commonApi.fetchData({ entiId }, 'ims', 'program/list?list=full'),
      center: this.commonApi.fetchData({ entiId }, 'ims', 'center/list?list=full'),
    }).subscribe({
      next: ({ program, center }) => {
        this.programsFull = program.data || [];
        this.centersFull = center.data || [];
      },
      error: (err) => {
        this.loading = false;
        this.alert.error(`Unable to load initial data!`);
      }
    });
  }

  loadPrograms() {
    this.commonApi
      .fetchData({ entiId: this.entiId }, 'ims', 'program/list?list=full')
      .subscribe({
        next: (res: any) => {
          this.programsFull = res?.data || [];
        },
      });
  }

  loadCenters() {
    this.commonApi
      .fetchData({ entiId: this.entiId }, 'ims', 'center/list?list=full')
      .subscribe({
        next: (res: any) => {
          this.centersFull = res?.data || [];
        },
      });
  }

  // --- Load Data ---
  // loadStudents(event?: {
  //   page: number;
  //   pageSize: number;
  //   search?: string;
  //   sortKey?: string;
  //   sortDirection?: 'asc' | 'desc';
  // }) {
  //   this.loading = true;
  //   this.currentPage = event?.page || 1;
  //   this.pageSize = event?.pageSize || 20;
  //   const queryParams: any = {
  //     page: this.currentPage,
  //     limit: this.pageSize,
  //   };
  //   if (this.searchText) queryParams.search = safeTrim(this.searchText);
  //   if (this.selectedProgram) queryParams.programId = this.selectedProgram;
  //   if (this.selectedCenter) queryParams.centerId = this.selectedCenter;
  //   if (this.selectedStatus) queryParams.status = this.selectedStatus;
  //   if (event?.sortKey) {
  //     const dir = event.sortDirection === 'asc' ? '' : '-';
  //     queryParams.sort = `${dir}${event.sortKey}`;
  //   }
  //   const qs = Object.keys(queryParams)
  //     .map((k) => `${k}=${encodeURIComponent(queryParams[k])}`)
  //     .join('&');

  //   this.commonApi
  //     .fetchData({ entiId: this.entiId }, this.moduleName, `list?${qs}`)
  //     .subscribe({
  //       next: (res: any) => {
  //         this.loading = false;
  //         this.students = (res?.data || []).map((s: any) => ({
  //           ...s,
  //           _raw: s,
  //         }));
  //         this.totalRecords = res?.count || 0;
  //       },
  //       error: (err: any) => {
  //         this.loading = false;
  //         this.alert.error(err?.error?.message || 'Failed to load students');
  //       },
  //     });
  // }

  setView(mode: ViewMode): void {
    this.viewMode = mode;
  }

  applyFilters(): void {
    // this.loadStudents({ page: 1, pageSize: this.pageSize });
    this.fetchTableData({ page: 1, pageSize: this.pageSize });
  }

  onStatusChange(value: string) {
    this.statusFilter = value;

    // reload table
    this.fetchTableData({
      page: 1,
      pageSize: this.pageSize,
      search: this.searchText
    });
  }
  onProgramChange(value: string) {
    this.selectedProgram = value;

    // reload table
    this.fetchTableData({
      page: 1,
      pageSize: this.pageSize,
      search: this.searchText
    });
  }

  onCenterChange(value: string) {
    this.selectedCenter = value;

    // reload table
    this.fetchTableData({
      page: 1,
      pageSize: this.pageSize,
      search: this.searchText
    });
  }



  clearSearch() {
    this.searchText = '';
    // this.loadStudents({ page: 1, pageSize: this.pageSize });
    this.fetchTableData({ page: 1, pageSize: this.pageSize });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  openDetail(row: any): void {
    const s = row?._raw || row;
    this.router.navigate(['/app/students/view', s.studentId]);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // IMPORT DROPDOWN  — open each modal
  // ══════════════════════════════════════════════════════════════════════════

  openBulkUpload() {
    this.showBulkUpload = true;
    this.resetBulkUpload();
  }
  closeBulkUpload() {
    if (this.bulkUploading) return;
    this.showBulkUpload = false;
  }

  openImageUpload() {
    this.showImageUpload = true;
    this.resetImageUpload();
  }
  closeImageUpload() {
    if (this.imageUploading) return;
    this.showImageUpload = false;
  }

  /** Opens the RPA bootstrap modal via the child component */
  openRpaImport() {
    this.rpaImportRef?.reset();
    const el = document.getElementById('rpaImportModal');
    if (el) new bootstrap.Modal(el).show();
  }

  /** Calls open() on the board exam import child component */
  openBoardExamImport() {
    this.boardExamImportRef?.open();
  }

  /** Calls open() on the alumni import child component */
  openAlumniImport() {
    this.alumniImportRef?.open();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BULK EXCEL UPLOAD (Student Details)
  // ══════════════════════════════════════════════════════════════════════════

  resetBulkUpload() {
    this.bulkFileName = '';
    this.bulkPreviewRows = [];
    this.bulkHasInvalidRows = false;
    this.bulkInvalidCount = 0;
  }

  downloadBulkSample() {
    const rows = [
      {
        'Enrolment Number': 'ADM001',
        'Full Name': 'John Doe',
        Mobile: '9876543210',
        Email: 'john@example.com',
        'Parent Name': 'Jane Doe',
        'Parent Mobile': '9876543211',
        'School ID': 'SCH001',
      },
      {
        'Enrolment Number': 'ADM002',
        'Full Name': 'Alice Smith',
        Mobile: '9876543220',
        Email: 'alice@example.com',
        'Parent Name': 'Bob Smith',
        'Parent Mobile': '9876543221',
        'School ID': 'SCH002',
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      'Students',
    );
    XLSX.writeFile(wb, 'Student_Bulk_Update_Sample.xlsx');
  }

  onBulkExcelSelected(ev: any) {
    if (this.bulkUploading) return;
    const file: File = ev?.target?.files?.[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      this.alert.error('Please upload a valid Excel file (.xlsx / .xls)');
      return;
    }
    this.bulkFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, {
          defval: '',
        }) as any[];
        this.bulkPreviewRows = rawRows.map((r: any, idx: number) => {
          const admissionNo = String(
            r['Enrolment Number'] || r['Admission No'] || '',
          ).trim();
          const fullName = String(r['Full Name'] || '').trim();
          const mobile = String(r['Mobile'] || r['Phone'] || '').trim();
          const email = String(r['Email'] || '').trim();
          const parentName = String(r['Parent Name'] || '').trim();
          const parentMobile = String(r['Parent Mobile'] || '').trim();
          // ── NEW: School ID ─────────────────────────────────────────────
          const studentSchoolId = String(
            r['School ID'] || r['studentSchoolId'] || '',
          ).trim();
          const errors: string[] = [];
          if (!admissionNo) errors.push('Missing Enrolment Number');
          return {
            _rowNo: idx + 2,
            _valid: errors.length === 0,
            _errors: errors,
            admissionNo,
            fullName,
            mobile,
            email,
            parentName,
            parentMobile,
            studentSchoolId,
            _raw: r,
          };
        });
        const invalid = this.bulkPreviewRows.filter((r) => !r._valid);
        this.bulkInvalidCount = invalid.length;
        this.bulkHasInvalidRows = invalid.length > 0;
      } catch {
        this.alert.error('Unable to read Excel file');
        this.bulkPreviewRows = [];
      }
    };
    reader.onerror = () => this.alert.error('Unable to read file');
    reader.readAsBinaryString(file);
  }

  confirmBulkUpload() {
    if (
      this.bulkUploading ||
      !this.bulkPreviewRows.length ||
      this.bulkHasInvalidRows
    )
      return;
    const students = this.bulkPreviewRows.map((r) => r._raw);
    this.bulkUploading = true;
    this.commonApi
      .fetchData(
        { tenantId: this.tenantId, userId: this.userId, students },
        'student',
        'bulk-update',
      )
      .subscribe({
        next: (res: any) => {
          this.bulkUploading = false;
          if (res?.status) {
            const d = res.data || {};
            this.alert.success(
              `Bulk update: ${d.successCount || 0} success, ${d.failedCount || 0} failed`,
            );
            this.showBulkUpload = false;
            this.resetBulkUpload();
          } else {
            this.alert.error(res?.message || 'Bulk update failed');
          }
        },
        error: (err: any) => {
          this.bulkUploading = false;
          this.alert.error(err?.error?.message || 'Bulk update failed');
        },
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ZIP PHOTO UPLOAD  (replaces old multi-file upload)
  // ══════════════════════════════════════════════════════════════════════════

  resetImageUpload() {
    this.zipFile = null;
    this.zipUploadResult = null;
  }

  onZipSelected(ev: any) {
    if (this.imageUploading) return;
    const file: File = ev?.target?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      this.alert.error('Please upload a .zip file');
      (ev.target as HTMLInputElement).value = '';
      return;
    }
    this.zipFile = file;
    this.zipUploadResult = null;
  }

  confirmZipUpload() {
    if (this.imageUploading || !this.zipFile) return;
    const formData = new FormData();
    formData.append('entiId', this.tenantId);
    formData.append('userId', this.userId);
    formData.append('zip', this.zipFile, this.zipFile.name);
    this.imageUploading = true;
    this.commonApi
      .uploadImage(formData, 'student', 'zip-image-upload')
      .subscribe({
        next: (res: any) => {
          this.imageUploading = false;
          if (res?.status) {
            this.zipUploadResult = res.data || {};
            const d = this.zipUploadResult;
            this.alert.success(
              `ZIP upload: ${d.successCount || 0} uploaded, ${d.failedCount || 0} failed`,
            );
          } else {
            this.alert.error(res?.message || 'Upload failed');
          }
        },
        error: (err: any) => {
          this.imageUploading = false;
          this.alert.error(err?.error?.message || 'Upload failed');
        },
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // IMPORT CALLBACKS
  // ══════════════════════════════════════════════════════════════════════════
  onRpaImported(): void {
    /* optionally refresh list */
  }
  onBoardExamImported(): void {
    /* optionally refresh list */
  }
  onAlumniImported(): void {
    /* optionally refresh list */
  }
}
