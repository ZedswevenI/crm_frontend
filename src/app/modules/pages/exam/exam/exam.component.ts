import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { Route, Router } from '@angular/router';

type ExamType = 'weekly' | 'unit' | 'model' | 'scholarship' | 'custom';
type ExamMode = 'offline' | 'online';
type ExamStatus = 'draft' | 'published';

interface ExamRow {
  id: string;
  name: string;
  code: string;

  programId: number;
  programName: string;

  batchId: number;
  batchName: string;

  examType: ExamType;
  mode: ExamMode;

  startAt: string; // datetime-local string
  endAt: string;

  status: ExamStatus;
  isActive: boolean;
  remarks?: string | null;
}

@Component({
  selector: 'app-exam',
  standalone: false,
  templateUrl: './exam.component.html',
  styleUrl: './exam.component.scss',
})
export class ExamComponent implements OnInit {
  search = '';

  // dummy master data
  programs = [
    { id: 1, name: 'JEE 2 Year Classroom' },
    { id: 2, name: 'NEET 1 Year Repeaters' },
  ];

  batches = [
    { id: 1, programId: 1, name: 'JEE 2026 - Phase 1' },
    { id: 2, programId: 2, name: 'NEET 2025 - Regular' },
  ];

  programOptions = this.programs.map((p) => ({ label: p.name, value: p.id }));
  batchOptions = this.batches.map((b) => ({ label: b.name, value: b.id }));

  data: ExamRow[] = [
    {
      id: 'EX-001',
      name: 'Unit Test - Physics 01',
      code: 'UT-PHY-01',
      programId: 1,
      programName: 'JEE 2 Year Classroom',
      batchId: 1,
      batchName: 'JEE 2026 - Phase 1',
      examType: 'unit',
      mode: 'offline',
      startAt: this.nowLocalPlus(1),
      endAt: this.nowLocalPlus(2),
      status: 'draft',
      isActive: true,
      remarks: null,
    },
  ];

  filtered: ExamRow[] = [];

  columns = [
    { key: 'name', label: 'Exam', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'batchName', label: 'Batch', sortable: true },
    { key: 'examType', label: 'Type', sortable: true },
    { key: 'mode', label: 'Mode', sortable: true },
    { key: 'startAt', label: 'Start', sortable: true, date: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'isActive', label: 'Active', sortable: false },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-solid fa-pen-ruler',
      tooltip: 'Marks Entry',
      callback: (row: ExamRow) => this.openMarksEntry(row),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      callback: (row: ExamRow) => this.edit(row),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      hoverColor: '#D42B2B',
      callback: (row: ExamRow) => this.openDelete(row),
    },
  ];

  showForm = false;
  mode: 'create' | 'edit' = 'create';
  editingId: string | null = null;

  deleteModalVisible = false;
  deleteTarget: ExamRow | null = null;
  deleteMessage = '';

  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private router : Router
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Exams' },
      { label: 'Exam Setup' },
    ]);
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      programId: [null, Validators.required],
      batchId: [null, Validators.required],
      examType: ['unit' as ExamType, Validators.required],
      mode: ['offline' as ExamMode, Validators.required],
      startAt: ['', Validators.required],
      endAt: ['', Validators.required],
      status: ['draft' as ExamStatus, Validators.required],
      isActive: [true],
      remarks: [''],
    });

    this.applyFilter();
  }

  f(name: string) {
    return this.form.get(name)!;
  }

  reload(): void {
    this.applyFilter();
  }

  applyFilter(): void {
    const q = (this.search || '').trim().toLowerCase();
    if (!q) {
      this.filtered = [...this.data];
      return;
    }
    this.filtered = this.data.filter((x) => {
      const hay =
        `${x.name} ${x.code} ${x.batchName} ${x.programName}`.toLowerCase();
      return hay.includes(q);
    });
  }

  add(): void {
    this.mode = 'create';
    this.editingId = null;

    this.form.reset({
      name: '',
      code: '',
      programId: null,
      batchId: null,
      examType: 'unit',
      mode: 'offline',
      startAt: this.nowLocalPlus(1),
      endAt: this.nowLocalPlus(2),
      status: 'draft',
      isActive: true,
      remarks: '',
    });

    this.showForm = true;
    document.body.classList.add('modal-open');
  }

  edit(row: ExamRow): void {
    this.mode = 'edit';
    this.editingId = row.id;

    this.form.reset({
      name: row.name,
      code: row.code,
      programId: row.programId,
      batchId: row.batchId,
      examType: row.examType,
      mode: row.mode,
      startAt: row.startAt,
      endAt: row.endAt,
      status: row.status,
      isActive: row.isActive,
      remarks: row.remarks || '',
    });

    this.showForm = true;
    document.body.classList.add('modal-open');
  }

  closeForm(): void {
    this.showForm = false;
    document.body.classList.remove('modal-open');
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;

    const program = this.programs.find((p) => p.id === Number(v.programId));
    const batch = this.batches.find((b) => b.id === Number(v.batchId));

    const payload: ExamRow = {
      id: this.editingId || this.nextId(),
      name: String(v.name || '').trim(),
      code: String(v.code || '').trim(),
      programId: Number(v.programId),
      programName: program?.name || '',
      batchId: Number(v.batchId),
      batchName: batch?.name || '',
      examType: v.examType,
      mode: v.mode,
      startAt: v.startAt,
      endAt: v.endAt,
      status: v.status,
      isActive: !!v.isActive,
      remarks: v.remarks || null,
    };

    if (this.mode === 'create') {
      this.data = [payload, ...this.data];
      this.alert.success('Exam created');
    } else {
      this.data = this.data.map((x) => (x.id === payload.id ? payload : x));
      this.alert.success('Exam updated');
    }

    this.applyFilter();
    this.closeForm();
  }

  openDelete(row: ExamRow): void {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete "${row.name}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean): void {
    this.deleteModalVisible = false;
    if (confirmed && this.deleteTarget) {
      this.data = this.data.filter((x) => x.id !== this.deleteTarget!.id);
      this.applyFilter();
      this.alert.success('Deleted');
    }
    this.deleteTarget = null;
  }

  private nextId(): string {
    const n = this.data.length + 1;
    return `EX-${String(n).padStart(3, '0')}`;
  }

  private nowLocalPlus(hours: number): string {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    // datetime-local needs yyyy-MM-ddTHH:mm
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  openMarksEntry(row: ExamRow): void {
    this.router.navigate(['/app/exams/marks-entry', row.id]);
  }
}
