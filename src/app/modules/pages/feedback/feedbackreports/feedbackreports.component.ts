import { Component, OnInit } from '@angular/core';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';

type Status = 'open' | 'resolved';

interface Batch {
  id: number;
  name: string;
}

interface StudentFeedbackRow {
  id: string;
  date: string;
  regNo: string;
  studentName: string;
  batchId: number;
  batchName: string;
  subject?: string | null;
  faculty?: string | null;
  rating: number;
  status: Status;
  comments?: string | null;
}

interface FacultyFeedbackRow {
  id: string;
  date: string;
  facultyName: string;
  batchName: string;
  batchId: number;
  subject: string;
  rating: number;
  status: Status;
  comments?: string | null;
}

@Component({
  selector: 'app-feedbackreports',
  standalone: false,
  templateUrl: './feedbackreports.component.html',
  styleUrl: './feedbackreports.component.scss'
})
export class FeedbackreportsComponent implements OnInit {
  tab: 'student' | 'faculty' = 'student';

  // filters
  fromDate = '';
  toDate = '';
  batchId: number | 'all' = 'all';
  rating: number | 'all' = 'all';
  facultySearch = '';
  search = '';

  ratingOptions = [5, 4, 3, 2, 1];

  batches: Batch[] = [{ id: 1, name: 'JEE 2026 - Phase 1' }, { id: 2, name: 'NEET 2025 - Regular' }];

  // dummy data (replace with API later)
  studentData: StudentFeedbackRow[] = [
    {
      id: 'SFB-001',
      date: '2025-12-16',
      regNo: 'JEE26-0001',
      studentName: 'Rohit Sharma',
      batchId: 1,
      batchName: 'JEE 2026 - Phase 1',
      subject: 'Physics',
      faculty: 'Sivakumar',
      rating: 4,
      status: 'open',
      comments: 'Need more solved examples.'
    }
  ];

  facultyData: FacultyFeedbackRow[] = [
    {
      id: 'FFB-001',
      date: '2025-12-18',
      facultyName: 'Sivakumar',
      batchId: 1,
      batchName: 'JEE 2026 - Phase 1',
      subject: 'Physics',
      rating: 4,
      status: 'open',
      comments: 'Teaching is good, increase practice.'
    }
  ];

  studentFiltered: StudentFeedbackRow[] = [];
  facultyFiltered: FacultyFeedbackRow[] = [];

  summary = {
    total: 0,
    avgRating: '0.0',
    open: 0,
    resolved: 0
  };

  studentColumns = [
    { key: 'date', label: 'Date', sortable: true, date: true },
    { key: 'regNo', label: 'Reg No', sortable: true },
    { key: 'studentName', label: 'Student', sortable: true },
    { key: 'batchName', label: 'Batch', sortable: true },
    { key: 'subject', label: 'Subject', sortable: true },
    { key: 'faculty', label: 'Faculty', sortable: true },
    { key: 'rating', label: 'Rating', sortable: true },
    { key: 'status', label: 'Status', sortable: true }
  ];

  facultyColumns = [
    { key: 'date', label: 'Date', sortable: true, date: true },
    { key: 'facultyName', label: 'Faculty', sortable: true },
    { key: 'batchName', label: 'Batch', sortable: true },
    { key: 'subject', label: 'Subject', sortable: true },
    { key: 'rating', label: 'Rating', sortable: true },
    { key: 'status', label: 'Status', sortable: true }
  ];

  studentActions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View',
      callback: (row: StudentFeedbackRow) => this.viewRow(row)
    }
  ];

  facultyActions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View',
      callback: (row: FacultyFeedbackRow) => this.viewRow(row)
    }
  ];

  constructor(private breadcrumb: BredcrumpService, private alert: AlertService) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Reports' }, { label: 'Feedback' }]);
  }

  ngOnInit(): void {
    const today = this.toYMD(new Date());
    this.fromDate = today;
    this.toDate = today;
    this.applyFilters();
  }

  reload(): void {
    this.applyFilters();
    this.alert.success('Refreshed (dummy).');
  }

  resetFilters(): void {
    const today = this.toYMD(new Date());
    this.fromDate = today;
    this.toDate = today;
    this.batchId = 'all';
    this.rating = 'all';
    this.facultySearch = '';
    this.search = '';
    this.applyFilters();
  }

  applyFilters(): void {
    this.studentFiltered = this.studentData.filter(x => this.matchStudent(x));
    this.facultyFiltered = this.facultyData.filter(x => this.matchFaculty(x));
    this.computeSummary();
  }

  private matchCommon(date: string, rating: number): boolean {
    if (this.fromDate && date < this.fromDate) return false;
    if (this.toDate && date > this.toDate) return false;
    if (this.rating !== 'all' && rating !== Number(this.rating)) return false;
    return true;
  }

  private matchStudent(x: StudentFeedbackRow): boolean {
    if (!this.matchCommon(x.date, x.rating)) return false;

    if (this.batchId !== 'all' && x.batchId !== Number(this.batchId)) return false;

    if (this.facultySearch.trim()) {
      const q = this.facultySearch.trim().toLowerCase();
      if (!(x.faculty || '').toLowerCase().includes(q)) return false;
    }

    if (this.search.trim()) {
      const q = this.search.trim().toLowerCase();
      const hay = `${x.regNo} ${x.studentName} ${x.batchName} ${x.subject || ''} ${x.faculty || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  private matchFaculty(x: FacultyFeedbackRow): boolean {
    if (!this.matchCommon(x.date, x.rating)) return false;

    if (this.batchId !== 'all' && x.batchId !== Number(this.batchId)) return false;

    if (this.facultySearch.trim()) {
      const q = this.facultySearch.trim().toLowerCase();
      if (!x.facultyName.toLowerCase().includes(q)) return false;
    }

    if (this.search.trim()) {
      const q = this.search.trim().toLowerCase();
      const hay = `${x.facultyName} ${x.batchName} ${x.subject}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  private computeSummary(): void {
    const all = [...this.studentFiltered, ...this.facultyFiltered] as Array<{ rating: number; status: Status }>;
    const total = all.length;
    const open = all.filter(x => x.status === 'open').length;
    const resolved = all.filter(x => x.status === 'resolved').length;
    const avg = total ? all.reduce((s, x) => s + Number(x.rating || 0), 0) / total : 0;

    this.summary = {
      total,
      avgRating: avg.toFixed(1),
      open,
      resolved
    };
  }

  viewRow(row: any): void {
    // later route to view modal/page; for now:
    console.log('VIEW ROW', row);
    this.alert.success('View action (dummy).');
  }

  exportExcel(): void {
    // hook your excel export util later
    this.alert.success('Export (dummy).');
  }

  private toYMD(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
