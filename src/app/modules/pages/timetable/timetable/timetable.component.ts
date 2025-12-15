import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { Router } from '@angular/router'
@Component({
  selector: 'app-timetable',
  standalone: false,
  templateUrl: './timetable.component.html',
  styleUrl: './timetable.component.scss',
})
export class TimetableComponent implements OnInit {
  showUpload = false;
  uploadForm!: FormGroup;
  file: File | null = null;

  timetables = [
    {
      id : 'table',
      program: 'JEE 2026',
      batch: 'Phase 1',
      centre: 'Gandhipuram',
      validFrom: '01-Jun-2025',
      validTo: '31-Mar-2026',
      status: 'Draft',
    },
  ];

  columns = [
    { key: 'program', label: 'Program', sortable: true },
    { key: 'batch', label: 'Batch', sortable: true },
    { key: 'centre', label: 'Centre', sortable: true },
    { key: 'validFrom', label: 'From', sortable: true, date: true },
    { key: 'validTo', label: 'To', sortable: true, date: true },
    { key: 'status', label: 'Status', sortable: false },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View',
      callback: (row: any) => this.view(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-upload',
      tooltip: 'Upload New Version',
      callback: (row: any) => this.openUpload(row),
    },
  ];

  programOptions = [{ label: 'JEE 2026', value: 1 }];
  batchOptions = [{ label: 'Phase 1', value: 1 }];
  centreOptions = [{ label: 'Gandhipuram', value: 1 }];

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private router : Router
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Timetable' }]);
  }

  ngOnInit(): void {
    this.uploadForm = this.fb.group({
      programId: [null, Validators.required],
      batchId: [null, Validators.required],
      centreId: [null, Validators.required],
      validFrom: ['', Validators.required],
      validTo: ['', Validators.required],
    });
  }

  openUpload(row?: any): void {
    this.showUpload = true;
    document.body.classList.add('modal-open');
  }

  closeUpload(): void {
    this.showUpload = false;
    this.file = null;
    document.body.classList.remove('modal-open');
  }

  onFileChange(e: any): void {
    const f = e.target.files?.[0];
    if (!f || !f.name.endsWith('.xlsx')) {
      this.alert.error('Only Excel files allowed');
      return;
    }
    this.file = f;
  }

  upload(): void {
    if (!this.file) return;

    // TODO: API call → upload + validate + preview
    this.alert.success('Timetable uploaded & validated (dummy).');
    this.closeUpload();
  }

  view(row: any): void {
    this.router.navigate(['/app/timetable/view', row.id])
  }
}
