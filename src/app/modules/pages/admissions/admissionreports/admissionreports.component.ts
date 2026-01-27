import { Component, OnInit } from '@angular/core';

type ReportType = 'snj' | 'enrollment';

@Component({
  selector: 'app-admissionreports',
  standalone: false,
  templateUrl: './admissionreports.component.html',
  styleUrl: './admissionreports.component.scss'
})
export class AdmissionreportsComponent implements OnInit {
  // ---------------- Report Selection ----------------
  reportType: ReportType = 'snj';

  // ---------------- Filters (UI only) ----------------
  // SNJ filters
  snjFilter = {
    from: '',
    to: '',
    program: 'All',
    center: 'All',
    status: 'All',
    search: ''
  };

  // Enrollment filters
  enrollFilter = {
    yearA: 2024,
    yearB: 2025,
    groupBy: 'program' as 'program' | 'center' | 'month',
    program: 'All',
    center: 'All'
  };

  // ---------------- Master filter values ----------------
  programs = ['All', 'Aspire - 4Y Integrated', 'JEE Weekend', 'NEET Weekend', 'Foundation IX', 'Foundation X', 'JEE Evening'];
  centers = ['All', 'Coimbatore', 'Tiruppur', 'Erode', 'Salem'];
  snjStatuses = ['All', 'Not Reachable', 'Awaiting Parent Confirmation', 'Not Interested', 'Part Payment Done', 'Not Paid'];

  years = [2023, 2024, 2025, 2026];

  // ---------------- Sample Data (kept inside TS) ----------------
  SNJ_SAMPLE = [
    {
      regNo: 'ENR-2025-0012',
      studentName: 'Karthik R',
      phone: '9000011223',
      program: 'Aspire - 4Y Integrated',
      center: 'Coimbatore',
      selectedOn: '2025-09-28',
      testScore: 72,
      result: 'Selected',
      followupStatus: 'Not Reachable',
      lastContactOn: '2025-10-03',
      nextFollowupOn: '2025-10-06',
      remarks: 'Switched off for 3 days'
    },
    {
      regNo: 'ENR-2025-0087',
      studentName: 'Anu Priya',
      phone: '9000099988',
      program: 'NEET Weekend',
      center: 'Tiruppur',
      selectedOn: '2025-09-26',
      testScore: 64,
      result: 'Selected',
      followupStatus: 'Awaiting Parent Confirmation',
      lastContactOn: '2025-09-30',
      nextFollowupOn: '2025-10-02',
      remarks: 'Need fee concession discussion'
    },
    {
      regNo: 'ENR-2025-0110',
      studentName: 'Madhan S',
      phone: '9000077711',
      program: 'JEE Evening',
      center: 'Coimbatore',
      selectedOn: '2025-09-25',
      testScore: 58,
      result: 'Selected',
      followupStatus: 'Not Interested',
      lastContactOn: '2025-09-27',
      nextFollowupOn: null,
      remarks: 'Joined competitor institute'
    },
    {
      regNo: 'ENR-2025-0181',
      studentName: 'Rekha V',
      phone: '9000022211',
      program: 'Foundation IX',
      center: 'Erode',
      selectedOn: '2025-09-29',
      testScore: 69,
      result: 'Selected',
      followupStatus: 'Part Payment Done',
      lastContactOn: '2025-10-01',
      nextFollowupOn: '2025-10-04',
      remarks: 'Advance pending; waiting for cheque'
    }
  ];

  ENROLL_YEAR_COMPARISON = [{ year: 2024, totalEnrollments: 1180, confirmed: 1025, cancelled: 45, pending: 110 }, { year: 2025, totalEnrollments: 1410, confirmed: 1210, cancelled: 38, pending: 162 }];

  ENROLL_BY_PROGRAM = [{ program: 'Aspire - 4Y Integrated', y2024: 320, y2025: 410 }, { program: 'JEE Weekend', y2024: 280, y2025: 315 }, { program: 'NEET Weekend', y2024: 240, y2025: 290 }, { program: 'Foundation IX', y2024: 190, y2025: 210 }, { program: 'Foundation X', y2024: 150, y2025: 185 }];

  ENROLL_BY_CENTER = [{ center: 'Coimbatore', y2024: 520, y2025: 640 }, { center: 'Tiruppur', y2024: 260, y2025: 290 }, { center: 'Erode', y2024: 210, y2025: 245 }, { center: 'Salem', y2024: 190, y2025: 235 }];

  ENROLL_MONTH_TREND = [
    { month: 'Jan', y2024: 60, y2025: 75 },
    { month: 'Feb', y2024: 70, y2025: 85 },
    { month: 'Mar', y2024: 90, y2025: 110 },
    { month: 'Apr', y2024: 110, y2025: 130 },
    { month: 'May', y2024: 140, y2025: 155 },
    { month: 'Jun', y2024: 120, y2025: 145 },
    { month: 'Jul', y2024: 130, y2025: 150 },
    { month: 'Aug', y2024: 150, y2025: 165 },
    { month: 'Sep', y2024: 120, y2025: 140 },
    { month: 'Oct', y2024: 90, y2025: 110 },
    { month: 'Nov', y2024: 60, y2025: 80 },
    { month: 'Dec', y2024: 30, y2025: 65 }
  ];

  // ---------------- Derived: Filtered Data ----------------
  get filteredSNJ(): any[] {
    const s = (this.snjFilter.search || '').toLowerCase().trim();

    return this.SNJ_SAMPLE.filter(r => {
      if (this.snjFilter.program !== 'All' && r.program !== this.snjFilter.program) return false;
      if (this.snjFilter.center !== 'All' && r.center !== this.snjFilter.center) return false;
      if (this.snjFilter.status !== 'All' && r.followupStatus !== this.snjFilter.status) return false;

      if (this.snjFilter.from && r.selectedOn < this.snjFilter.from) return false;
      if (this.snjFilter.to && r.selectedOn > this.snjFilter.to) return false;

      if (s) {
        const hay = `${r.regNo} ${r.studentName} ${r.phone} ${r.program} ${r.center} ${r.followupStatus}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }

  get snjKpis(): { total: number; notReachable: number; awaiting: number; notInterested: number; partPayment: number } {
    const rows = this.filteredSNJ;
    const c = (st: string) => rows.filter(r => r.followupStatus === st).length;
    return {
      total: rows.length,
      notReachable: c('Not Reachable'),
      awaiting: c('Awaiting Parent Confirmation'),
      notInterested: c('Not Interested'),
      partPayment: c('Part Payment Done')
    };
  }

  // Enrollment tables depend on year selection (simple mapping to y2024/y2025 in sample)
  get enrollProgramRows(): any[] {
    const a = this.enrollFilter.yearA;
    const b = this.enrollFilter.yearB;
    return this.ENROLL_BY_PROGRAM
      .map((x: any) => ({
        program: x.program,
        a: a === 2024 ? x.y2024 : a === 2025 ? x.y2025 : 0,
        b: b === 2024 ? x.y2024 : b === 2025 ? x.y2025 : 0
      }))
      .filter(r => this.enrollFilter.program === 'All' || r.program === this.enrollFilter.program);
  }

  get enrollCenterRows(): any[] {
    const a = this.enrollFilter.yearA;
    const b = this.enrollFilter.yearB;
    return this.ENROLL_BY_CENTER
      .map((x: any) => ({
        center: x.center,
        a: a === 2024 ? x.y2024 : a === 2025 ? x.y2025 : 0,
        b: b === 2024 ? x.y2024 : b === 2025 ? x.y2025 : 0
      }))
      .filter(r => this.enrollFilter.center === 'All' || r.center === this.enrollFilter.center);
  }

  get enrollMonthRows(): any[] {
    const a = this.enrollFilter.yearA;
    const b = this.enrollFilter.yearB;
    return this.ENROLL_MONTH_TREND.map((x: any) => ({
      month: x.month,
      a: a === 2024 ? x.y2024 : a === 2025 ? x.y2025 : 0,
      b: b === 2024 ? x.y2024 : b === 2025 ? x.y2025 : 0
    }));
  }

  ngOnInit(): void {}

  setReport(type: ReportType): void {
    this.reportType = type;
  }

  resetSNJ(): void {
    this.snjFilter = { from: '', to: '', program: 'All', center: 'All', status: 'All', search: '' };
  }

  resetEnrollment(): void {
    this.enrollFilter = { yearA: 2024, yearB: 2025, groupBy: 'program', program: 'All', center: 'All' };
  }

  exportExcel(): void {
    console.log('export excel', this.reportType);
    alert('Export (dummy) – integrate later');
  }

  exportPdf(): void {
    console.log('export pdf', this.reportType);
    alert('PDF (dummy) – integrate later');
  }

  trackByIndex(i: number): number {
    return i;
  }
}
