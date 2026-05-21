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
type ListStatusFilter = 'all' | 'approved' | 'rejected' | 'waiting';

@Component({
  selector: 'app-admission-wait',
  standalone: false,
  templateUrl: './admission-wait.component.html',
  styleUrl: './admission-wait.component.scss',
})
export class AdmissionWaitComponent {
  admissions: any[] = [];
  loading = false;
  searchRegNo = '';
  totalRecords = 0;
  pageSize = 5;
  searchText = '';
  statusFilter = 'waiting';
  statusFilterOptions = [
    { label: 'All', value: 'all' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Waiting for approval', value: 'waiting' },
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
      icon: 'fa-solid fa-check-circle',
      tooltip: 'Approve Queue',
      color: '#16a34a',
      callback: (row: any) =>
        this.router.navigate(['/app/admissions/approve', row.id]),
    },
  ];

  constructor(
    private router: Router,
    private breadcrumb: BredcrumpService,
    private api: CommonapiService,
    private alert: AlertService,
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Admissions' }]);
  }

  ngOnInit(): void {
    // this.loadAdmissions();
  }

  onStatusChange(): void {
    // this.loadAdmissions();
  }

  onStatusFilterChange(value: string) {
    this.statusFilter = value;

    // reload table
    this.fetchTableData({
      page: 1,
      pageSize: this.pageSize,
      search: this.searchText,
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

    let route = `list?page=${params.page}&limit=${params.pageSize}`;

    if (this.statusFilter && this.statusFilter !== 'all') {
      route += `&status=${encodeURIComponent(this.statusFilter)}`;
    }

    if (params.search) {
      route += `&search=${encodeURIComponent(params.search.trim())}`;
    }

    if (params.sortKey) {
      const sort =
        params.sortDirection === 'desc' ? `-${params.sortKey}` : params.sortKey;
      route += `&sort=${encodeURIComponent(sort)}`;
    }

    const body = {
      entiId: localStorage.getItem('tenantId'),
    };

    this.api.fetchData(body, 'admi', route).subscribe({
      next: (res: any) => {
        this.loading = false;

        if (!res?.status) {
          this.alert.error(res?.message || 'Failed to load admissions');
          this.admissions = [];
          return;
        }

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
      error: (err) => {
        this.loading = false;
        this.alert.error('Error loading admissions');
      },
    });
  }

  private mapDisplayStatus(stage: string): string {
    const s = String(stage || '').toLowerCase();
    if (s === 'confirmed') return 'Approved';
    if (s === 'approval_sent') return 'Waiting for Approval';
    if (s === 'ack_generated' || s === 'submitted') return 'Created';
    if (!s) return 'Draft';
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
    console.log('edit', id);
  }
}
