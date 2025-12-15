import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

interface Faculty {
  id: number;
  name: string;
}
interface Batch {
  id: number;
  name: string;
}
interface Subject {
  id: number;
  name: string;
}

interface Assignment {
  id: number;
  facultyId: number;
  facultyName: string;
  batchId: number;
  batchName: string;
  subjectId: number;
  subjectName: string;
  day: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

@Component({
  selector: 'app-faculty',
  standalone: false,
  templateUrl: './faculty.component.html',
  styleUrl: './faculty.component.scss'
})
export class FacultyComponent implements OnInit {
  showAssign = false;
  editId: number | null = null;

  form!: FormGroup;

  // delete modal
  deleteModalVisible = false;
  deleteTarget: Assignment | null = null;
  deleteMessage = '';

  days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // dummy masters
  faculties: Faculty[] = [
    { id: 1, name: 'Sivakumar' },
    { id: 2, name: 'Priya R' },
    { id: 3, name: 'Vignesh' }
  ];
  batches: Batch[] = [
    { id: 1, name: 'JEE 2026 - Phase 1' },
    { id: 2, name: 'NEET 2025 - Regular' }
  ];
  subjects: Subject[] = [
    { id: 1, name: 'Physics' },
    { id: 2, name: 'Chemistry' },
    { id: 3, name: 'Maths' },
    { id: 4, name: 'Biology' }
  ];

  facultyOptions = this.faculties.map(x => ({ label: x.name, value: x.id }));
  batchOptions = this.batches.map(x => ({ label: x.name, value: x.id }));
  subjectOptions = this.subjects.map(x => ({ label: x.name, value: x.id }));

  assignments: Assignment[] = [
    {
      id: 1,
      facultyId: 1,
      facultyName: 'Sivakumar',
      batchId: 1,
      batchName: 'JEE 2026 - Phase 1',
      subjectId: 1,
      subjectName: 'Physics',
      day: 'Mon',
      startTime: '17:00',
      endTime: '18:30',
      isActive: true
    }
  ];

  columns = [
    { key: 'facultyName', label: 'Faculty', sortable: true },
    { key: 'batchName', label: 'Batch', sortable: true },
    { key: 'subjectName', label: 'Subject', sortable: true },
    { key: 'day', label: 'Day', sortable: true },
    { key: 'startTime', label: 'Start', sortable: true },
    { key: 'endTime', label: 'End', sortable: true },
    { key: 'isActive', label: 'Active', sortable: false }
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      color: '#6B7280',
      callback: (row: Assignment) => this.edit(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      color: '#6B7280',
      hoverColor: '#D42B2B',
      callback: (row: Assignment) => this.openDelete(row)
    }
  ];

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Faculty Assignment' }]);
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      facultyId: [null, Validators.required],
      batchId: [null, Validators.required],
      subjectId: [null, Validators.required],
      day: ['Mon', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      isActive: [true]
    });
  }

  openAssign(): void {
    this.editId = null;
    this.form.reset({
      facultyId: null,
      batchId: null,
      subjectId: null,
      day: 'Mon',
      startTime: '',
      endTime: '',
      isActive: true
    });
    this.showAssign = true;
    document.body.classList.add('modal-open');
  }

  closeAssign(): void {
    this.showAssign = false;
    this.editId = null;
    document.body.classList.remove('modal-open');
  }

  edit(row: Assignment): void {
    this.editId = row.id;
    this.form.reset({
      facultyId: row.facultyId,
      batchId: row.batchId,
      subjectId: row.subjectId,
      day: row.day,
      startTime: row.startTime,
      endTime: row.endTime,
      isActive: row.isActive
    });
    this.showAssign = true;
    document.body.classList.add('modal-open');
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;

    const fac = this.faculties.find(x => x.id === v.facultyId);
    const bat = this.batches.find(x => x.id === v.batchId);
    const sub = this.subjects.find(x => x.id === v.subjectId);

    const payload: Assignment = {
      id: this.editId ?? 0,
      facultyId: v.facultyId,
      facultyName: fac?.name || '',
      batchId: v.batchId,
      batchName: bat?.name || '',
      subjectId: v.subjectId,
      subjectName: sub?.name || '',
      day: v.day,
      startTime: v.startTime,
      endTime: v.endTime,
      isActive: v.isActive
    };

    if (this.editId == null) {
      const newId = (this.assignments[this.assignments.length - 1]?.id || 0) + 1;
      this.assignments = [...this.assignments, { ...payload, id: newId }];
      this.alert.success('Faculty assigned successfully.');
    } else {
      this.assignments = this.assignments.map(a => (a.id === this.editId ? { ...payload, id: this.editId! } : a));
      this.alert.success('Assignment updated successfully.');
    }

    this.closeAssign();
  }

  openDelete(row: Assignment): void {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete assignment for "${row.facultyName}" (${row.batchName} - ${row.subjectName})?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean): void {
    this.deleteModalVisible = false;

    if (confirmed && this.deleteTarget) {
      this.assignments = this.assignments.filter(x => x.id !== this.deleteTarget!.id);
      this.alert.success('Assignment deleted.');
    }
    this.deleteTarget = null;
  }
}
