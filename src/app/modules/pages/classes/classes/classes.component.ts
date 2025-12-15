import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

type ClassStatus = 'scheduled' | 'completed' | 'cancelled';

interface ClassRow {
  id: number;
  programId: number;
  programName: string;
  batchId: number;
  batchName: string;
  subjectId: number;
  subjectName: string;
  facultyId: number;
  facultyName: string;
  classDate: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  room: string | null;
  status: ClassStatus;
  isActive: boolean;
  notes?: string | null;
}

@Component({
  selector: 'app-classes',
  standalone: false,
  templateUrl: './classes.component.html',
  styleUrl: './classes.component.scss',
})
export class ClassesComponent implements OnInit {
  classForm!: FormGroup;
  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingId: number | null = null;

  // delete modal
  deleteModalVisible = false;
  deleteTarget: ClassRow | null = null;
  deleteMessage = '';

  // dummy masters
  programs = [
    { id: 1, name: 'JEE 2026' },
    { id: 2, name: 'NEET 2025' },
  ];
  batches = [
    { id: 1, name: 'JEE 2026 - Phase 1' },
    { id: 2, name: 'NEET 2025 - Regular' },
  ];
  subjects = [
    { id: 1, name: 'Physics' },
    { id: 2, name: 'Chemistry' },
    { id: 3, name: 'Maths' },
    { id: 4, name: 'Biology' },
  ];
  faculties = [
    { id: 1, name: 'Sivakumar' },
    { id: 2, name: 'Priya R' },
    { id: 3, name: 'Vignesh' },
  ];

  programOptions = this.programs.map((x) => ({ label: x.name, value: x.id }));
  batchOptions = this.batches.map((x) => ({ label: x.name, value: x.id }));
  subjectOptions = this.subjects.map((x) => ({ label: x.name, value: x.id }));
  facultyOptions = this.faculties.map((x) => ({ label: x.name, value: x.id }));

  classData: ClassRow[] = [
    {
      id: 1,
      programId: 1,
      programName: 'JEE 2026',
      batchId: 1,
      batchName: 'JEE 2026 - Phase 1',
      subjectId: 1,
      subjectName: 'Physics',
      facultyId: 1,
      facultyName: 'Sivakumar',
      classDate: '2025-12-15',
      startTime: '17:00',
      endTime: '18:30',
      room: 'Hall A',
      status: 'scheduled',
      isActive: true,
      notes: null,
    },
  ];

  columns = [
    { key: 'classDate', label: 'Date', sortable: true, date: true },
    { key: 'startTime', label: 'Start', sortable: true },
    { key: 'endTime', label: 'End', sortable: true },
    { key: 'batchName', label: 'Batch', sortable: true },
    { key: 'subjectName', label: 'Subject', sortable: true },
    { key: 'facultyName', label: 'Faculty', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'isActive', label: 'Active', sortable: false },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      color: '#6B7280',
      callback: (row: ClassRow) => this.edit(row),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      color: '#6B7280',
      hoverColor: '#D42B2B',
      callback: (row: ClassRow) => this.openDelete(row),
    },
  ];

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Class Management' },
    ]);
  }

  ngOnInit(): void {
    this.classForm = this.fb.group({
      programId: [null, Validators.required],
      batchId: [null, Validators.required],
      subjectId: [null, Validators.required],
      facultyId: [null, Validators.required],
      classDate: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      room: [''],
      status: ['scheduled', Validators.required],
      isActive: [true],
      notes: [''],
    });
  }

  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.classForm.reset({
      programId: null,
      batchId: null,
      subjectId: null,
      facultyId: null,
      classDate: '',
      startTime: '',
      endTime: '',
      room: '',
      status: 'scheduled',
      isActive: true,
      notes: '',
    });
    this.showForm = true;
    document.body.classList.add('modal-open');
  }

  edit(row: ClassRow): void {
    this.formMode = 'edit';
    this.editingId = row.id;

    this.classForm.reset({
      programId: row.programId,
      batchId: row.batchId,
      subjectId: row.subjectId,
      facultyId: row.facultyId,
      classDate: row.classDate,
      startTime: row.startTime,
      endTime: row.endTime,
      room: row.room || '',
      status: row.status,
      isActive: row.isActive,
      notes: row.notes || '',
    });

    this.showForm = true;
    document.body.classList.add('modal-open');
  }

  cancel(): void {
    this.showForm = false;
    document.body.classList.remove('modal-open');
  }

  save(): void {
    if (this.classForm.invalid) {
      this.classForm.markAllAsTouched();
      return;
    }

    const v = this.classForm.value;

    const program = this.programs.find((x) => x.id === v.programId);
    const batch = this.batches.find((x) => x.id === v.batchId);
    const subject = this.subjects.find((x) => x.id === v.subjectId);
    const faculty = this.faculties.find((x) => x.id === v.facultyId);

    const payload: ClassRow = {
      id: this.editingId ?? 0,
      programId: v.programId,
      programName: program?.name || '',
      batchId: v.batchId,
      batchName: batch?.name || '',
      subjectId: v.subjectId,
      subjectName: subject?.name || '',
      facultyId: v.facultyId,
      facultyName: faculty?.name || '',
      classDate: v.classDate,
      startTime: v.startTime,
      endTime: v.endTime,
      room: v.room || null,
      status: v.status,
      isActive: !!v.isActive,
      notes: v.notes || null,
    };

    if (this.formMode === 'create') {
      const newId = (this.classData[this.classData.length - 1]?.id || 0) + 1;
      this.classData = [...this.classData, { ...payload, id: newId }];
      this.alert.success('Class created successfully');
    } else if (this.editingId != null) {
      this.classData = this.classData.map((x: ClassRow) =>
        x.id === this.editingId ? { ...payload, id: this.editingId! } : x
      );
      this.alert.success('Class updated successfully');
    }

    this.cancel();
  }

  openDelete(row: ClassRow): void {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete class on ${row.classDate} (${row.batchName} - ${row.subjectName})?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean): void {
    this.deleteModalVisible = false;
    if (confirmed && this.deleteTarget) {
      this.classData = this.classData.filter(
        (x) => x.id !== this.deleteTarget!.id
      );
      this.alert.success('Class deleted');
    }
    this.deleteTarget = null;
  }
}
