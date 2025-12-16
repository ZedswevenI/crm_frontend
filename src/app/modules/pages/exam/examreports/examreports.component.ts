import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';

interface ReportRow {
  regNo: string;
  name: string;
  batchName: string;

  total: number;
  pct: number;

  // subject marks
  marks: Record<string, number>;
}

interface SubjectDef {
  key: string;
  name: string;
  maxMarks: number;
}

@Component({
  selector: 'app-examreports',
  standalone: false,
  templateUrl: './examreports.component.html',
  styleUrl: './examreports.component.scss'
})
  
export class ExamreportsComponent implements OnInit {
  // masters (dummy)
  programs = [
    { id: 1, name: 'JEE 2 Year Classroom' },
    { id: 2, name: 'NEET 1 Year Repeaters' }
  ];

  batchesAll = [
    { id: 1, programId: 1, name: 'JEE 2026 - Phase 1' },
    { id: 2, programId: 2, name: 'NEET 2025 - Regular' }
  ];

  examsAll = [
    { id: 'EX-001', batchId: 1, name: 'Unit Test - Physics 01' },
    { id: 'EX-002', batchId: 1, name: 'Weekly Test - 03' },
    { id: 'EX-003', batchId: 2, name: 'Model Exam - 01' }
  ];

  subjectsAll: SubjectDef[] = [
    { key: 'physics', name: 'Physics', maxMarks: 100 },
    { key: 'chemistry', name: 'Chemistry', maxMarks: 100 },
    { key: 'maths', name: 'Maths', maxMarks: 100 }
  ];

  programOptions = this.programs.map(p => ({ label: p.name, value: p.id }));
  batchOptions: any[] = [];
  examOptions: any[] = [];

  filters = {
    programId: 1,
    batchId: 1,
    examId: 'EX-001',
    from: '',
    to: '',
    search: '',
    passPct: 35
  };

  // data
  rows: ReportRow[] = [];
  filteredRows: ReportRow[] = [];
  subjectKpi: Array<{ key: string; name: string; avg: number; max: number }> = [];

  kpi = {
    students: 0,
    avgPct: '0.0',
    topperPct: '0.0',
    passPct: '0.0'
  };

  constructor(
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private router: Router
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Reports' }, { label: 'Performance' }]);
  }

  ngOnInit(): void {
    this.onProgramChange();
    this.onExamChange();
    this.seedDummy();
    this.applyFilters();
  }

  reload(): void {
    this.seedDummy();
    this.applyFilters();
    this.alert.success('Refreshed (dummy).');
  }

  exportExcel(): void {
    console.log('EXPORT', this.filteredRows);
    this.alert.success('Export triggered (dummy).');
  }

  print(): void {
    window.print();
  }

  onProgramChange(): void {
    this.batchOptions = this.batchesAll
      .filter(b => b.programId === this.filters.programId)
      .map(b => ({ label: b.name, value: b.id }));

    // default batch
    if (!this.batchOptions.some(x => x.value === this.filters.batchId)) {
      this.filters.batchId = this.batchOptions[0]?.value ?? null;
    }

    this.examOptions = this.examsAll
      .filter(e => e.batchId === this.filters.batchId)
      .map(e => ({ label: e.name, value: e.id }));

    if (!this.examOptions.some(x => x.value === this.filters.examId)) {
      this.filters.examId = this.examOptions[0]?.value ?? null;
    }

    this.applyFilters();
  }

  onExamChange(): void {
    // if you want subject list per exam, load here
    this.applyFilters();
  }

  applyFilters(): void {
    const q = (this.filters.search || '').trim().toLowerCase();

    // date filter kept for future (when exam has date)
    this.filteredRows = this.rows
      .filter(r => !q || r.regNo.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
      .sort((a, b) => b.pct - a.pct);

    this.computeKpis();
    this.computeSubjectKpis();
  }

  viewStudent(r: ReportRow): void {
    console.log('VIEW STUDENT', r);
    // later: route to report card page
    // this.router.navigate(['/app/reports/performance/student', r.regNo], { queryParams: { examId: this.filters.examId }});
  }

  // ---------------- KPI ----------------
  private computeKpis(): void {
    const n = this.filteredRows.length;
    this.kpi.students = n;

    if (!n) {
      this.kpi.avgPct = '0.0';
      this.kpi.topperPct = '0.0';
      this.kpi.passPct = '0.0';
      return;
    }

    const avg = this.filteredRows.reduce((s, x) => s + x.pct, 0) / n;
    const top = this.filteredRows[0]?.pct ?? 0;
    const passCount = this.filteredRows.filter(x => x.pct >= this.filters.passPct).length;
    const passPct = (passCount / n) * 100;

    this.kpi.avgPct = avg.toFixed(1);
    this.kpi.topperPct = top.toFixed(1);
    this.kpi.passPct = passPct.toFixed(1);
  }

  private computeSubjectKpis(): void {
    const n = this.filteredRows.length;
    if (!n) {
      this.subjectKpi = [];
      return;
    }

    this.subjectKpi = this.subjectsAll.map(s => {
      const sum = this.filteredRows.reduce((acc, r) => acc + (Number(r.marks[s.key]) || 0), 0);
      const avg = sum / n;
      const max = Math.max(...this.filteredRows.map(r => Number(r.marks[s.key]) || 0));
      return { key: s.key, name: s.name, avg: Number(avg.toFixed(1)), max };
    });
  }

  // ---------------- Dummy data ----------------
  private seedDummy(): void {
    // In real API: filter by examId/batchId
    const maxTotal = this.subjectsAll.reduce((s, x) => s + x.maxMarks, 0);

    const base: Array<{ regNo: string; name: string }> = [
      { regNo: 'JEE26-0001', name: 'Rohit Sharma' },
      { regNo: 'JEE26-0002', name: 'Sanjana Iyer' },
      { regNo: 'JEE26-0003', name: 'Vignesh M' },
      { regNo: 'JEE26-0004', name: 'Megha Varma' }
    ];

    const batchName = this.batchesAll.find(b => b.id === this.filters.batchId)?.name || '';

    this.rows = base.map((s, idx) => {
      const marks: Record<string, number> = {
        physics: 40 + idx * 10,
        chemistry: 35 + idx * 8,
        maths: 45 + idx * 7
      };
      const total = Object.values(marks).reduce((a, b) => a + b, 0);
      const pct = (total / maxTotal) * 100;

      return {
        regNo: s.regNo,
        name: s.name,
        batchName,
        total,
        pct: Number(pct.toFixed(1)),
        marks
      };
    });
  }
}