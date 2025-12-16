import { Component, OnInit } from '@angular/core';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

type Tab = 'batch' | 'student';

interface Program {
  id: number;
  name: string;
}
interface Batch {
  id: number;
  programId: number;
  name: string;
}

interface BatchSummaryRow {
  id: number;
  batchName: string;
  programName: string;
  totalClasses: number;
  present: number;
  absent: number;
  pct: number;
}

interface StudentRow {
  id: number;
  regNo: string;
  name: string;
  phone: string;
  batchId: number;
  batchName: string;
  programName: string;
  total: number;
  present: number;
  absent: number;
  pct: number;
}

interface StudentDetailRow {
  date: string;
  subject: string;
  faculty: string;
  start: string;
  end: string;
  status: 'P' | 'A';
}

@Component({
  selector: 'app-reports',
  standalone: false,
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss'
})
export class ReportsComponent implements OnInit {

  tab: Tab = 'batch';

  fromDate = '';
  toDate = '';

  search = '';
  filterProgramId: number | 'all' = 'all';
  filterBatchId: number | 'all' = 'all';

  programs: Program[] = [
    { id: 1, name: 'JEE 2026' },
    { id: 2, name: 'NEET 2025' }
  ];

  batches: Batch[] = [
    { id: 1, programId: 1, name: 'JEE 2026 - Phase 1' },
    { id: 2, programId: 2, name: 'NEET 2025 - Regular' }
  ];

  // dummy batch summary
  allBatchSummary: BatchSummaryRow[] = [
    { id: 1, batchName: 'JEE 2026 - Phase 1', programName: 'JEE 2026', totalClasses: 28, present: 24, absent: 4, pct: 86 },
    { id: 2, batchName: 'NEET 2025 - Regular', programName: 'NEET 2025', totalClasses: 30, present: 26, absent: 4, pct: 87 }
  ];
  batchSummary: BatchSummaryRow[] = [];

  // dummy student rows
  allStudents: StudentRow[] = [
    { id: 101, regNo: 'JEE26-0001', name: 'Rohit Sharma', phone: '9000010001', batchId: 1, batchName: 'JEE 2026 - Phase 1', programName: 'JEE 2026', total: 28, present: 22, absent: 6, pct: 79 },
    { id: 102, regNo: 'JEE26-0002', name: 'Sanjana Iyer', phone: '9000010002', batchId: 1, batchName: 'JEE 2026 - Phase 1', programName: 'JEE 2026', total: 28, present: 26, absent: 2, pct: 93 },
    { id: 201, regNo: 'NEET25-0001', name: 'Harish Kumar', phone: '9000020001', batchId: 2, batchName: 'NEET 2025 - Regular', programName: 'NEET 2025', total: 30, present: 25, absent: 5, pct: 83 }
  ];
  studentRows: StudentRow[] = [];

  // list-table columns (sortable required)
  batchColumns = [
    { key: 'batchName', label: 'Batch', sortable: true },
    { key: 'programName', label: 'Program', sortable: true },
    { key: 'totalClasses', label: 'Total', sortable: true },
    { key: 'present', label: 'Present', sortable: true },
    { key: 'absent', label: 'Absent', sortable: true },
    { key: 'pct', label: 'Attendance %', sortable: true }
  ];

  studentColumns = [
    { key: 'regNo', label: 'Reg No', sortable: true },
    { key: 'name', label: 'Student', sortable: true },
    { key: 'batchName', label: 'Batch', sortable: true },
    { key: 'programName', label: 'Program', sortable: true },
    { key: 'total', label: 'Total', sortable: true },
    { key: 'present', label: 'Present', sortable: true },
    { key: 'absent', label: 'Absent', sortable: true },
    { key: 'pct', label: 'Attendance %', sortable: true }
  ];

  batchActions = [
    {
      type: 'icon',
      icon: 'fa-solid fa-users',
      tooltip: 'View Students',
      color: '#2563EB',
      callback: (row: BatchSummaryRow) => this.openBatchStudents(row)
    }
  ];

  studentActions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View Details',
      color: '#2563EB',
      callback: (row: StudentRow) => this.openStudent(row)
    }
  ];

  // modal state
  showDetails = false;
  selectedStudent: StudentRow | null = null;
  selectedDetails: StudentDetailRow[] = [];
  selectedSummary: { total: number; present: number; absent: number; pct: number } | null = null;

  constructor(
    private alert: AlertService,
    private breadcrumb: BredcrumpService
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Attendance' }, { label: 'Reports' }]);
  }

  ngOnInit(): void {
    // default last 7 days
    const now = new Date();
    const to = this.toYMD(now);
    const from = new Date(now);
    from.setDate(from.getDate() - 7);

    this.fromDate = this.toYMD(from);
    this.toDate = to;

    this.apply();
  }

  reload(): void {
    this.apply();
    this.alert.success('Refreshed (dummy).');
  }

  apply(): void {
    // In real API: call report endpoint with from/to/program/batch/search
    // Here we filter dummy arrays only.
    const q = this.search.trim().toLowerCase();

    this.batchSummary = this.allBatchSummary.filter(b => {
      if (this.filterProgramId !== 'all' && b.programName !== this.programs.find(p => p.id === this.filterProgramId)?.name) return false;
      if (this.filterBatchId !== 'all' && b.batchName !== this.batches.find(x => x.id === this.filterBatchId)?.name) return false;
      if (q) {
        const hay = `${b.batchName} ${b.programName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    this.studentRows = this.allStudents.filter(s => {
      if (this.filterProgramId !== 'all' && s.programName !== this.programs.find(p => p.id === this.filterProgramId)?.name) return false;
      if (this.filterBatchId !== 'all' && s.batchId !== Number(this.filterBatchId)) return false;
      if (q) {
        const hay = `${s.regNo} ${s.name} ${s.phone} ${s.batchName} ${s.programName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  openBatchStudents(row: BatchSummaryRow): void {
    // switch to student tab + filter batch
    const b = this.batches.find(x => x.name === row.batchName);
    if (b) this.filterBatchId = b.id;
    this.tab = 'student';
    this.apply();
    this.alert.success('Showing students for batch.');
  }

  openStudent(row: StudentRow): void {
    this.selectedStudent = row;
    this.selectedSummary = { total: row.total, present: row.present, absent: row.absent, pct: row.pct };

    // dummy class-wise detail (replace with API: /attendance/report/student?id=&from=&to=)
    this.selectedDetails = [
      { date: this.fromDate, subject: 'Physics', faculty: 'Sivakumar', start: '17:00', end: '18:30', status: 'P' },
      { date: this.toDate, subject: 'Maths', faculty: 'Vignesh', start: '18:30', end: '20:00', status: 'A' }
    ];

    this.showDetails = true;
    document.body.classList.add('modal-open');
  }

  closeDetails(): void {
    this.showDetails = false;
    this.selectedStudent = null;
    this.selectedDetails = [];
    this.selectedSummary = null;
    document.body.classList.remove('modal-open');
  }

  exportExcel(): void {
    // later integrate with your export utility
    this.alert.success('Export Excel (dummy).');
  }

  exportPdf(): void {
    this.alert.success('Export PDF (dummy).');
  }

  private toYMD(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
