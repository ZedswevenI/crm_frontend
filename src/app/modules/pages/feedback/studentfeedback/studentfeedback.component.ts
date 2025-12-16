import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

interface Batch {
  id: number;
  name: string;
}

type FeedbackStatus = 'open' | 'resolved';

interface FeedbackRow {
  id: string;
  regNo: string;
  studentName: string;
  batchId: number;
  batchName: string;
  subject?: string | null;
  faculty?: string | null;
  date: string; // yyyy-mm-dd
  rating: number; // 1..5
  comments?: string | null;
  internalNotes?: string | null;
  status: FeedbackStatus;
}

@Component({
  selector: 'app-studentfeedback',
  standalone: false,
  templateUrl: './studentfeedback.component.html',
  styleUrl: './studentfeedback.component.scss'
})
export class StudentfeedbackComponent implements OnInit {

  search = '';
  fromDate = '';
  toDate = '';
  filterBatchId: number | 'all' = 'all';
  filterRating: number | 'all' = 'all';

  ratingOptions = [5, 4, 3, 2, 1];

  batches: Batch[] = [
    { id: 1, name: 'JEE 2026 - Phase 1' },
    { id: 2, name: 'NEET 2025 - Regular' }
  ];

  data: FeedbackRow[] = [
    {
      id: 'FB-001',
      regNo: 'JEE26-0001',
      studentName: 'Rohit Sharma',
      batchId: 1,
      batchName: 'JEE 2026 - Phase 1',
      subject: 'Physics',
      faculty: 'Sivakumar',
      date: '2025-12-16',
      rating: 4,
      comments: 'Class was good. Need more solved examples.',
      internalNotes: 'Share extra problem sheet.',
      status: 'open'
    },
    {
      id: 'FB-002',
      regNo: 'NEET25-0001',
      studentName: 'Harish Kumar',
      batchId: 2,
      batchName: 'NEET 2025 - Regular',
      subject: 'Biology',
      faculty: 'Vignesh',
      date: '2025-12-15',
      rating: 5,
      comments: 'Very clear explanation.',
      internalNotes: null,
      status: 'resolved'
    }
  ];

  filtered: FeedbackRow[] = [];

  columns = [
    { key: 'date', label: 'Date', sortable: true, date: true },
    { key: 'regNo', label: 'Reg No', sortable: true },
    { key: 'studentName', label: 'Student', sortable: true },
    { key: 'batchName', label: 'Batch', sortable: true },
    { key: 'faculty', label: 'Faculty', sortable: true },
    { key: 'subject', label: 'Subject', sortable: true },
    { key: 'rating', label: 'Rating', sortable: true },
    { key: 'status', label: 'Status', sortable: true }
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View',
      color: '#2563EB',
      callback: (row: FeedbackRow) => this.view(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      color: '#6B7280',
      callback: (row: FeedbackRow) => this.edit(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-circle-check',
      tooltip: 'Resolve',
      color: '#16A34A',
      callback: (row: FeedbackRow) => this.resolve(row.id)
    }
  ];

  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingId: string | null = null;

  showView = false;
  selected: FeedbackRow | null = null;

  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Feedback' }, { label: 'Students' }]);
  }

  ngOnInit(): void {
    const today = this.toYMD(new Date());
    this.fromDate = today;
    this.toDate = today;

    this.form = this.fb.group({
      regNo: ['', Validators.required],
      studentName: ['', Validators.required],
      batchId: [null, Validators.required],
      subject: [''],
      faculty: [''],
      date: [today, Validators.required],
      rating: [null, Validators.required],
      comments: [''],
      internalNotes: ['']
    });

    this.applyFilter();
  }

  f(name: string) {
    return this.form.get(name)!;
  }

  reload(): void {
    this.applyFilter();
    this.alert.success('Refreshed (dummy).');
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();

    this.filtered = this.data.filter(x => {
      if (this.filterBatchId !== 'all' && x.batchId !== Number(this.filterBatchId)) return false;
      if (this.filterRating !== 'all' && x.rating !== Number(this.filterRating)) return false;

      if (this.fromDate && x.date < this.fromDate) return false;
      if (this.toDate && x.date > this.toDate) return false;

      if (q) {
        const hay = `${x.regNo} ${x.studentName} ${x.faculty || ''} ${x.subject || ''} ${x.batchName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    const today = this.toYMD(new Date());

    this.form.reset({
      regNo: '',
      studentName: '',
      batchId: null,
      subject: '',
      faculty: '',
      date: today,
      rating: null,
      comments: '',
      internalNotes: ''
    });

    this.showForm = true;
    document.body.classList.add('modal-open');
  }

  edit(row: FeedbackRow): void {
    this.formMode = 'edit';
    this.editingId = row.id;

    this.form.reset({
      regNo: row.regNo,
      studentName: row.studentName,
      batchId: row.batchId,
      subject: row.subject || '',
      faculty: row.faculty || '',
      date: row.date,
      rating: row.rating,
      comments: row.comments || '',
      internalNotes: row.internalNotes || ''
    });

    this.showForm = true;
    document.body.classList.add('modal-open');
  }

  cancel(): void {
    this.showForm = false;
    document.body.classList.remove('modal-open');
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;
    const batch = this.batches.find(b => b.id === v.batchId);

    const payload: FeedbackRow = {
      id: this.editingId || this.nextId(),
      regNo: String(v.regNo || '').trim(),
      studentName: String(v.studentName || '').trim(),
      batchId: Number(v.batchId),
      batchName: batch?.name || '',
      subject: String(v.subject || '').trim() || null,
      faculty: String(v.faculty || '').trim() || null,
      date: v.date,
      rating: Number(v.rating),
      comments: String(v.comments || '').trim() || null,
      internalNotes: String(v.internalNotes || '').trim() || null,
      status: 'open'
    };

    if (this.formMode === 'create') {
      this.data = [payload, ...this.data];
      this.alert.success('Feedback saved');
    } else {
      this.data = this.data.map(x => x.id === payload.id ? { ...payload, status: x.status } : x);
      this.alert.success('Feedback updated');
    }

    this.applyFilter();
    this.cancel();
  }

  view(row: FeedbackRow): void {
    this.selected = row;
    this.showView = true;
    document.body.classList.add('modal-open');
  }

  closeView(): void {
    this.showView = false;
    this.selected = null;
    document.body.classList.remove('modal-open');
  }

  resolve(id: string): void {
    this.data = this.data.map(x => x.id === id ? { ...x, status: 'resolved' } : x);
    this.applyFilter();
    if (this.selected?.id === id) this.selected = { ...this.selected, status: 'resolved' };
    this.alert.success('Marked as resolved');
  }

  private nextId(): string {
    const n = this.data.length + 1;
    return `FB-${String(n).padStart(3, '0')}`;
  }

  private toYMD(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
