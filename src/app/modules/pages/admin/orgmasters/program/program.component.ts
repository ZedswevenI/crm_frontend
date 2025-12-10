import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';

@Component({
  selector: 'app-program',
  standalone: false,
  templateUrl: './program.component.html',
  styleUrl: './program.component.scss'
})
export class ProgramComponent implements OnInit {
  programForm!: FormGroup;
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingId: number | null = null;

  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  // Table columns now aligned closer to CCD format
  columns = [
    { key: 'name',          label: 'Program Name',  sortable: true },
    { key: 'code',          label: 'Code',          sortable: true },
    { key: 'stream',        label: 'Stream',        sortable: true },
    { key: 'forStudents',   label: 'For Students',  sortable: false },
    { key: 'academicYear',  label: 'Acad. Year',    sortable: true },
    { key: 'classVenue',    label: 'Venue',         sortable: false },
    { key: 'hoursPerWeek',  label: 'Hrs/Week',      sortable: false },
    { key: 'isActive',      label: 'Active',        sortable: false }
  ];

  // Sample data shaped like the shared Excel CCD format
  programData: any[] = [
    {
      id: 1,
      name: 'Arise - One Year Foundation Program',
      code: 'C6053, M6053, U6053',
      stream: 'Foundation',
      duration: '1 Year',
      academicYear: '2026-27',
      forStudents: 'Class 5 (Going to 6th)',
      version: 'Special Sunday',
      classVenue: 'Suguna School, Gandhipuram',
      hoursPerWeek: 6,
      classTimings: '9:30 AM to 4:30 PM',
      commencementDate: '28-06-2026',
      isActive: true
    },
    {
      id: 2,
      name: 'Prodigy - 2 Year Classroom Program',
      code: 'C7053, M7053, U7053',
      stream: 'JEE',
      duration: '2 Years',
      academicYear: '2026-27',
      forStudents: 'Class 6 (Going to 7th)',
      version: 'Special Sunday',
      classVenue: 'Suguna School, Gandhipuram',
      hoursPerWeek: 6,
      classTimings: '9:30 AM to 4:30 PM',
      commencementDate: '28-06-2026',
      isActive: true
    }
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      color: '#6B7280',
      callback: (row: any) => this.edit(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      color: '#6B7280',
      hoverColor: '#D42B2B',
      callback: (row: any) => this.openDelete(row)
    }
  ];

  streamOptions = [
    { label: 'JEE',        value: 'JEE' },
    { label: 'NEET',       value: 'NEET' },
    { label: 'Foundation', value: 'Foundation' }
  ];

  durationOptions = [
    { label: '2 Years',      value: '2 Years' },
    { label: '1 Year',       value: '1 Year' },
    { label: 'Crash Course', value: 'Crash Course' }
  ];

  academicYearOptions = [
    { label: '2026-27', value: '2026-27' },
    { label: '2025-26', value: '2025-26' },
    { label: '2024-25', value: '2024-25' }
  ];

  studentBandOptions = [
    { label: 'Class 5 (Going to 6th)', value: 'Class 5 (Going to 6th)' },
    { label: 'Class 6 (Going to 7th)', value: 'Class 6 (Going to 7th)' },
    { label: 'Class 7 (Going to 8th)', value: 'Class 7 (Going to 8th)' },
    { label: 'Class 8 (Going to 9th)', value: 'Class 8 (Going to 9th)' },
    { label: 'Class 9 (Going to 10th)', value: 'Class 9 (Going to 10th)' },
    { label: 'Class 10 (Going to 11th)', value: 'Class 10 (Going to 11th)' }
  ];

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Programs' }
    ]);
  }

  ngOnInit(): void {
    this.programForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      stream: [null, Validators.required],
      duration: [null, Validators.required],
      academicYear: ['', Validators.required],
      forStudents: ['', Validators.required],
      version: ['', Validators.required],
      classVenue: ['', Validators.required],
      hoursPerWeek: [
        null,
        [Validators.required, Validators.min(1), Validators.max(40)]
      ],
      classTimings: ['', Validators.required],
      commencementDate: ['', Validators.required],
      isActive: [true]
    });
  }

  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.programForm.reset({
      name: '',
      code: '',
      stream: null,
      duration: null,
      academicYear: '',
      forStudents: '',
      version: '',
      classVenue: '',
      hoursPerWeek: null,
      classTimings: '',
      commencementDate: '',
      isActive: true
    });
    this.showForm = true;
  }

  edit(row: any): void {
    this.formMode = 'edit';
    this.editingId = row.id;

    // row already has all keys used in the form
    this.programForm.reset({
      name: row.name,
      code: row.code,
      stream: row.stream,
      duration: row.duration,
      academicYear: row.academicYear,
      forStudents: row.forStudents,
      version: row.version,
      classVenue: row.classVenue,
      hoursPerWeek: row.hoursPerWeek,
      classTimings: row.classTimings,
      commencementDate: row.commencementDate,
      isActive: row.isActive
    });

    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
  }

  save(): void {
    if (this.programForm.invalid) {
      this.programForm.markAllAsTouched();
      return;
    }

    const value = this.programForm.value;

    if (this.formMode === 'create') {
      const newId = (this.programData[this.programData.length - 1]?.id || 0) + 1;
      this.programData = [...this.programData, { id: newId, ...value }];
      this.alertService.success('Program created successfully');
    } else if (this.editingId != null) {
      this.programData = this.programData.map((p) =>
        p.id === this.editingId ? { ...p, ...value } : p
      );
      this.alertService.success('Program updated successfully');
    }

    this.showForm = false;
  }

  openDelete(row: any): void {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete program "${row.name}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean): void {
    this.deleteModalVisible = false;

    if (confirmed && this.deleteTarget) {
      this.programData = this.programData.filter(
        (p) => p.id !== this.deleteTarget.id
      );
      this.alertService.success('Program deleted');
    }

    this.deleteTarget = null;
  }
}
