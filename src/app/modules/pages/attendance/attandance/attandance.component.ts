import { Component, OnInit, OnDestroy } from '@angular/core';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AuthService } from '../../../../service/auth/auth.service';
import { RoleLevel } from '../../../../shared/role.config';

@Component({
  selector: 'app-attandance',
  standalone: false,
  templateUrl: './attandance.component.html',
  styleUrl: './attandance.component.scss'
})

export class AttandanceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  userRole: RoleLevel = 'L4';
  isAO = false;
  isTeacher = false;
  staffId = '';
  loading = false;
  selectedDate: number | null = null;
  selectedDateLabel = '';
  dates: {
    label: string;
    value: number;
    isFuture: boolean;
    isToday: boolean;
  }[] = [];
  currentWeekMonday = 0;
  columnsArray = [
    { key: 'batchCode', label: 'Batch', sortable: false },
    { key: 'timeLabel', label: 'Timing', sortable: false },
    { key: 'subjectName', label: 'Subject', sortable: false },
    { key: 'phaseName', label: 'Phase', sortable: false },
    { key: 'facultyName', label: 'Faculty', sortable: false },
    { key: 'periodType', label: 'Type', sortable: false },
    { key: 'mode', label: 'Mode', sortable: false },
    { key: 'statusBadge', label: 'Status', sortable: false },
    { key: 'attendanceSummary', label: 'Attendance', sortable: false },
  ];
  originalData: any[] = [];
  dataArray: any[] = [];
  totalRecords = 0;
  actions: any[] = [];

  constructor(
    private breadcrumb: BredcrumpService,
    private router: Router,
    private commonApi: CommonapiService,
    private auth: AuthService,
  ) {
    this.breadcrumb.set([ { label: 'Timetable & Attendance'}, { label: 'Attendance' }]);
  }

  ngOnInit(): void {
    this.userRole = this.auth.getrole();
    this.isAO = ['L1', 'L3'].includes(this.userRole);
    this.isTeacher = this.userRole === 'L4';
    this.staffId = this.auth.getStaffId();
    this.buildWeekDates(this.getTodayUtcMs());
    const today = this.getTodayUtcMs();
    const todayEntry = this.dates.find((d) => d.value === today);
    this.selectDate(todayEntry ?? this.dates[0]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getTodayUtcMs(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }

  getMondayOfWeek(anyDayMs: number): number {
    const d = new Date(anyDayMs);
    const utcDay = d.getUTCDay();
    const diffDays = utcDay === 0 ? -6 : 1 - utcDay;
    return Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate() + diffDays,
    );
  }

  buildWeekDates(anyDayMs: number): void {
    const mondayMs = this.getMondayOfWeek(anyDayMs);
    this.currentWeekMonday = mondayMs;
    const today = this.getTodayUtcMs();
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = [
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
    this.dates = Array.from({ length: 7 }, (_, i) => {
      const ms = mondayMs + i * 86_400_000;
      const d = new Date(ms);
      return {
        label: `${dayLabels[i]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`,
        value: ms,
        isToday: ms === today,
        isFuture: ms > today,
      };
    });
  }

  prevWeek(): void {
    this.buildWeekDates(this.currentWeekMonday - 7 * 86_400_000);
    this.selectDate(this.dates[0]);
  }

  nextWeek(): void {
    this.buildWeekDates(this.currentWeekMonday + 7 * 86_400_000);
    this.selectDate(this.dates[0]);
  }

  selectDate(date: {
    label: string;
    value: number;
    isFuture: boolean;
    isToday: boolean;
  }): void {
    this.selectedDate = date.value;
    this.selectedDateLabel = date.label;
    this.loadSchedule();
  }

  loadSchedule(): void {
    if (!this.selectedDate) return;
    const tenantId = localStorage.getItem('tenantId');
    this.loading = true;
    if (this.isTeacher) {
      if (!this.staffId) {
        this.loading = false;
        this.originalData = [];
        this.buildTableData();
        return;
      }
      const payload = {
        tenantId,
        date: this.selectedDate,
        facultyId: this.staffId,
      };
      this.commonApi
        .fetchData(payload, 'attendance', 'schedule/staff')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: any) => {
            this.loading = false;
            this.mapTeacherData(res?.data ?? []);
          },
          error: () => {
            this.loading = false;
            this.originalData = [];
            this.buildTableData();
          },
        });
    } else {
      const payload = { tenantId, date: this.selectedDate };
      this.commonApi
        .fetchData(payload, 'attendance', 'schedule/withattendance')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: any) => {
            this.loading = false;
            this.mapAOData(res?.data ?? []);
          },
          error: () => {
            this.loading = false;
            this.originalData = [];
            this.buildTableData();
          },
        });
    }
  }

  mapTeacherData(raw: any[]): void {
    const today = this.getTodayUtcMs();
    const isPast = this.selectedDate! < today;
    if (isPast) {
      this.originalData = [];
      this.buildTableData();
      return;
    }
    const isToday = this.selectedDate === today;
    this.originalData = raw.map((r: any) => this.enrichRow(r, isToday));
    this.buildActions();
    this.buildTableData();
  }


  mapAOData(raw: any[]): void {
    const today = this.getTodayUtcMs();
    // const isFuture = this.selectedDate! > today && (this.auth.getrole() === 'L1' || this.auth.getrole() === 'L3');
    // this.originalData = raw.map((r: any) => this.enrichRow(r, !isFuture));
    this.buildActions();
    this.buildTableData();
  }
  // 

  private enrichRow(r: any, showAction: boolean): any {
    const isMarked = r.attendance?.isMarked === true;
    return {
      ...r,
      timeLabel: this.formatTimeLabel(r),
      subjectName: r.subjectName || r.subjectId || '—',
      facultyName: r.facultyName || r.facultyId || '—',
      statusBadge: isMarked ? 'Marked' : 'Pending',
      attendanceSummary: isMarked
        ? `${r.attendance.presentCount}P / ${r.attendance.absentCount}A / ${r.attendance.lateCount}L`
        : '—',
      _att: r.attendance,
      _showAction: showAction,
      _isMarked: isMarked,
    };
  }

  buildActions(): void {
    this.actions = [
      {
        type: 'simple',
        color: 'primary',
        text: 'Mark Attendance',
        callback: (row: any) => this.goToMark(row),
        hidden: (row: any) => !row._showAction || row._isMarked,
      },
      {
        type: 'simple',
        color: 'secondary',
        text: 'Edit Attendance',
        callback: (row: any) => this.goToMark(row),
        hidden: (row: any) => !row._showAction || !row._isMarked || this.isTeacher,
        // hidden: (row: any) => !row._showAction || !row._isMarked,
      },
    ];
  }

  goToMark(row: any): void {
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
        isEditMode: row._att?.isMarked === true,
        attendanceId: row._att?.attendanceId || null,
      },
    });
  }

  buildTableData(): void {
    this.loadTableData({ page: 1, pageSize: 10 });
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

  formatTimeLabel(r: any): string {
    return r.time?.startLabel && r.time?.endLabel
      ? `${r.time.startLabel} – ${r.time.endLabel}`
      : `Period ${r.periodNo}`;
  }

  get isPastDate(): boolean {
    return !!this.selectedDate && this.selectedDate < this.getTodayUtcMs();
  }

  get isTodaySelected(): boolean {
    return this.selectedDate === this.getTodayUtcMs();
  }

  get isFutureDate(): boolean {
    return !!this.selectedDate && this.selectedDate > this.getTodayUtcMs();
  }

  get pendingCount(): number {
    return this.originalData.filter((r) => !r._att?.isMarked).length;
  }

  get markedCount(): number {
    return this.originalData.filter((r) => r._att?.isMarked).length;
  }
}
