import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { ProgramService } from '../../../../../service/admin/orgmasters/program.service';

@Component({
  selector: 'app-program',
  standalone: false,
  templateUrl: './program.component.html',
  styleUrl: './program.component.scss'
})
export class ProgramComponent implements OnInit {

  programForm!: FormGroup;

  totalRecords = 10;

  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingRecId: string | null = null;

  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  entiId: any;

  // ✅ YOUR COLUMN CONFIG (UNCHANGED)
  columns = [
    { key: 'name', label: 'Program Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'stream', label: 'Stream', sortable: true },
    { key: 'forStudents', label: 'For Students', sortable: false },
    { key: 'academicYear', label: 'Acad. Year', sortable: true },
    { key: 'classVenue', label: 'Venue', sortable: false },
    { key: 'hoursPerWeek', label: 'Hrs/Week', sortable: false },
    { key: 'isActive', label: 'Active', sortable: false }
  ];

  streamOptions = [
    { label: 'JEE', value: 'JEE' },
    { label: 'NEET', value: 'NEET' },
    { label: 'Foundation', value: 'Foundation' }
  ];

  durationOptions = [
    { label: '2 Years', value: '2 Years' },
    { label: '1 Year', value: '1 Year' },
    { label: 'Crash Course', value: 'Crash Course' }
  ];

  academicYearOptions = [
    { label: '2026-27', value: '2026-27' },
    { label: '2025-26', value: '2025-26' },
    { label: '2024-25', value: '2024-25' }
  ];

  studentBandOptions = [
    { label: 'Class 5', value: 'Class 5th' },
    { label: 'Class 6', value: 'Class 6th' },
    { label: 'Class 7', value: 'Class 7th' },
    { label: 'Class 8', value: 'Class 8th' },
    { label: 'Class 9', value: 'Class 9th' },
    { label: 'Class 10', value: 'Class 10th' },
    { label: 'Class 11', value: 'Class 11th' }
  ];


  programData: any[] = [];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      callback: (row: any) => this.edit(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      callback: (row: any) => this.openDelete(row)
    }
  ];

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private programService: ProgramService
  ) {
    this.entiId = localStorage.getItem('tenantId')
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Programs' }
    ]);
  }

  ngOnInit(): void {
    this.initForm();
  }

  // ---------------- FORM ----------------
  initForm() {
    this.programForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      stream: ['', Validators.required],
      duration: [null, Validators.required],   // ✅ FIXED
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

  // ---------------- LIST ----------------
  loadPrograms(event?: { page: number; pageSize: number; search?: string, sortKey?: string; sortDirection?: 'asc' | 'desc' }) {


    // console.log("Events ",event);

    this.programService.listPrograms(this.entiId, event?.page, event?.pageSize).subscribe({
      next: (res: any) => {
        this.totalRecords = res.count;
        this.programData = (res?.data || []).map((p: any) => {
          const option = p.options?.[0] || {};

          return {
            recId: p._id,

            // ✅ table keys
            name: p.programName,
            code: p.programCodes?.join(', '),
            stream: p.stream || '-',
            forStudents: `Class ${p.studyingClass}`,
            academicYear: p.academicYear,
            classVenue: option.classVenue,
            hoursPerWeek: option.hrsPerWeek,
            isActive: p.status === 'Active',

            // keep full row for edit
            _raw: p
          };
        });
      }
    });
  }

  // ---------------- ADD ----------------
  add() {
    this.formMode = 'create';
    this.editingRecId = null;
    this.programForm.reset({ isActive: true });
    this.showForm = true;
  }

  // ---------------- EDIT ----------------
  edit(row: any) {
    const p = row._raw;
    const option = p.options?.[0] || {};

    console.log("Edited val ", `Class ${p.studyingClass} (Going to ${p.goingToClass})`);


    this.formMode = 'edit';
    this.editingRecId = p._id;

    this.programForm.patchValue({
      name: p.programName,
      code: p.programCodes?.join(', '),
      stream: p.stream,
      academicYear: p.academicYear,
      duration: row.duration,
      forStudents: `Class ${p.studyingClass}`,
      version: option.version,
      classVenue: option.classVenue,
      hoursPerWeek: option.hrsPerWeek,
      classTimings: option.classTimings,
      commencementDate: option.commencementDate?.substring(0, 10),
      isActive: p.status === 'Active'
    });

    this.showForm = true;
  }

  // ---------------- SAVE ----------------
  save() {
    if (this.programForm.invalid) {
      this.programForm.markAllAsTouched();
      this.alert.error('Please fill all required fields');
      return;
    }

    const payload = this.buildPayload(
      this.programForm.value,
      this.editingRecId || ''
    );

    const apiCall =
      this.formMode === 'create'
        ? this.programService.createProgram(payload)
        : this.programService.updateProgram(payload);

    console.log("New data", payload);


    apiCall.subscribe({
      next: () => {
        this.alert.success(
          this.formMode === 'create'
            ? 'Program created successfully'
            : 'Program updated successfully'
        );
        this.showForm = false;
        this.loadPrograms();
      },
      error: () => this.alert.error('Operation failed')
    });
  }

  // ---------------- DELETE ----------------
  openDelete(row: any) {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete "${row.name}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;

    if (!confirmed || !this.deleteTarget) return;

    console.log("deeted ", this.deleteTarget);

    this.programService
      .deleteProgram(this.entiId, this.deleteTarget.recId)
      .subscribe({
        next: () => {
          this.alert.success('Program deleted successfully');
          this.loadPrograms();
        },
        error: () => this.alert.error('Delete failed')
      });

    this.deleteTarget = null;
  }

  cancel() {
    this.showForm = false;
  }

  // ---------------- PAYLOAD BUILDER ----------------
  private buildPayload(form: any, recId?: string) {
    const match = form.forStudents?.match(/Class\s(\d+).*?(\d+)/);

    return {
      entiId: this.entiId,
      ...(recId && { recId }),
      academicYear: form.academicYear,
      studyingClass: match ? `${match[1]}` : null,
      goingToClass: match ? `${match[2]}` : null,
      programName: form.name,
      programCodes: form.code
        .split(',')
        .map((c: string) => c.trim())
        .filter(Boolean),
      stream: form.stream,
      duration: form.duration,
      options: [
        {
          version: form.version,
          classVenue: form.classVenue,
          hrsPerWeek: Number(form.hoursPerWeek),
          classTimings: form.classTimings,
          commencementDate: form.commencementDate
            ? new Date(form.commencementDate).toISOString()
            : null,
          commencementNote: null,
          status: form.isActive ? 'Active' : 'Inactive',
        }
      ],

      status: form.isActive ? 'Active' : 'Inactive'
    };
  }


}
