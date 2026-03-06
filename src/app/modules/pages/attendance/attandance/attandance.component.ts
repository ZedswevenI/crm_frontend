import { Component, OnInit, OnDestroy } from '@angular/core';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-attandance',
  standalone: false,
  templateUrl: './attandance.component.html',
  styleUrl: './attandance.component.scss'
})
  
export class AttandanceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly moduleName = 'attendance';
  loading = false;
  selectedDate: number | null = null;
  selectedDateLabel = '';
  dates: { label: string; value: number }[] = [];

  columnsArray = [
    { key: 'batchCode', label: 'Batch Code', sortable: false },
    { key: 'timeLabel', label: 'Timing', sortable: false },
    { key: 'subjectName', label: 'Subject', sortable: false },
    { key: 'facultyName', label: 'Faculty', sortable: false },
    { key: 'periodType', label: 'Type', sortable: false },
    { key: 'mode', label: 'Mode', sortable: false },
  ];

  originalData: any[] = [];
  dataArray: any[] = [];
  totalRecords = 0;

  actions = [
    {
      type: 'simple',
      color: 'primary',
      text: 'Mark Attendance',
      callback: (row: any) => this.markAttendance(row),
    },
  ];

  constructor(
    private breadcrumb: BredcrumpService,
    private router: Router,
    private commonApi: CommonapiService,
  ) {
    this.breadcrumb.set([{ label: 'Attendance' }]);
  }

  ngOnInit(): void {
    this.buildWeekDates();
    const todayUtc = this.getTodayUtcMs();
    const todayEntry = this.dates.find((d) => d.value === todayUtc);
    if (todayEntry) {
      this.selectDate(todayEntry);
    } else {
      this.selectDate(this.dates[0]);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // FIX #2 + #4: Pure UTC arithmetic — no local setDate/setHours
  // All date values sent to backend are UTC midnight to match wkStartOn in DB
  buildWeekDates(): void {
    const todayUtc = this.getTodayUtcMs();
    const d = new Date(todayUtc);
    const utcDay = d.getUTCDay(); // 0=Sun
    const diffDays = utcDay === 0 ? -6 : 1 - utcDay;
    const mondayUtc = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate() + diffDays,
    );
    this.dates = [];
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    for (let i = 0; i < 7; i++) {
      const dayMs = mondayUtc + i * 24 * 60 * 60 * 1000;
      const dd = new Date(dayMs);
      this.dates.push({
        label: `${dayLabels[i]} ${dd.getUTCDate()} ${monthNames[dd.getUTCMonth()]}`,
        value: dayMs,
      });
    }
  }

  getTodayUtcMs(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }

  selectDate(date: { label: string; value: number }): void {
    this.selectedDate = date.value;
    this.selectedDateLabel = date.label;
    this.loadPending();
  }

  loadPending(): void {
    if (!this.selectedDate) return;
    const tenantId = localStorage.getItem('tenantId');
    const facultyId =
      localStorage.getItem('facultyId') || localStorage.getItem('userId');
    const payload: any = { tenantId, date: this.selectedDate };
    if (facultyId) payload.facultyId = facultyId;
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'pending')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          const raw: any[] = Array.isArray(res?.data) ? res.data : [];
          this.originalData = raw.map((r: any) => ({
            ...r,
            timeLabel:
              r.time?.startLabel && r.time?.endLabel
                ? `${r.time.startLabel} – ${r.time.endLabel}`
                : `Period ${r.periodNo}`,
            subjectName: r.subjectName || r.subjectId || '—',
          }));
          this.loadTableData({ page: 1, pageSize: 10 });
        },
        error: () => {
          this.loading = false;
          this.originalData = [];
          this.loadTableData({ page: 1, pageSize: 10 });
        },
      });
  }

  markAttendance(row: any): void {
    this.router.navigate(['/app/attendance/mark'], {
      state: {
        batchCode: row.batchCode,
        timetableId: row.timetableId,
        periodNo: row.periodNo,
        facultyId: row.facultyId,
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        date: this.selectedDate,
        dateLabel: this.selectedDateLabel,
        timeLabel: row.timeLabel,
        mode: row.mode,
        periodType: row.periodType,
      },
    });
  }

  loadTableData(req: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
  }): void {
    let filtered = [...this.originalData];
    if (req.search) {
      const val = req.search.toLowerCase();
      filtered = filtered.filter((row) =>
        Object.values(row).some((v) => String(v).toLowerCase().includes(val)),
      );
    }
    if (req.sortKey) {
      filtered.sort((a, b) => {
        const x = a[req.sortKey!];
        const y = b[req.sortKey!];
        return req.sortDirection === 'asc'
          ? String(x).localeCompare(String(y))
          : String(y).localeCompare(String(x));
      });
    }
    this.totalRecords = filtered.length;
    const start = (req.page - 1) * req.pageSize;
    this.dataArray = filtered.slice(start, start + req.pageSize);
  }
}
