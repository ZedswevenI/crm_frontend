import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { forkJoin } from 'rxjs';

type ViewMode = 'list' | 'grid';

const safeTrim = (v: any) =>
  v === undefined || v === null ? '' : String(v).trim();

@Component({
  selector: 'app-students',
  standalone: false,
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
export class StudentsComponent implements OnInit {
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
}
