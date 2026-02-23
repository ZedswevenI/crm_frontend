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
    { key: 'batchCode',   label: 'Batch Code',  sortable: false },
    { key: 'timeLabel',   label: 'Timing',       sortable: false },
    { key: 'subjectName', label: 'Subject',      sortable: false },
    { key: 'facultyName', label: 'Faculty',      sortable: false },
    { key: 'periodType',  label: 'Type',         sortable: false },
    { key: 'mode',        label: 'Mode',         sortable: false },
  ];
  originalData: any[] = [];
  dataArray:    any[] = [];
  totalRecords  = 0;

  actions = [
    {
      type: 'simple',
      color: 'primary',
      text: 'Mark Attendance',
      callback: (row: any) => this.markAttendance(row)
    }
  ];

  constructor(
    private breadcrumb: BredcrumpService,
    private router: Router,
    private commonApi: CommonapiService
  ) {
    this.breadcrumb.set([{ label: 'Attendance' }]);
  }

  ngOnInit(): void {
    this.buildWeekDates();
    const todayMs = this.getTodayMs();
    const todayEntry = this.dates.find(d => d.value === todayMs);
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

  buildWeekDates(): void {
    const now   = new Date();
    const day   = now.getDay();
    const diff  = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    this.dates = [];
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ms = d.getTime();
      this.dates.push({
        label: `${dayLabels[i]} ${d.getDate()} ${monthNames[d.getMonth()]}`,
        value: ms
      });
    }
  }

  getTodayMs(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  selectDate(date: { label: string; value: number }): void {
    this.selectedDate      = date.value;
    this.selectedDateLabel = date.label;
    this.loadPending();
  }

  loadPending(): void {
    if (!this.selectedDate) return;
    const tenantId = localStorage.getItem('tenantId');
    const payload  = { tenantId, date: this.selectedDate };
    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, 'pending')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          const raw: any[] = Array.isArray(res?.data) ? res.data : [];
          this.originalData = raw.map((r: any) => ({
            ...r,
            timeLabel: r.time
              ? `${r.time.startLabel || ''} – ${r.time.endLabel || ''}`
              : `Period ${r.periodNo}`,
            subjectName: r.subjectName || r.subjectId || '—',
          }));
          this.loadTableData({ page: 1, pageSize: 10 });
        },
        error: () => {
          this.loading = false;
          this.originalData = [];
          this.loadTableData({ page: 1, pageSize: 10 });
        }
      });
  }

  markAttendance(row: any): void {
    this.router.navigate(['/app/attendance/mark'], {
      state: {
        batchCode:   row.batchCode,
        timetableId: row.timetableId,
        periodNo:    row.periodNo,
        facultyId:   row.facultyId,
        subjectId:   row.subjectId,
        subjectName: row.subjectName,
        date:        this.selectedDate,
        dateLabel:   this.selectedDateLabel,
        timeLabel:   row.timeLabel,
        mode:        row.mode,
        periodType:  row.periodType,
      }
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
      filtered = filtered.filter(row =>
        Object.values(row).some(v => String(v).toLowerCase().includes(val))
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
    const start       = (req.page - 1) * req.pageSize;
    this.dataArray    = filtered.slice(start, start + req.pageSize);
  }
}