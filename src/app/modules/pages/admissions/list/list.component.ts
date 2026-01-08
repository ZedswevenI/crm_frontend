import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';

type AdmissionStatus = 'draft' | 'submitted' | 'ack_generated' | 'approval_sent' | 'confirmed';

@Component({
  selector: 'app-list',
  standalone: false,
  templateUrl: './list.component.html',
  styleUrl: './list.component.scss',
})
export class ListComponent implements OnInit {
  admissions: any[] = [];
  loading = false;

  // search text for registrationNumber (query param)
  searchRegNo = '';

  // ✅ list-table columns
  columns = [
    { key: 'regNo', label: 'Reg No', sortable: true },
    { key: 'name', label: 'Student', sortable: true },
    { key: 'admissionNo', label: 'Admission No', sortable: true },
    { key: 'programName', label: 'Program', sortable: true },
    { key: 'centerName', label: 'Centre', sortable: true },
    { key: 'finalFee', label: 'Final Fee', sortable: true },
    { key: 'status', label: 'Status', sortable: false },
  ];

  // ✅ actions like your batch screen
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

  private loadAdmissions(regNo?: string): void {
    this.loading = true;
    const body: any = { "entiId": localStorage.getItem('tenantId')};
    const search = (regNo ?? this.searchRegNo ?? '').trim();
    let route = 'list?page=1&limit=25';
    if (search) {
      this.searchRegNo = search;
      route += `&registrationNumber=${encodeURIComponent(search)}`;
    }
    this.api.fetchData(body, 'admi', route).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (!res?.status) {
          this.alert.error(res?.message || 'Failed to load admissions');
          this.admissions = [];
          return;
        }
        const raw =
          Array.isArray(res.data) ?
            res.data :
            res.data?.items || res.data?.rows || [];
        const list = Array.isArray(raw) ? raw : [];
        this.admissions = list.map((a: any) => ({
          id: a.admissionId || a._id || a.id,
          regNo:
            a.registrationNumber ||
            a.studentRegNo ||
            a.regNo ||
            '',
          admissionNo: a.admissionNo,
          name: a.student.name || '',
          programName: a.programName || '',
          centerName: a.centerName || '',
          finalFee: a.finalFee ?? a.totalFee ?? 0,
          status: (a.status || a.admissionStatus || 'draft') as AdmissionStatus,
        }));
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading admissions', err);
        this.alert.error('Error loading admissions');
      },
    });
  }

  onSearch(value: string): void {
    this.searchRegNo = (value || '').trim();
    this.loadAdmissions(this.searchRegNo);
  }

  clearSearch(input: HTMLInputElement): void {
    this.searchRegNo = '';
    if (input) {
      input.value = '';
    }
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
