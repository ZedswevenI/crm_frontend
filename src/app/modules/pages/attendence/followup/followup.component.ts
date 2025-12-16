import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

type Category = 'ABSENT' | 'FEE_DUE' | 'ADMISSION' | 'GENERAL';
type Status = 'pending' | 'inprogress' | 'done';
type Priority = 'low' | 'medium' | 'high';
type Channel = 'CALL' | 'WHATSAPP' | 'SMS' | 'EMAIL';

interface FollowupRow {
  id: string;
  category: Category;
  priority: Priority;
  dueDate: string; // yyyy-mm-dd
  regNo?: string | null;
  studentName?: string | null;
  parentPhone?: string | null;
  owner: string;
  channel: Channel;
  status: Status;
  notes?: string | null;
  lastActionAt?: string | null;
}

@Component({
  selector: 'app-followup',
  standalone: false,
  templateUrl: './followup.component.html',
  styleUrl: './followup.component.scss'
})
export class FollowupComponent implements OnInit {

  search = '';

  filterCategory: Category | 'all' = 'all';
  filterStatus: Status | 'all' = 'all';
  filterFrom = '';
  filterTo = '';

  owners = ['Admin', 'Front Desk', 'Counsellor 1', 'Counsellor 2'];

  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingId: string | null = null;

  form!: FormGroup;

  data: FollowupRow[] = [
    {
      id: 'FU-001',
      category: 'ABSENT',
      priority: 'high',
      dueDate: '2025-12-16',
      regNo: 'JEE26-0001',
      studentName: 'Rohit Sharma',
      parentPhone: '9000099999',
      owner: 'Front Desk',
      channel: 'CALL',
      status: 'pending',
      notes: 'Absent in Physics class. Confirm health & reason.',
      lastActionAt: null
    },
    {
      id: 'FU-002',
      category: 'FEE_DUE',
      priority: 'medium',
      dueDate: '2025-12-17',
      regNo: 'NEET25-0001',
      studentName: 'Harish Kumar',
      parentPhone: '9000088888',
      owner: 'Counsellor 1',
      channel: 'WHATSAPP',
      status: 'inprogress',
      notes: 'Pending fee 25,000. Ask for payment date.',
      lastActionAt: '2025-12-16 11:20'
    }
  ];

  filtered: FollowupRow[] = [];

  columns = [
    { key: 'dueDate', label: 'Due', sortable: true, date: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'priority', label: 'Priority', sortable: true },
    { key: 'regNo', label: 'Reg No', sortable: true },
    { key: 'studentName', label: 'Student', sortable: true },
    { key: 'parentPhone', label: 'Phone', sortable: false },
    { key: 'owner', label: 'Owner', sortable: true },
    { key: 'status', label: 'Status', sortable: true }
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      color: '#6B7280',
      callback: (row: FollowupRow) => this.edit(row)
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-phone',
      tooltip: 'Call',
      color: '#16A34A',
      callback: (row: FollowupRow) => this.quickCall(row)
    },
    {
      type: 'icon',
      icon: 'fa-brands fa-whatsapp',
      tooltip: 'WhatsApp',
      color: '#22C55E',
      callback: (row: FollowupRow) => this.quickWhatsapp(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-circle-check',
      tooltip: 'Mark Done',
      color: '#2563EB',
      callback: (row: FollowupRow) => this.markDone(row.id)
    }
  ];

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Follow-ups' }]);
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      category: ['ABSENT', Validators.required],
      priority: ['medium', Validators.required],
      dueDate: ['', Validators.required],

      regNo: [''],
      studentName: [''],
      parentPhone: [''],

      owner: [this.owners[0], Validators.required],
      channel: ['CALL', Validators.required],
      status: ['pending', Validators.required],
      notes: ['']
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

    this.filtered = this.data.filter((x: FollowupRow) => {
      if (this.filterCategory !== 'all' && x.category !== this.filterCategory) return false;
      if (this.filterStatus !== 'all' && x.status !== this.filterStatus) return false;

      if (this.filterFrom && x.dueDate < this.filterFrom) return false;
      if (this.filterTo && x.dueDate > this.filterTo) return false;

      if (q) {
        const hay = `${x.regNo || ''} ${x.studentName || ''} ${x.parentPhone || ''} ${x.owner} ${x.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.form.reset({
      category: 'ABSENT',
      priority: 'medium',
      dueDate: '',
      regNo: '',
      studentName: '',
      parentPhone: '',
      owner: this.owners[0],
      channel: 'CALL',
      status: 'pending',
      notes: ''
    });
    this.showForm = true;
    document.body.classList.add('modal-open');
  }

  edit(row: FollowupRow): void {
    this.formMode = 'edit';
    this.editingId = row.id;

    this.form.reset({
      category: row.category,
      priority: row.priority,
      dueDate: row.dueDate,
      regNo: row.regNo || '',
      studentName: row.studentName || '',
      parentPhone: row.parentPhone || '',
      owner: row.owner,
      channel: row.channel,
      status: row.status,
      notes: row.notes || ''
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

    const payload: FollowupRow = {
      id: this.editingId || this.nextId(),
      category: v.category,
      priority: v.priority,
      dueDate: v.dueDate,
      regNo: (v.regNo || '').trim() || null,
      studentName: (v.studentName || '').trim() || null,
      parentPhone: (v.parentPhone || '').trim() || null,
      owner: v.owner,
      channel: v.channel,
      status: v.status,
      notes: (v.notes || '').trim() || null,
      lastActionAt: null
    };

    if (this.formMode === 'create') {
      this.data = [payload, ...this.data];
      this.alert.success('Follow-up created');
    } else {
      this.data = this.data.map(x => x.id === payload.id ? payload : x);
      this.alert.success('Follow-up updated');
    }

    this.applyFilter();
    this.cancel();
  }

  private nextId(): string {
    const n = this.data.length + 1;
    return `FU-${String(n).padStart(3, '0')}`;
  }

  quickCall(row: FollowupRow): void {
    // later integrate with tel: or calling widget
    this.touch(row.id);
    this.alert.success(`Call initiated (dummy): ${row.parentPhone || '-'}`);
  }

  quickWhatsapp(row: FollowupRow): void {
    this.touch(row.id);
    this.alert.success(`WhatsApp opened (dummy): ${row.parentPhone || '-'}`);
  }

  markDone(id: string): void {
    this.data = this.data.map(x => x.id === id ? { ...x, status: 'done', lastActionAt: this.nowText() } : x);
    this.applyFilter();
    this.alert.success('Marked as completed');
  }

  private touch(id: string): void {
    this.data = this.data.map(x => x.id === id ? { ...x, status: x.status === 'pending' ? 'inprogress' : x.status, lastActionAt: this.nowText() } : x);
    this.applyFilter();
  }

  private nowText(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }
}
