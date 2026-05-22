// import { Component, OnInit } from '@angular/core';
// import { Router } from '@angular/router';
// import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
// import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
// import { AlertService } from '../../../../service/alert/alert.service';

// type AdmissionStatus =
//   | 'draft'
//   | 'submitted'
//   | 'ack_generated'
//   | 'approval_sent'
//   | 'confirmed';
// type ListStatusFilter = 'all' | 'approved' | 'rejected' | 'waiting';

// @Component({
//   selector: 'app-list',
//   standalone: false,
//   templateUrl: './list.component.html',
//   styleUrl: './list.component.scss',
// })
// export class ListComponent implements OnInit {
//   admissions = []
//   loading = false;
//   searchRegNo = '';
//   totalRecords = 0;
//   pageSize = 10;
//   searchText = '';
//   statusFilter = 'all';
//   statusFilterOptions = [
//     { label: 'All', value: 'all' },
//     { label: 'Approved', value: 'approved' },
//     { label: 'Rejected', value: 'rejected' },
//     { label: 'Waiting for approval', value: 'waiting' }
//   ];
//   columns = [
//     { key: 'regNo', label: 'Reg No', sortable: false },
//     { key: 'name', label: 'Student', sortable: false },
//     { key: 'admissionNo', label: 'Admission No', sortable: false },
//     { key: 'programName', label: 'Program', sortable: false },
//     { key: 'centerName', label: 'Centre', sortable: false },
//     { key: 'finalFee', label: 'Final Fee', sortable: false },
//     { key: 'status', label: 'Status', sortable: false },
//   ];
//   actions = [
//     {
//       type: 'icon',
//       icon: 'fa-regular fa-eye',
//       tooltip: 'View',
//       color: '#2563EB',
//       callback: (row: any) => this.view(row.id),
//     },
//   ];

//   constructor(
//     private router: Router,
//     private breadcrumb: BredcrumpService,
//     private api: CommonapiService,
//     private alert: AlertService
//   ) {
//     this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Admissions' }]);
//   }

//   ngOnInit(): void {}

//   onStatusChange(): void {
//   }

//   onStatusFilterChange(value: string) {
//     this.statusFilter = value;
//     this.fetchTableData({
//       page: 1,
//       pageSize: this.pageSize,
//       search: this.searchText
//     });
//   }

//   onTable(event: any) {
//     this.pageSize = event.pageSize;

//     localStorage.setItem('pageSize', this.pageSize.toString());

//     this.fetchTableData(event);
//   }

//   fetchTableData(params: {
//     page: number;
//     pageSize: number;
//     search?: string;
//     sortKey?: string;
//     sortDirection?: string;
//   }) {
//     this.loading = true;
//     let sortParam = '';
//     if (params.sortKey) {
//       sortParam =
//         params.sortDirection === 'desc'
//           ? `-${params.sortKey}`
//           : params.sortKey;
//     }
//     const query: any = {
//       page: params.page,
//       limit: params.pageSize
//     };
//     if (sortParam) query.sort = sortParam;
//     if (params.search) query.search = params.search;
//     if (this.statusFilter && this.statusFilter !== 'all') {
//       query.status = this.statusFilter;
//     }
//     const queryString = Object.keys(query)
//       .map(
//         (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`
//       )
//       .join('&');

//     const body = {
//       entiId: localStorage.getItem('tenantId')
//     };
//     this.api.fetchData(body, 'admi', `list?${queryString}`).subscribe({
//       next: (res: any) => {
//         this.loading = false;
//         this.totalRecords = res.data?.total || 0;

//         const raw =
//           Array.isArray(res.data)
//             ? res.data
//             : res.data?.rows || res.data?.items || [];

//         this.admissions = raw.map((a: any) => ({
//           id: a.admissionId || a._id || a.id,
//           regNo: a.registrationNumber || a.studentRegNo || a.regNo || '',
//           admissionNo: a.admissionNo,
//           name: a?.student?.name || '',
//           programName: a.programName || '',
//           centerName: a.centerName || '',
//           finalFee: a?.fee?.finalFee ?? 0,
//           status: this.mapDisplayStatus(
//             (a?.workflow?.stage ||
//               a.status ||
//               a.admissionStatus ||
//               'draft') as AdmissionStatus
//           )
//         }));
//       },
//       error: (err) => {
//         this.loading = false;
//         this.alert.error('Error loading admissions');
//       }
//     });
//   }

//   newAdmission(): void {
//     this.router.navigate(['/app/admissions/new']);
//   }

//   view(id: string): void {
//     if (!id) return;
//     this.router.navigate(['/app/admissions/view', id]);
//   }

//   edit(id: string): void {
//     if (!id) return;
//     console.log('edit', id);
//   }
// }

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';

type AdmissionStatus =
  | 'draft'
  | 'submitted'
  | 'ack_generated'
  | 'approval_sent'
  | 'confirmed';

// CHANGE 2: added 'underreview' to the filter type
type ListStatusFilter =
  | 'all'
  | 'approved'
  | 'rejected'
  | 'waiting'
  | 'underreview';

@Component({
  selector: 'app-list',
  standalone: false,
  templateUrl: './list.component.html',
  styleUrl: './list.component.scss',
})
export class ListComponent implements OnInit {
  admissions: any[] = [];
  loading = false;
  searchRegNo = '';
  totalRecords = 0;

  pageSize = 10;
  searchText = '';
  statusFilter = 'all';

  // CHANGE 2: added "Under Review" option
  statusFilterOptions = [
    { label: 'All', value: 'all' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Waiting for approval', value: 'waiting' },
    { label: 'Under Review', value: 'underreview' }, // <-- NEW
  ];

  columns = [
    { key: 'regNo', label: 'Reg No', sortable: false },
    { key: 'name', label: 'Student', sortable: false },
    { key: 'admissionNo', label: 'Admission No', sortable: false },
    { key: 'programName', label: 'Program', sortable: false },
    { key: 'centerName', label: 'Centre', sortable: false },
    { key: 'finalFee', label: 'Final Fee', sortable: false },
    { key: 'status', label: 'Status', sortable: false },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View',
      color: '#2563EB',
      callback: (row: any) => this.view(row.id),
    },
  ];

  constructor(
    private router: Router,
    private breadcrumb: BredcrumpService,
    private api: CommonapiService,
    private alert: AlertService,
  ) {
    this.breadcrumb.set([{ label: 'Admissions & Fees' }, { label: 'Admission' }, { label: 'Search Enrollment'}]);
  }

  ngOnInit(): void {}

  onStatusChange(): void {}

  onStatusFilterChange(value: string) {
    this.statusFilter = value;
    this.fetchTableData({
      page: 1,
      pageSize: this.pageSize,
      search: this.searchText,
    });
  }

  onTable(event: any) {
    this.pageSize = event.pageSize;
    localStorage.setItem('pageSize', this.pageSize.toString());
    this.fetchTableData(event);
  }

  fetchTableData(params: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: string;
  }) {
    this.loading = true;

    let sortParam = '';
    if (params.sortKey) {
      sortParam =
        params.sortDirection === 'desc' ? `-${params.sortKey}` : params.sortKey;
    }

    const query: any = { page: params.page, limit: params.pageSize };
    if (sortParam) query.sort = sortParam;
    if (params.search) query.search = params.search;

    // CHANGE 2: map 'underreview' filter to query param
    if (this.statusFilter && this.statusFilter !== 'all') {
      query.status = this.statusFilter;
    }

    const queryString = Object.keys(query)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
      .join('&');

    const body = { entiId: localStorage.getItem('tenantId') };

    this.api.fetchData(body, 'admi', `list?${queryString}`).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.totalRecords = res.data?.total || 0;

        const raw = Array.isArray(res.data)
          ? res.data
          : res.data?.rows || res.data?.items || [];

        this.admissions = raw.map((a: any) => ({
          id: a.admissionId || a._id || a.id,
          regNo: a.registrationNumber || a.studentRegNo || a.regNo || '',
          admissionNo: a.admissionNo,
          name: a?.student?.name || '',
          programName: a.programName || '',
          centerName: a.centerName || '',
          finalFee: a?.fee?.finalFee ?? 0,
          status: this.mapDisplayStatus(
            (a?.workflow?.stage ||
              a.status ||
              a.admissionStatus ||
              'draft') as AdmissionStatus,
          ),
        }));
      },
      error: () => {
        this.loading = false;
        this.alert.error('Error loading admissions');
      },
    });
  }

  private mapDisplayStatus(stage: string): string {
    const s = String(stage || '').toUpperCase();
    switch (s) {
      case 'CONFIRMED':
        return 'Approved';
      case 'APPROVAL_SENT':
        return 'Waiting for Approval';
      case 'UNDER_REVIEW':
        return 'On Hold';
      case 'REJECTED':
        return 'Rejected';
      case 'PAYMENTS_SUBMITTED':
      case 'FEE_CALC_GENERATED':
        return 'Payments Submitted';
      case 'DRAFT':
        return 'Draft';
      default:
        return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  newAdmission(): void {
    this.router.navigate(['/app/admissions/new']);
  }

  view(id: string): void {
    if (!id) return;
    this.router.navigate(['/app/admissions/view', id]);
  }

  edit(id: string): void {
    if (!id) return;
    this.router.navigate(['/app/admissions/edit', id]);
  }
}
