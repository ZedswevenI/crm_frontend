import { Component, OnInit } from '@angular/core';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

type AttStatus = 'P' | 'A' | 'L'; // Present / Absent / Late
type EntryState = 'pending' | 'saved';

interface ClassRow {
  id: number;
  batchId: number;
  batchName: string;
  subjectName: string;
  facultyName: string;
  classDate: string; // yyyy-mm-dd
  startTime: string;
  endTime: string;
  state: EntryState; // attendance saved or not
}

interface StudentRow {
  studentId: number;
  regNo: string;
  name: string;
  phone: string;
}

interface AttendanceRow extends StudentRow {
  status: AttStatus;
  remarks?: string;
}

@Component({
  selector: 'app-entry',
  standalone: false,
  templateUrl: './entry.component.html',
  styleUrl: './entry.component.scss'
})
export class EntryComponent implements OnInit {
  // filters
  search = '';
  filterFrom = '';
  filterTo = '';
  filterBatchId: number | 'all' = 'all';
  filterAttStatus: EntryState | 'all' = 'all';

  batches = [{ id: 1, name: 'JEE 2026 - Phase 1' }, { id: 2, name: 'NEET 2025 - Regular' }];

  // dummy scheduled classes
  classData: ClassRow[] = [
    { id: 1, batchId: 1, batchName: 'JEE 2026 - Phase 1', subjectName: 'Physics', facultyName: 'Sivakumar', classDate: '2025-12-16', startTime: '17:00', endTime: '18:30', state: 'pending' },
    { id: 2, batchId: 1, batchName: 'JEE 2026 - Phase 1', subjectName: 'Maths', facultyName: 'Vignesh', classDate: '2025-12-16', startTime: '18:30', endTime: '20:00', state: 'saved' },
    { id: 3, batchId: 2, batchName: 'NEET 2025 - Regular', subjectName: 'Chemistry', facultyName: 'Priya', classDate: '2025-12-17', startTime: '17:00', endTime: '18:30', state: 'pending' }
  ];

  filteredClasses: ClassRow[] = [];

  columns = [
    { key: 'classDate', label: 'Date', sortable: true, date: true },
    { key: 'startTime', label: 'Start', sortable: true },
    { key: 'endTime', label: 'End', sortable: true },
    { key: 'batchName', label: 'Batch', sortable: true },
    { key: 'subjectName', label: 'Subject', sortable: true },
    { key: 'facultyName', label: 'Faculty', sortable: true },
    { key: 'state', label: 'Attendance', sortable: true }
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-clipboard',
      tooltip: 'Enter Attendance',
      color: '#2563EB',
      callback: (row: ClassRow) => this.openAttendance(row)
    }
  ];

  // modal
  showModal = false;
  selectedClass: ClassRow | null = null;
  saving = false;

  // dummy students per batch (replace with API: /batch/:id/students)
  studentsByBatch: Record<number, StudentRow[]> = {
    1: [{ studentId: 101, regNo: 'JEE26-0001', name: 'Rohit Sharma', phone: '9000010001' }, { studentId: 102, regNo: 'JEE26-0002', name: 'Sanjana Iyer', phone: '9000010002' }, { studentId: 105, regNo: 'JEE26-0003', name: 'Vikram S', phone: '9000010003' }],
    2: [{ studentId: 201, regNo: 'NEET25-0001', name: 'Harish Kumar', phone: '9000020001' }, { studentId: 202, regNo: 'NEET25-0002', name: 'Megha Varma', phone: '9000020002' }]
  };

  // attendance entry rows
  attendanceRows: AttendanceRow[] = [];

  summary = { total: 0, present: 0, absent: 0, late: 0 };

  constructor(private alert: AlertService, private breadcrumb: BredcrumpService) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Attendance' }, { label: 'Entry' }]);
  }

  ngOnInit(): void {
    this.applyFilter();
  }

  reload(): void {
    // later: call API
    this.applyFilter();
    this.alert.success('Refreshed (dummy).');
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();

    this.filteredClasses = this.classData.filter((x: ClassRow) => {
      if (this.filterBatchId !== 'all' && x.batchId !== Number(this.filterBatchId)) return false;
      if (this.filterAttStatus !== 'all' && x.state !== this.filterAttStatus) return false;

      if (this.filterFrom && x.classDate < this.filterFrom) return false;
      if (this.filterTo && x.classDate > this.filterTo) return false;

      if (q) {
        const hay = `${x.batchName} ${x.subjectName} ${x.facultyName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  openAttendance(row: ClassRow): void {
    this.selectedClass = row;

    const students = this.studentsByBatch[row.batchId] || [];
    // default: present for all (you can change to blank if you want)
    this.attendanceRows = students.map((s: StudentRow) => ({
      ...s,
      status: 'P',
      remarks: ''
    }));

    this.computeSummary();
    this.showModal = true;
    document.body.classList.add('modal-open');
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedClass = null;
    this.attendanceRows = [];
    document.body.classList.remove('modal-open');
  }

  setStatus(studentId: number, status: AttStatus): void {
    this.attendanceRows = this.attendanceRows.map((r: AttendanceRow) => (r.studentId === studentId ? { ...r, status } : r));
    this.computeSummary();
  }

  markAll(status: AttStatus): void {
    this.attendanceRows = this.attendanceRows.map((r: AttendanceRow) => ({ ...r, status }));
    this.computeSummary();
  }

  private computeSummary(): void {
    const total = this.attendanceRows.length;
    const present = this.attendanceRows.filter(r => r.status === 'P').length;
    const absent = this.attendanceRows.filter(r => r.status === 'A').length;
    const late = this.attendanceRows.filter(r => r.status === 'L').length;
    this.summary = { total, present, absent, late };
  }

  saveAsDraft(): void {
    if (!this.selectedClass) return;
    this.saving = true;

    setTimeout(() => {
      this.classData = this.classData.map((x: ClassRow) => (x.id === this.selectedClass!.id ? { ...x, state: 'saved' } : x));
      this.applyFilter();
      this.saving = false;
      this.alert.success('Draft saved (dummy).');
      this.closeModal();
    }, 300);
  }

  submitAttendance(): void {
    if (!this.selectedClass) return;

    // basic validation example: at least one present/late (optional)
    if (this.attendanceRows.length === 0) {
      this.alert.error('No students to mark attendance.');
      return;
    }

    const payload = {
      classId: this.selectedClass.id,
      classDate: this.selectedClass.classDate,
      batchId: this.selectedClass.batchId,
      rows: this.attendanceRows.map(r => ({
        studentId: r.studentId,
        status: r.status,
        remarks: (r.remarks || '').trim() || null
      }))
    };

    console.log('ATTENDANCE PAYLOAD', payload);

    this.saving = true;
    setTimeout(() => {
      this.classData = this.classData.map((x: ClassRow) => (x.id === this.selectedClass!.id ? { ...x, state: 'saved' } : x));
      this.applyFilter();
      this.saving = false;
      this.alert.success('Attendance submitted (dummy).');
      this.closeModal();
    }, 350);
  }

  trackByIndex(i: number): number {
    return i;
  }
}
