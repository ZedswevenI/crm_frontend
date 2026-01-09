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
  selector: 'app-list',
  standalone: false,
  templateUrl: './list.component.html',
  styleUrl: './list.component.scss',
})
export class ListComponent implements OnInit {
  admissions: any[] = [];
  loading = false;
  searchRegNo = '';
  totalRecords=0;
  statusFilter: ListStatusFilter = 'all';
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
    private alert: AlertService
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Admissions' }]);
  }

  ngOnInit(): void {
    this.loadAdmissions();
  }

  onStatusChange(): void {
    this.loadAdmissions();
  }

  private loadAdmissions(regNo?: string): void {
    this.loading = true;
    const body: any = { entiId: localStorage.getItem('tenantId') };
    const search = (regNo ?? this.searchRegNo ?? '').trim();
    let route = 'list?page=1&limit=5';
    if (this.statusFilter && this.statusFilter !== 'all') {
      route += `&status=${encodeURIComponent(this.statusFilter)}`;
    } else {
    }
    if (search) {
      this.searchRegNo = search;
      route += `&search=${encodeURIComponent(search)}`;
    }
    this.api.fetchData(body, 'admi', route).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (!res?.status) {
          this.alert.error(res?.message || 'Failed to load admissions');
          this.admissions = [];
          return;
        }
        this.totalRecords = res.data.total
        const raw = Array.isArray(res.data)
          ? res.data
          : res.data?.rows || res.data?.items || res.data?.rows || [];
        const list = Array.isArray(raw) ? raw : [];
        this.admissions = list.map((a: any) => ({
          id: a.admissionId || a._id || a.id,
          regNo: a.registrationNumber || a.studentRegNo || a.regNo || '',
          admissionNo: a.admissionNo,
          name: a?.student?.name || '',
          programName: a.programName || '',
          centerName: a.centerName || '',
          finalFee: a.fee.finalFee ?? 0,
          status: this.mapDisplayStatus(
            (a?.workflow?.stage ||
              a.status ||
              a.admissionStatus ||
              'draft') as AdmissionStatus
          ),
        }));
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading admissions', err);
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

  onSearch(value: string): void {
    this.searchRegNo = (value || '').trim();
    this.loadAdmissions(this.searchRegNo);
  }

  clearSearch(input: HTMLInputElement): void {
    this.searchRegNo = '';
    if (input) input.value = '';
    this.loadAdmissions('');
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
