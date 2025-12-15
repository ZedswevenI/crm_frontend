import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

type ClassStatus = 'scheduled' | 'rearranged' | 'cancelled' | 'completed';

interface ClassRow {
  id: number;
  batchId: number;
  batchName: string;
  subjectName: string;
  facultyId: number;
  facultyName: string;
  classDate: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  room?: string | null;
  status: ClassStatus;

  // rearrange history metadata
  rearrangedFrom?: { date: string; start: string; end: string; facultyName: string } | null;
  rearrangedReason?: string | null;
}

@Component({
  selector: 'app-rearrange',
  standalone: false,
  templateUrl: './rearrange.component.html',
  styleUrl: './rearrange.component.scss'
})
export class RearrangeComponent implements OnInit {

  search = '';
  filterFrom = '';
  filterTo = '';
  filterBatchId: number | 'all' = 'all';
  filterStatus: ClassStatus | 'all' = 'all';

  batches = [
    { id: 1, name: 'JEE 2026 - Phase 1' },
    { id: 2, name: 'NEET 2025 - Regular' }
  ];

  faculties = [
    { id: 1, name: 'Sivakumar' },
    { id: 2, name: 'Priya R' },
    { id: 3, name: 'Vignesh' }
  ];

  classData: ClassRow[] = [
    { id: 1, batchId: 1, batchName: 'JEE 2026 - Phase 1', subjectName: 'Physics', facultyId: 1, facultyName: 'Sivakumar', classDate: '2025-12-16', startTime: '17:00', endTime: '18:30', room: 'Hall A', status: 'scheduled' },
    { id: 2, batchId: 1, batchName: 'JEE 2026 - Phase 1', subjectName: 'Maths', facultyId: 3, facultyName: 'Vignesh', classDate: '2025-12-16', startTime: '18:30', endTime: '20:00', room: 'Hall A', status: 'scheduled' },
    { id: 3, batchId: 2, batchName: 'NEET 2025 - Regular', subjectName: 'Chemistry', facultyId: 2, facultyName: 'Priya R', classDate: '2025-12-17', startTime: '17:00', endTime: '18:30', room: 'Hall B', status: 'rearranged',
      rearrangedFrom: { date: '2025-12-15', start: '17:00', end: '18:30', facultyName: 'Priya R' },
      rearrangedReason: 'Batch requested change'
    }
  ];

  filtered: ClassRow[] = [];

  columns = [
    { key: 'classDate',  label: 'Date',    sortable: true, date: true },
    { key: 'startTime',  label: 'Start',   sortable: true },
    { key: 'endTime',    label: 'End',     sortable: true },
    { key: 'batchName',  label: 'Batch',   sortable: true },
    { key: 'subjectName',label: 'Subject', sortable: true },
    { key: 'facultyName',label: 'Faculty', sortable: true },
    { key: 'status',     label: 'Status',  sortable: true }
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-solid fa-shuffle',
      tooltip: 'Rearrange',
      color: '#2563EB',
      callback: (row: ClassRow) => this.openRearrange(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-circle-check',
      tooltip: 'Mark Completed',
      color: '#16A34A',
      callback: (row: ClassRow) => this.markCompleted(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-circle-xmark',
      tooltip: 'Cancel Class',
      color: '#DC2626',
      callback: (row: ClassRow) => this.cancelClass(row)
    }
  ];

  // rearrange modal
  showRearrange = false;
  selected: ClassRow | null = null;
  rearrangeForm!: FormGroup;

  report = {
    rearranged: 0,
    cancelled: 0,
    completed: 0,
    scheduled: 0,
    facultyWise: [] as Array<{ name: string; count: number }>,
    dayWise: [] as Array<{ date: string; count: number }>
  };

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Class Rearrange' }]);
  }

  ngOnInit(): void {
    this.rearrangeForm = this.fb.group({
      newDate: ['', Validators.required],
      newStart: ['', Validators.required],
      newEnd: ['', Validators.required],
      newFacultyId: [1, Validators.required],
      room: [''],
      reason: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.applyFilter();
  }

  rf(name: string) {
    return this.rearrangeForm.get(name)!;
  }

  reload(): void {
    // later call API
    this.applyFilter();
    this.alert.success('Refreshed (dummy).');
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();

    this.filtered = this.classData
      .filter((x: ClassRow) => {
        if (this.filterBatchId !== 'all' && x.batchId !== Number(this.filterBatchId)) return false;
        if (this.filterStatus !== 'all' && x.status !== this.filterStatus) return false;

        if (this.filterFrom && x.classDate < this.filterFrom) return false;
        if (this.filterTo && x.classDate > this.filterTo) return false;

        if (q) {
          const hay = `${x.batchName} ${x.subjectName} ${x.facultyName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

    this.recomputeReport();
  }

  private recomputeReport(): void {
    const src = this.filtered;

    const countByStatus = (s: ClassStatus) => src.filter((x: ClassRow) => x.status === s).length;
    this.report.scheduled = countByStatus('scheduled');
    this.report.rearranged = countByStatus('rearranged');
    this.report.cancelled = countByStatus('cancelled');
    this.report.completed = countByStatus('completed');

    // faculty-wise rearranged
    const facMap = new Map<string, number>();
    src.filter((x: ClassRow) => x.status === 'rearranged').forEach((x: ClassRow) => {
      facMap.set(x.facultyName, (facMap.get(x.facultyName) || 0) + 1);
    });
    this.report.facultyWise = Array.from(facMap.entries()).map(([name, count]) => ({ name, count }));

    // day-wise rearranged
    const dayMap = new Map<string, number>();
    src.filter((x: ClassRow) => x.status === 'rearranged').forEach((x: ClassRow) => {
      dayMap.set(x.classDate, (dayMap.get(x.classDate) || 0) + 1);
    });
    this.report.dayWise = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));
  }

  // ---------------- Rearrange flow ----------------
  openRearrange(row: ClassRow): void {
    this.selected = row;

    this.rearrangeForm.reset({
      newDate: row.classDate,
      newStart: row.startTime,
      newEnd: row.endTime,
      newFacultyId: row.facultyId,
      room: row.room || '',
      reason: ''
    });

    this.showRearrange = true;
    document.body.classList.add('modal-open');
  }

  closeRearrange(): void {
    this.showRearrange = false;
    this.selected = null;
    document.body.classList.remove('modal-open');
  }

  saveRearrange(): void {
    if (!this.selected) return;
    if (this.rearrangeForm.invalid) {
      this.rearrangeForm.markAllAsTouched();
      return;
    }

    const v = this.rearrangeForm.value;
    const newFaculty = this.faculties.find(f => f.id === Number(v.newFacultyId));

    // store old data for history
    const old = {
      date: this.selected.classDate,
      start: this.selected.startTime,
      end: this.selected.endTime,
      facultyName: this.selected.facultyName
    };

    // update row
    const updated: ClassRow = {
      ...this.selected,
      classDate: v.newDate,
      startTime: v.newStart,
      endTime: v.newEnd,
      facultyId: Number(v.newFacultyId),
      facultyName: newFaculty?.name || this.selected.facultyName,
      room: v.room || null,
      status: 'rearranged',
      rearrangedFrom: old,
      rearrangedReason: v.reason
    };

    this.classData = this.classData.map((x: ClassRow) => x.id === this.selected!.id ? updated : x);

    this.alert.success('Class rearranged successfully');
    this.closeRearrange();
    this.applyFilter();
  }

  // ---------------- Status updates ----------------
  markCompleted(row: ClassRow): void {
    this.classData = this.classData.map((x: ClassRow) => x.id === row.id ? { ...x, status: 'completed' } : x);
    this.alert.success('Marked as completed');
    this.applyFilter();
  }

  cancelClass(row: ClassRow): void {
    this.classData = this.classData.map((x: ClassRow) => x.id === row.id ? { ...x, status: 'cancelled' } : x);
    this.alert.success('Class cancelled');
    this.applyFilter();
  }

  exportReport(): void {
    // later: export excel/pdf
    console.log('REPORT', this.report, 'FILTERED', this.filtered);
    this.alert.success('Export generated (dummy).');
  }
}
