import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

type Status = 'open' | 'resolved';

interface FacultyFeedback {
  id: string;
  facultyName: string;
  batchName: string;
  subject: string;
  rating: number;
  date: string;
  comments: string;
  actionNotes?: string;
  status: Status;
}

@Component({
  selector: 'app-facultyfeedback',
  standalone: false,
  templateUrl: './facultyfeedback.component.html',
  styleUrl: './facultyfeedback.component.scss'
})
export class FacultyfeedbackComponent implements OnInit {

  search = '';
  fromDate = '';
  toDate = '';
  filterRating: number | 'all' = 'all';
  filterStatus: Status | 'all' = 'all';

  ratingOptions = [5, 4, 3, 2, 1];

  data: FacultyFeedback[] = [
    {
      id: 'FF-001',
      facultyName: 'Sivakumar',
      batchName: 'JEE 2026 - Phase 1',
      subject: 'Physics',
      rating: 4,
      date: '2025-12-18',
      comments: 'Concepts explained clearly.',
      actionNotes: 'Encourage more numerical practice.',
      status: 'open'
    }
  ];

  filtered: FacultyFeedback[] = [];

  columns = [
    { key: 'date', label: 'Date', sortable: true, date: true },
    { key: 'facultyName', label: 'Faculty', sortable: true },
    { key: 'batchName', label: 'Batch', sortable: true },
    { key: 'subject', label: 'Subject', sortable: true },
    { key: 'rating', label: 'Rating', sortable: true },
    { key: 'status', label: 'Status', sortable: true }
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View',
      callback: (row: FacultyFeedback) => this.edit(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-circle-check',
      tooltip: 'Resolve',
      callback: (row: FacultyFeedback) => this.resolve(row.id)
    }
  ];

  showForm = false;
  mode: 'create' | 'edit' = 'create';
  editingId: string | null = null;
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Feedback' }, { label: 'Faculty' }]);
  }

  ngOnInit(): void {
    const today = this.today();
    this.fromDate = today;
    this.toDate = today;

    this.form = this.fb.group({
      facultyName: ['', Validators.required],
      batchName: ['', Validators.required],
      subject: ['', Validators.required],
      rating: [5, Validators.required],
      date: [today, Validators.required],
      comments: [''],
      actionNotes: ['']
    });

    this.applyFilter();
  }

  applyFilter(): void {
    const q = this.search.toLowerCase();

    this.filtered = this.data.filter(x => {
      if (this.filterRating !== 'all' && x.rating !== this.filterRating) return false;
      if (this.filterStatus !== 'all' && x.status !== this.filterStatus) return false;
      if (this.fromDate && x.date < this.fromDate) return false;
      if (this.toDate && x.date > this.toDate) return false;

      if (q) {
        const s = `${x.facultyName} ${x.batchName} ${x.subject}`.toLowerCase();
        if (!s.includes(q)) return false;
      }
      return true;
    });
  }

  add(): void {
    this.mode = 'create';
    this.editingId = null;
    this.form.reset({ rating: 5, date: this.today() });
    this.showForm = true;
    document.body.classList.add('modal-open');
  }

  edit(row: FacultyFeedback): void {
    this.mode = 'edit';
    this.editingId = row.id;
    this.form.patchValue(row);
    this.showForm = true;
    document.body.classList.add('modal-open');
  }

  save(): void {
    const v = this.form.value;
    const payload: FacultyFeedback = {
      id: this.editingId || this.nextId(),
      status: 'open',
      ...v
    };

    if (this.mode === 'create') {
      this.data.unshift(payload);
    } else {
      this.data = this.data.map(x => x.id === payload.id ? { ...x, ...payload } : x);
    }

    this.applyFilter();
    this.closeForm();
    this.alert.success('Saved');
  }

  resolve(id: string): void {
    this.data = this.data.map(x => x.id === id ? { ...x, status: 'resolved' } : x);
    this.applyFilter();
    this.alert.success('Marked resolved');
  }

  closeForm(): void {
    this.showForm = false;
    document.body.classList.remove('modal-open');
  }

  reload(): void {
    this.applyFilter();
  }

  private nextId(): string {
    return `FF-${String(this.data.length + 1).padStart(3, '0')}`;
  }

  private today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
