import { Component, OnInit, Pipe, PipeTransform } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

@Component({
  selector: 'app-phaselist',
  standalone: false,
  templateUrl: './phaselist.component.html',
  styleUrl: './phaselist.component.scss'
})
export class PhaselistComponent implements OnInit {

  tenantId: string = '';
  isProceed = false;
  loading = false;

  selectedPhase: any = null;
  phaseForm!: FormGroup;

  class_options = [
    { label: '6th', value: 6 },
    { label: '7th', value: 7 },
    { label: '8th', value: 8 },
    { label: '9th', value: 9 },
    { label: '10th', value: 10 },
    { label: '11th', value: 11 },
    { label: '12th', value: 12 },
    { label: '12th Pass', value: 13 }
  ];

  subject_options: any[] = [];

  dataArray: any[] = [];
  totalRecords = 0;

  columnsArray = [
    { key: 'phaseName', label: 'Phase Name', sortable: true },
    { key: 'sortOrder', label: 'Sort Order', sortable: true },
    { key: 'topicCount', label: 'No. of Topics', sortable: true },
    { key: 'totalHours', label: 'Total Est. Hours', sortable: false },
  ];



  actions = [
    {
      type: 'icon',
      icon: 'fa fa-eye',
      tooltip: 'View',
      color: '#6B7280',
      hoverColor: '#0066FF',
      callback: (row: any) => this.onView(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-pen-to-square',
      tooltip: 'Edit',
      color: '#6B7280',
      hoverColor: '#0066FF',
      callback: (row: any) => this.onEdit(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-trash',
      tooltip: 'Delete',
      color: '#6B7280',
      hoverColor: '#0066FF',
      callback: (row: any) => this.onDelte(row),
    },
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private commonApi: CommonapiService,
    private alert: AlertService,
    private breadcrump: BredcrumpService
  ) {
    this.tenantId = localStorage.getItem('tenantId') || '';
    this.breadcrump.set([{ label: 'Phase Plan', link: '/app/phase' }]);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadSubjects();
  }

  private initForm(): void {
    this.phaseForm = this.fb.group({
      class: [null, Validators.required],
      subject: ['', Validators.required]
    });
  }

  private loadSubjects(): void {
    const body = { entiId: this.tenantId };
    this.commonApi.fetchData(body, 'ims/subject', 'list?list=full')
      .subscribe({
        next: (res: any) => { this.subject_options = res?.data || []; },
        error: () => this.alert.error('Error loading subjects')
      });
  }

  onProceed(): void {
    if (this.phaseForm.invalid) return;
    const { class: classNo, subject: subjectId } = this.phaseForm.value;
    this.loading = true;
    this.isProceed = false;
    const body = { tenantId: this.tenantId };
    this.commonApi.fetchData(body, 'batch/phase', `list?classNo=${classNo}&subjectId=${subjectId}`)
      .subscribe({
        next: (res: any) => {
          const raw: any[] = res?.data || [];
          this.dataArray = raw.map((p: any) => ({
            ...p,
            topicCount: p.topics?.length || 0,
            totalHours: p.topics?.reduce((sum: number, t: any) => sum + (t.estHours || 0), 0) || 0
          }));

          this.totalRecords = res?.count || this.dataArray.length;
          this.isProceed = true;
          this.loading = false;
        },
        error: () => {
          this.alert.error('Error loading phase plans');
          this.loading = false;
        }
      });
  }

  onEdit(row: any) {
    this.router.navigate(['/app/phase/create'], { state: { phase: row } });
  }

  onView(row: any) {
    this.selectedPhase = {
      ...row,
      topics: [...(row.topics || [])].sort((a, b) => a.sortOrder - b.sortOrder)
    };
    const modalEl = document.getElementById('phaseViewModal');
    if (modalEl) {
      const modal = new (window as any).bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  onDelte(row: any) {
    if (!confirm(`Delete "${row.phaseName}"?`)) return;
    const body = { tenantId: this.tenantId, phaseId: row.phaseId };
    this.commonApi.fetchData(body, 'batch/phase', 'delete')
      .subscribe({
        next: (res: any) => {
          if (res?.status) {
            this.alert.success('Phase plan deleted');
            this.dataArray = this.dataArray.filter(d => d.phaseId !== row.phaseId);
            this.totalRecords = this.dataArray.length;
          }
        },
        error: () => this.alert.error('Error deleting phase plan')
      });
  }

  getTotalHours(): number {
    return (this.selectedPhase?.topics || [])
      .reduce((sum: number, t: any) => sum + (t.estHours || 0), 0);
  }

  getAvgHours(): string {
    const topics = this.selectedPhase?.topics || [];
    if (topics.length === 0) return '0';
    const avg = this.getTotalHours() / topics.length;
    return avg.toFixed(1);
  }
}
