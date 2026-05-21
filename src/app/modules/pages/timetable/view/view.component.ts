import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { forkJoin, map, Subject } from 'rxjs';
import { takeUntil, catchError, of, finalize } from 'rxjs';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

const safeTrim = (v: any): string =>
  v === undefined || v === null ? '' : String(v).trim();

const toInt = (v: any, def = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const timeStrToMin = (t: string): number => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minToLabel = (min: number): string => {
  const h24 = Math.floor(min / 60);
  const mm = min % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
};

const minToTimeStr = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const timesOverlap = (
  s1: number,
  e1: number,
  s2: number,
  e2: number,
): boolean => s1 < e2 && s2 < e1;

const pickFields = (obj: any, fields: string[]): any => {
  const out: any = {};
  fields.forEach((f) => {
    out[f] = obj?.[f] ?? '';
  });
  return out;
};

const CONTENT_FIELDS = [
  'periodType',
  'mode',
  'facultyId',
  'facultyName',
  'subjectCode',
  'subjectName',
  'subjectId',
  'phaseId',
  'phaseName',
  'topic',
  'venue',
  'zoomUrl',
];

@Component({
  selector: 'app-view',
  standalone: false,
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss',
})
export class ViewComponent implements OnInit, OnDestroy {
   private destroy$ = new Subject<void>();

  loading = false;
  tenantId: any;
  timetableId = '';
  batchCode = '';
  currentWkStartOn = 0;
  private moduleName = 'timetable';
  timetable: any = null;
  get isPublished(): boolean {
    return this.timetable?.status === 'Active';
  }
  get isDraft(): boolean {
    return this.timetable?.status === 'DRAFT';
  }
  centersFull: any[] = [];
  staffFull: any[] = [];
  batchStaffFull: any[] = [];
  subjectsFull: any[] = [];
  batchSubjects: any[] = [];
  phasesFull: any[] = [];
  batchProgramId = '';
  private subjectIdToStaff = new Map<string, any[]>();
  private staffByCode: Record<string, any> = {};
  private staffById: Record<string, any> = {};
  private subjectByCode: Record<string, any> = {};
  private subjectById: Record<string, any> = {};
  private centerByCode: Record<string, any> = {};
  daysOrder = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ];
  sortedSchedule: any[] = [];
  maxPeriods = 0;
  periodHeaders: number[] = [];
  weekDateMap: any = {};
  todayDayName = '';
  activeDay: any = null;
  activePeriodNo = 0;
  activePeriod: any = null;
  showCancelDay = false;
  cancelDayReason = 'Holiday';
  showEditDay = false;
  editDayPeriods: any[] = [];
  editDayOriginalPeriods: any[] = [];
  editDayConflicts: any[] = [];
  editDayValidating = false;
  editDayDragIndex: number | null = null;
  editDayDragOverIndex: number | null = null;
  editDaySubmitAttempted = false;
  showEmptyDayConfirm = false;
  showCancelPeriod = false;
  cancelPeriodReason = 'Cancelled';
  showRearrangeStaff = false;
  newFacultyId = '';
  newFacultyName = '';
  activeSubjectId = '';
  showMovePeriod = false;
  moveToPeriodNo: number | null = null;
  availablePeriodSlots: number[] = [];
  showReplacePeriod = false;
  rp: any = {
    facultyId: '',
    facultyName: '',
    subjectCode: '',
    subjectName: '',
    subjectId: '',
    venue: '',
    topic: '',
    periodType: 'LECTURE',
    mode: 'OFFLINE',
    zoomUrl: '',
    phaseId: '',
    phaseName: '',
    _startMin: 0,
    _endMin: 0,
    _startLabel: '',
    _endLabel: '',
  };
  showSetZoom = false;
  zoomUrlInput = '';
  showConvertToExam = false;
  showConvertConfirm = false;
  examForm: any = {
    examId: '',
    examDescription: '',
    facultyId: '',
    facultyName: '',
    venue: '',
    topic: '',
  };
  openActionKey = '';
  actionMenuTop = 0;
  actionMenuLeft = 0;
  showPublishConfirm = false;
  showUnpublishConfirm = false;
  weekNavLoading = false;
  hasPrevWeek = false;
  hasNextWeek = false;
  private weekIndex: any[] = [];
  viewMode: 'week' | 'range' = 'week';
  fromDateStr = '';
  toDateStr = '';
  rangeMetaLabel = '';
  private lastWeeklyTimetable: any = null;
  batchClassNo = 0;
  batchStaffMap: any[] = [];
  rpPhases: any[] = [];
  showStaffLateModal = false;
  staffLateEntry: any = {
    timetableId: '',
    periodNo: 0,
    facultyId: '',
    facultyName: '',
    scheduledStartMin: 0,
    startLabel: '',
    endLabel: '',
    batchCode: '',
    dateMs: 0,
    delayMinutes: 0,
    reason: '',
    entryType: 'LATE',
  };
  showSpecialClass = false;
  specialClassConflict = '';
  scPhases: any[] = [];
  sc: any = {
    periodNo: null,
    startTime: '',
    endTime: '',
    periodType: 'LECTURE',
    mode: 'OFFLINE',
    subjectCode: '',
    subjectName: '',
    subjectId: '',
    facultyId: '',
    facultyName: '',
    phaseId: '',
    phaseName: '',
    topic: '',
    venue: '',
    zoomUrl: '',
    __timeError: '',
  };
  showCloneConfirm = false;
  cloneResult: any = null;
  phasesPerSubject: Record<string, any[]> = {};

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private alert: AlertService,
    private commonApi: CommonapiService,
    private breadcrumb: BredcrumpService
  ) {
    this.tenantId =
      localStorage.getItem('tenantId') || localStorage.getItem('entiId');
        this.breadcrumb.set([{ label: 'Timetable', link: '/app/timetable' }, {label: 'View'}]);
  }

  ngOnInit(): void {
    this.batchCode = safeTrim(this.route.snapshot.paramMap.get('id'));
    this.currentWkStartOn = this.getMondayOfCurrentWeek();
    if (!this.batchCode) {
      this.alert.error('batchCode ID missing');
      this.router.navigate(['/app/timetable']);
      return;
    }
    const DAYS_UTC = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    this.todayDayName = DAYS_UTC[new Date().getUTCDay()];
    this.loadLookupsAndTimetable();
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.openActionKey = '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get fromDateMs(): number {
    return this.toStartOfDayMs(this.fromDateStr) || 0;
  }
  get toDateMs(): number {
    return this.toStartOfDayMs(this.toDateStr) || this.fromDateMs || 0;
  }

  private getMondayOfCurrentWeek(): number {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    return Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + diff,
    );
  }

  private toStartOfDayMs(dateStr: string): number {
    if (!dateStr) return 0;
    const [yyyy, mm, dd] = dateStr.split('-').map(Number);
    if (!yyyy || !mm || !dd) return 0;
    return Date.UTC(yyyy, mm - 1, dd);
  }

  private toISODateInput(ms: number): string {
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  private fmtDateLabel(ms: number): string {
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '-';
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    return `${dd} ${mon} ${d.getUTCFullYear()}`;
  }

  epochToDisplayDate(epoch: any): string {
    if (!epoch) return '-';
    const ms = Number(epoch);
    if (!Number.isFinite(ms) || ms <= 0) return '-';
    return new Date(ms).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }

  msToDisplayDate(ms: number): string {
    if (!ms) return '-';
    return new Date(ms).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }

  isToday(dayName: string): boolean {
    return (
      this.viewMode === 'week' &&
      this.isCurrentWeek() &&
      dayName === this.todayDayName
    );
  }

  isCurrentWeek(): boolean {
    const wkStart = toInt(this.timetable?.wkStartOn, 0);
    if (!wkStart) return false;
    const now = Date.now();
    const wkEnd = wkStart + 7 * 24 * 60 * 60 * 1000;
    return now >= wkStart && now < wkEnd;
  }

  isPastDate(dateMs: number): boolean {
    if (!dateMs) return false;
    const todayStart = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    );
    return dateMs < todayStart;
  }

  private loadLookupsAndTimetable() {
    this.loading = true;
    const tenantId = this.tenantId;
    forkJoin({
      center: this.commonApi
        .fetchData({ entiId: tenantId }, 'ims', 'center/list?list=full')
        .pipe(catchError(() => of({ data: [] }))),
      staff: this.commonApi
        .fetchData({ entiId: tenantId }, 'ims', 'staff/list?list=full')
        .pipe(catchError(() => of({ data: [] }))),
      subject: this.commonApi
        .fetchData({ entiId: tenantId }, 'ims', 'subject/list?list=full')
        .pipe(catchError(() => of({ data: [] }))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: ({ center, staff, subject }: any) => {
          this.centersFull = center?.data || [];
          this.staffFull = staff?.data || [];
          this.subjectsFull = subject?.data || [];
          this.centerByCode = {};
          this.centersFull.forEach((c: any) => {
            const code = safeTrim(c?.centerCode);
            if (code) this.centerByCode[code] = c;
          });
          this.staffByCode = {};
          this.staffById = {};
          this.staffFull.forEach((s: any) => {
            const code = safeTrim(s?.staffCode);
            if (code) this.staffByCode[code] = s;
            [safeTrim(s?.staffId), safeTrim(s?._id), safeTrim(s?.employeeId)]
              .filter(Boolean)
              .forEach((k) => {
                this.staffById[k] = s;
              });
          });
          this.subjectByCode = {};
          this.subjectById = {};
          this.subjectsFull.forEach((sub: any) => {
            const code = safeTrim(sub?.subjectCode);
            const id = safeTrim(sub?._id);
            if (code) this.subjectByCode[code] = sub;
            if (id) this.subjectById[id] = sub;
          });
          this.buildSubjectStaffMap();
          this.loadTimetable();
        },
        error: () => {
          this.loadTimetable();
        },
      });
  }

  private buildSubjectStaffMap() {
    this.subjectIdToStaff = new Map<string, any[]>();
    this.staffFull.forEach((s: any) => {
      const subjects = Array.isArray(s?.subject)
        ? s.subject
        : s?.subject
          ? [s.subject]
          : [];
      subjects.forEach((sub: any) => {
        const id = safeTrim(sub?._id || sub);
        if (!id) return;
        if (!this.subjectIdToStaff.has(id)) this.subjectIdToStaff.set(id, []);
        this.subjectIdToStaff.get(id)!.push(s);
      });
    });
  }

  private loadPhases() {
    this.commonApi
      .fetchData({ entiId: this.tenantId }, 'institue', 'phase/list?list=full')
      .pipe(
        catchError(() => of({ data: [] })),
        takeUntil(this.destroy$),
      )
      .subscribe((res: any) => {
        this.phasesFull = res?.data || [];
      });
  }

  private loadRpPhases(subjectId: string) {
    if (!subjectId || !this.batchProgramId || !this.batchClassNo) {
      this.rpPhases = [];
      return;
    }
    this.commonApi
      .fetchData(
        { entiId: this.tenantId },
        'institue',
        `phase/list?classNo=${this.batchClassNo}&subjectId=${subjectId}&programId=${this.batchProgramId}`,
      )
      .pipe(
        catchError(() => of({ data: [] })),
        takeUntil(this.destroy$),
      )
      .subscribe((res: any) => {
        this.rpPhases = Array.isArray(res) ? res : res?.data || [];
      });
  }

  private loadBatchDetails(batchCode: string) {
    if (!batchCode) return;
    this.commonApi
      .fetchData({ entiId: this.tenantId, batchCode }, 'batch', 'view')
      .pipe(
        catchError(() => of({ data: null })),
        takeUntil(this.destroy$),
      )
      .subscribe((res: any) => {
        const batch = res?.data || null;
        this.batchProgramId = safeTrim(batch?.programId);

        this.batchClassNo = toInt(batch?.classNo, 0);
        this.batchStaffMap = Array.isArray(batch?.staffMap)
          ? batch.staffMap
          : [];
        const batchSubjectCodes: string[] = (
          batch?.subjects ||
          batch?.subjectCodes ||
          []
        )
          .map((s: any) => safeTrim(s))
          .filter(Boolean);
        this.batchSubjects = batchSubjectCodes.length
          ? this.subjectsFull.filter((sub) =>
              batchSubjectCodes.includes(safeTrim(sub?.subjectCode)),
            )
          : this.subjectsFull;
        const batchSubjectIds = new Set(
          this.batchSubjects.map((s: any) => safeTrim(s?._id)).filter(Boolean),
        );
        this.batchStaffFull = batchSubjectIds.size
          ? this.staffFull.filter((s: any) => {
              const subjects = Array.isArray(s?.subject)
                ? s.subject
                : s?.subject
                  ? [s.subject]
                  : [];
              return subjects.some((sub: any) =>
                batchSubjectIds.has(safeTrim(sub?._id || sub)),
              );
            })
          : this.staffFull;
        if (!this.batchStaffFull.length) this.batchStaffFull = this.staffFull;
      });
  }

  getCenterName(centerCode: string): string {
    return (
      this.centerByCode?.[safeTrim(centerCode)]?.centerName || centerCode || '-'
    );
  }

  resolveFacultyLabel(p: any): string {
    const name = safeTrim(p?.facultyName);
    if (name) return name;
    const idOrCode = safeTrim(p?.facultyId);
    if (!idOrCode) return '';
    const s =
      this.staffByCode?.[idOrCode] || this.staffById?.[idOrCode] || null;
    return s?.staffName ? `${safeTrim(s.staffName)} (${idOrCode})` : idOrCode;
  }

  resolveSubjectLabel(p: any): string {
    const code = safeTrim(p?.subjectCode);
    const name = safeTrim(p?.subjectName);
    if (name && code) return `${name} (${code})`;
    return name || code || '';
  }

  getStaffForSubject(subjectId: string): any[] {
    const id = safeTrim(subjectId);
    const pool = this.batchStaffFull.length
      ? this.batchStaffFull
      : this.staffFull;
    if (!id) return pool;
    const mapped = this.subjectIdToStaff.get(id) || [];
    const batchCodes = new Set(pool.map((s: any) => safeTrim(s?.staffCode)));
    const filtered = mapped.filter((s: any) =>
      batchCodes.has(safeTrim(s?.staffCode)),
    );
    return filtered.length ? filtered : pool;
  }

  getAllStaffForSubject(subjectId: string): any[] {
    const id = safeTrim(subjectId);
    if (!id) return this.staffFull;
    const mapped = this.subjectIdToStaff.get(id) || [];
    return mapped.length ? mapped : this.staffFull;
  }

  loadTimetable() {
    this.loading = true;
    this.commonApi
      .fetchData(
        {
          tenantId: this.tenantId,
          batchCode: this.batchCode,
          wkStartOn: this.currentWkStartOn,
        },
        this.moduleName,
        'view',
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (res: any) => {
          this.timetable = res?.data || null;
          this.timetableId = this.timetable._id;
          this.lastWeeklyTimetable = this.timetable;
          const wkStart = toInt(this.timetable?.wkStartOn, 0);
          if (wkStart && !this.fromDateStr) {
            this.fromDateStr = this.toISODateInput(wkStart);
            this.toDateStr = this.toISODateInput(
              wkStart + 6 * 24 * 60 * 60 * 1000,
            );
          }
          this.processSchedule();
          if (this.timetable?.batchCode) {
            this.loadPhases();
            this.loadBatchDetails(this.timetable.batchCode);
            this.loadWeekIndex(this.timetable.batchCode);
          }
        },
        error: (err: any) => {
          this.loading = false;
          this.timetable = null;
          if (err?.status !== 404) {
            this.alert.error(err?.error?.message || 'Failed to load timetable');
          }
          if (this.batchCode) {
            this.loadWeekIndex(this.batchCode);
            this.loadBatchDetails(this.batchCode);
          }
        },
      });
  }

  private buildWeekDateMap() {
    this.weekDateMap = {};
    const wkStartOn = toInt(this.timetable?.wkStartOn, 0);
    if (!wkStartOn) return;
    for (let i = 0; i < this.daysOrder.length; i++) {
      const dateMs = wkStartOn + i * 24 * 60 * 60 * 1000;
      this.weekDateMap[this.daysOrder[i]] = {
        dateMs,
        label: this.fmtDateLabel(dateMs),
      };
    }
  }

  processSchedule() {
    if (!this.timetable?.week) return;
    this.buildWeekDateMap();
    const weekMap = new Map<string, any>(
      (this.timetable.week || []).map((d: any) => [
        String(d.day || '').toUpperCase(),
        d,
      ]),
    );
    this.sortedSchedule = this.daysOrder.map((day) => {
      const periods = (weekMap.get(day)?.periods || [])
        .slice()
        .sort((a: any, b: any) => toInt(a.periodNo) - toInt(b.periodNo));
      const dateMs = this.weekDateMap?.[day]?.dateMs || 0;
      return {
        day,
        dateMs,
        dateLabel: this.weekDateMap?.[day]?.label || '-',
        periods,
        __isHoliday: this.isDayCancelled(dateMs, day),
      };
    });
    this.maxPeriods = this.computeMaxPeriods();
    if (this.maxPeriods <= 0) this.maxPeriods = 1;
    this.periodHeaders = Array.from(
      { length: this.maxPeriods },
      (_, i) => i + 1,
    );
  }

  private findDayOverride(dateMs: number, day: string, action?: string) {
    const ovs = Array.isArray(this.timetable?.dayOverrides)
      ? this.timetable.dayOverrides
      : [];
    const dayU = String(day || '').toUpperCase();
    return ovs.find((o: any) => {
      if (toInt(o?.date) !== toInt(dateMs)) return false;
      if (String(o?.day || '').toUpperCase() !== dayU) return false;
      if (action) return safeTrim(o?.action) === action;
      return true;
    });
  }

  private findPeriodOverride(
    dateMs: number,
    day: string,
    periodNo: number,
    action?: string,
  ) {
    const ovs = Array.isArray(this.timetable?.periodOverrides)
      ? this.timetable.periodOverrides
      : [];
    const dayU = String(day || '').toUpperCase();
    return ovs.find((o: any) => {
      if (toInt(o?.date) !== toInt(dateMs)) return false;
      if (String(o?.day || '').toUpperCase() !== dayU) return false;
      if (toInt(o?.periodNo) !== toInt(periodNo)) return false;
      if (action) return safeTrim(o?.action) === action;
      return true;
    });
  }

  isDayCancelled(dateMs: number, day: string): boolean {
    if (this.isDraft) {
      if (this.findDayOverride(dateMs, day, 'CANCEL_DAY')) return true;
      const dayData = (this.timetable?.week || []).find(
        (d: any) =>
          String(d?.day || '').toUpperCase() ===
          String(day || '').toUpperCase(),
      );
      const periods: any[] = dayData?.periods || [];
      if (dayData?.isCancelled === true) return true;
      if (
        periods.length > 0 &&
        periods.every((p: any) => p?.isCancelled === true)
      )
        return true;
      return false;
    }
    return !!this.findDayOverride(dateMs, day, 'CANCEL_DAY');
  }

  private getDayReplacementPeriods(dateMs: number, day: string): any[] | null {
    const ov = this.findDayOverride(dateMs, day, 'REPLACE_DAY');
    if (!ov) return null;
    const periods = ov?.periods;
    return Array.isArray(periods)
      ? periods
          .slice()
          .sort((a: any, b: any) => toInt(a.periodNo) - toInt(b.periodNo))
      : null;
  }

  private applyMoveOverrides(
    dateMs: number,
    day: string,
    baseMap: Map<number, any>,
  ) {
    const ovs = Array.isArray(this.timetable?.periodOverrides)
      ? this.timetable.periodOverrides
      : [];
    const dayU = String(day || '').toUpperCase();
    const moves = ovs.filter(
      (o: any) =>
        safeTrim(o?.action) === 'MOVE_PERIOD' &&
        toInt(o?.date) === toInt(dateMs) &&
        String(o?.day || '').toUpperCase() === dayU,
    );
    if (!moves.length) return;
    const snapshot = new Map<number, any>(baseMap);
    const applied = new Set<string>();
    for (const ov of moves) {
      const fromP = toInt(ov?.periodNo);
      const toP = toInt(ov?.toPeriodNo);
      if (!fromP || !toP || fromP === toP) continue;
      const pairKey = `${Math.min(fromP, toP)}-${Math.max(fromP, toP)}`;
      if (applied.has(pairKey)) continue;
      applied.add(pairKey);
      const srcPeriod = snapshot.get(fromP);
      const destPeriod = snapshot.get(toP);
      if (srcPeriod)
        baseMap.set(toP, {
          ...srcPeriod,
          periodNo: toP,
          time: destPeriod?.time ?? srcPeriod.time,
        });
      else baseMap.delete(toP);
      if (destPeriod)
        baseMap.set(fromP, {
          ...destPeriod,
          periodNo: fromP,
          time: srcPeriod?.time ?? destPeriod.time,
        });
      else baseMap.delete(fromP);
    }
  }

  getRenderedPeriod(dayRow: any, pNum: number): any {
    const day = String(dayRow?.day || '').toUpperCase();
    if (!day) return null;
    if (this.viewMode === 'range') {
      if (dayRow?.__isHoliday)
        return { __dayCancelled: true, isCancelled: true, time: {} };
      const list = Array.isArray(dayRow?.periods) ? dayRow.periods : [];
      return list.find((p: any) => toInt(p?.periodNo) === toInt(pNum)) || null;
    }
    if (this.isDraft) {
      if (this.isDayCancelled(toInt(dayRow?.dateMs), day))
        return { __dayCancelled: true, isCancelled: true, time: {} };
      const dayData = (this.timetable?.week || []).find(
        (d: any) => String(d?.day || '').toUpperCase() === day,
      );
      if (!dayData) return null;
      const period = (dayData.periods || []).find(
        (p: any) => toInt(p?.periodNo) === toInt(pNum),
      );
      return period || null;
    }
    const dateMs = toInt(dayRow?.dateMs);
    if (this.isDayCancelled(dateMs, day))
      return { __dayCancelled: true, isCancelled: true, time: {} };
    const replacedPeriods = this.getDayReplacementPeriods(dateMs, day);
    const basePeriods =
      replacedPeriods ?? (Array.isArray(dayRow?.periods) ? dayRow.periods : []);
    const baseMap = new Map<number, any>();
    basePeriods.forEach((p: any) => {
      const pn = toInt(p?.periodNo);
      if (pn) baseMap.set(pn, p);
    });
    this.applyMoveOverrides(dateMs, day, baseMap);
    const periodOvs = Array.isArray(this.timetable?.periodOverrides)
      ? this.timetable.periodOverrides
      : [];
    const dayU = String(day || '').toUpperCase();
    periodOvs
      .filter(
        (o: any) =>
          safeTrim(o?.action) === 'ADD_PERIOD' &&
          toInt(o?.date) === toInt(dateMs) &&
          String(o?.day || '').toUpperCase() === dayU &&
          o?.period != null,
      )
      .forEach((o: any) => {
        const addedPNo = toInt(o?.period?.periodNo || o?.periodNo);
        if (addedPNo) baseMap.set(addedPNo, { ...o.period, __added: true });
      });
    const cancelOv = this.findPeriodOverride(
      dateMs,
      day,
      pNum,
      'CANCEL_PERIOD',
    );
    const replaceOv = this.findPeriodOverride(
      dateMs,
      day,
      pNum,
      'REPLACE_PERIOD',
    );
    let result = baseMap.get(pNum) || null;
    if (cancelOv)
      return { ...result, isCancelled: true, cancelReason: cancelOv.reason };
    if (replaceOv) {
      const modifiedFields = (CONTENT_FIELDS as string[]).filter(
        (f) => replaceOv.period?.[f] !== result?.[f],
      );
      return {
        ...replaceOv.period,
        __modified: true,
        __modifiedFields: modifiedFields,
      };
    }
    return result;
  }

  private dateToEpochMs(s: any): number {
    const v = safeTrim(s);
    if (!v) return 0;
    const [yyyy, mm, dd] = v.split('-').map(Number);
    if (!yyyy || !mm || !dd) return 0;
    return Date.UTC(yyyy, mm - 1, dd);
  }

  private computeMaxPeriods(): number {
    let maxP = 0;
    (this.sortedSchedule || []).forEach((d: any) => {
      (d?.periods || []).forEach((p: any) => {
        maxP = Math.max(maxP, toInt(p?.periodNo));
      });
    });
    const dayOvs = Array.isArray(this.timetable?.dayOverrides)
      ? this.timetable.dayOverrides
      : [];
    dayOvs.forEach((o: any) => {
      (o?.periods || []).forEach((pp: any) => {
        maxP = Math.max(maxP, toInt(pp?.periodNo));
      });
    });
    const periodOvs = Array.isArray(this.timetable?.periodOverrides)
      ? this.timetable.periodOverrides
      : [];
    periodOvs.forEach((o: any) => {
      maxP = Math.max(maxP, toInt(o?.periodNo), toInt(o?.toPeriodNo));
      if (o?.period) maxP = Math.max(maxP, toInt(o.period?.periodNo));
    });
    return maxP;
  }

  private getAllRenderedPeriodsForDay(row: any): any[] {
    const result: any[] = [];
    for (const pNum of this.periodHeaders) {
      const p = this.getRenderedPeriod(row, pNum);
      if (p && !p.__dayCancelled && !p.isCancelled)
        result.push({ ...p, __slotNo: pNum });
    }
    return result;
  }

  back() {
    this.router.navigate(['/app/timetable']);
  }

  private loadWeekIndex(batchCode: string) {
    if (!batchCode) return;
    this.commonApi
      .fetchData(
        { entiId: this.tenantId, batchCode },
        this.moduleName,
        'list-by-batch',
      )
      .pipe(
        catchError(() => of({ data: [] })),
        takeUntil(this.destroy$),
      )
      .subscribe((res: any) => {
        const rows: any[] = res?.data || [];
        this.weekIndex = rows
          .filter((r: any) => toInt(r?.wkStartOn) > 0)
          .sort((a: any, b: any) => toInt(a.wkStartOn) - toInt(b.wkStartOn))
          .map((r: any) => ({
            wkStartOn: toInt(r.wkStartOn),
            _id: safeTrim(r._id),
            status: safeTrim(r.status),
          }));
        this.updateWeekNavFlags();
      });
  }

  private updateWeekNavFlags() {
    if (!this.weekIndex.length) {
      this.hasPrevWeek = false;
      this.hasNextWeek = false;
      return;
    }
    const cur = toInt(this.timetable?.wkStartOn, 0) || this.currentWkStartOn;
    let idx = this.weekIndex.findIndex(
      (w) => toInt(w.wkStartOn) === toInt(cur),
    );
    if (idx < 0) {
      const beforeCount = this.weekIndex.filter(
        (w) => toInt(w.wkStartOn) < toInt(cur),
      ).length;
      this.hasPrevWeek = beforeCount > 0;
      this.hasNextWeek = beforeCount < this.weekIndex.length;
      return;
    }
    this.hasPrevWeek = idx > 0;
    this.hasNextWeek = idx < this.weekIndex.length - 1;
  }

  get currentWeekLabel(): string {
    const wkStart = toInt(this.timetable?.wkStartOn, 0);
    if (!wkStart) return '';
    const wkEnd = wkStart + 6 * 24 * 60 * 60 * 1000;
    return `${this.fmtDateLabel(wkStart)} — ${this.fmtDateLabel(wkEnd)}`;
  }

  get currentWeekIndexDisplay(): string {
    const cur = toInt(this.timetable?.wkStartOn, 0);
    const idx = this.weekIndex.findIndex((w) => w.wkStartOn === cur);
    if (idx < 0 || !this.weekIndex.length) return '';
    return `Week ${idx + 1} of ${this.weekIndex.length}`;
  }

  navigateWeek(direction: 'prev' | 'next') {
    const cur = toInt(this.timetable?.wkStartOn, 0) || this.currentWkStartOn;
    let idx = this.weekIndex.findIndex(
      (w) => toInt(w.wkStartOn) === toInt(cur),
    );
    if (idx < 0) {
      const beforeCount = this.weekIndex.filter(
        (w) => toInt(w.wkStartOn) < toInt(cur),
      ).length;
      idx = direction === 'prev' ? beforeCount : beforeCount - 1;
    }
    const target =
      direction === 'prev' ? this.weekIndex[idx - 1] : this.weekIndex[idx + 1];
    if (!target) return;
    this.weekNavLoading = true;
    this.commonApi
      .fetchData(
        {
          tenantId: this.tenantId,
          batchCode: this.batchCode,
          wkStartOn: target.wkStartOn,
        },
        this.moduleName,
        'view',
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.weekNavLoading = false)),
      )
      .subscribe({
        next: (res: any) => {
          this.timetable = res?.data || null;
          this.timetableId = this.timetable?._id || '';
          this.currentWkStartOn = toInt(target.wkStartOn);
          this.lastWeeklyTimetable = this.timetable;
          this.viewMode = 'week';
          this.processSchedule();
          this.updateWeekNavFlags();
        },
        error: (err: any) => {
          if (err?.status === 404) {
            this.timetable = null;
            this.timetableId = '';
            this.currentWkStartOn = toInt(target.wkStartOn);
            this.lastWeeklyTimetable = null;
            this.viewMode = 'week';
            this.sortedSchedule = [];
            this.periodHeaders = [];
            this.updateWeekNavFlags();
          } else {
            this.alert.error(err?.error?.message || 'Failed to load week');
          }
        },
      });
  }

  actionKey(dayName: string, pNum: number): string {
    return `${dayName}_${pNum}`;
  }

  toggleActionMenu(key: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.openActionKey === key) {
      this.openActionKey = '';
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.actionMenuTop = rect.bottom + 4;
    this.actionMenuLeft = rect.right - 195;
    if (this.actionMenuLeft < 8) this.actionMenuLeft = 8;
    this.openActionKey = key;
  }

  closeActionMenu() {
    this.openActionKey = '';
  }
  isActionMenuOpen(key: string): boolean {
    return this.openActionKey === key;
  }

  confirmPublish() {
    this.showPublishConfirm = true;
  }

  cancelPublish() {
    this.showPublishConfirm = false;
  }

  confirmUnpublish() {
    this.showUnpublishConfirm = true;
  }

  cancelUnpublish() {
    this.showUnpublishConfirm = false;
  }

  submitPublish() {
    this.showPublishConfirm = false;
    this.loading = true;
    this.commonApi
      .fetchData(
        {
          tenantId: this.tenantId,
          timetableId: this.timetableId,
          userId: localStorage.getItem('userId'),
        },
        this.moduleName,
        'publish',
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Timetable published');
          this.loadTimetable();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Publish failed');
        },
      });
  }

  submitUnpublish() {
    this.showUnpublishConfirm = false;
    this.loading = true;
    this.commonApi
      .fetchData(
        {
          tenantId: this.tenantId,
          timetableId: this.timetableId,
          userId: localStorage.getItem('userId'),
        },
        this.moduleName,
        'unpublish',
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Reverted to Draft');
          this.loadTimetable();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Unpublish failed');
        },
      });
  }

  openCancelDay(row: any) {
    this.activeDay = row;
    this.cancelDayReason = 'Holiday';
    this.showCancelDay = true;
  }
  closeCancelDay() {
    this.showCancelDay = false;
    this.activeDay = null;
  }

  submitCancelDay() {
    if (!this.activeDay) return;
    const dateMs = toInt(this.activeDay.dateMs);
    if (!dateMs) {
      this.alert.error(
        'This day has no valid date. The timetable wkStartOn may not be set — please re-create this timetable.',
      );
      return;
    }
    this.loading = true;
    this.commonApi
      .fetchData(
        {
          tenantId: this.tenantId,
          timetableId: this.timetableId,
          date: dateMs,
          reason: safeTrim(this.cancelDayReason) || 'Holiday',
          userId: localStorage.getItem('userId'),
        },
        this.moduleName,
        'day/cancel',
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Holiday declared');
          this.closeCancelDay();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Failed to declare holiday');
        },
      });
  }

  // openEditDay(row: any) {
  //   this.activeDay = row;
  //   const day = String(row?.day || '').toUpperCase();
  //   let periodsToEdit: any[];
  //   if (this.isDraft) {
  //     const templateDay = (this.timetable?.week || []).find(
  //       (d: any) => String(d?.day || '').toUpperCase() === day,
  //     );
  //     periodsToEdit = (
  //       Array.isArray(templateDay?.periods) ? [...templateDay.periods] : []
  //     )
  //       .filter((p: any) => !p.isCancelled)
  //       .sort((a: any, b: any) => toInt(a.periodNo) - toInt(b.periodNo));
  //   } else {
  //     periodsToEdit = this.getAllRenderedPeriodsForDay(row).sort(
  //       (a: any, b: any) => toInt(a.__slotNo) - toInt(b.__slotNo),
  //     );
  //   }
  //   const mapped = periodsToEdit.map((p: any) => {
  //     const rawId = safeTrim(p.facultyId) || '';
  //     const staff = this.staffByCode[rawId] || this.staffById[rawId] || null;
  //     const startMin = toInt(p?.time?.startMin);
  //     const endMin = toInt(p?.time?.endMin);
  //     return {
  //       periodNo: toInt(p.periodNo || p.__slotNo || 0),
  //       startTime: minToTimeStr(startMin),
  //       endTime: minToTimeStr(endMin),
  //       startMin,
  //       endMin,
  //       periodType: p.periodType || 'LECTURE',
  //       mode: p.mode || 'OFFLINE',
  //       facultyId: staff ? safeTrim(staff.staffId) : rawId,
  //       facultyName: staff
  //         ? safeTrim(staff.staffName)
  //         : safeTrim(p.facultyName) || '',
  //       subjectCode: safeTrim(p.subjectCode) || '',
  //       subjectName: safeTrim(p.subjectName) || '',
  //       subjectId: safeTrim(p.subjectId) || '',
  //       phaseId: safeTrim(p.phaseId) || '',
  //       phaseName: safeTrim(p.phaseName) || '',
  //       topic: safeTrim(p.topic) || '',
  //       venue: safeTrim(p.venue) || '',
  //       zoomUrl: safeTrim(p.zoomUrl) || '',
  //       isCancelled: false,
  //     };
  //   });
  //   const uniqueSubjectIds = [
  //     ...new Set(
  //       mapped.map((ep: any) => safeTrim(ep.subjectId)).filter(Boolean),
  //     ),
  //   ];
  //   uniqueSubjectIds.forEach((sid) => this.loadPhasesForSubject(sid));
  //   this.editDayPeriods = mapped;
  //   this.editDayOriginalPeriods = mapped.map((ep) => ({ ...ep }));
  //   this.editDayConflicts = [];
  //   this.editDayDragIndex = null;
  //   this.editDayDragOverIndex = null;
  //   this.editDaySubmitAttempted = false;
  //   this.showEmptyDayConfirm = false;
  //   if (!this.editDayPeriods.length) this.addEditDayPeriod();
  //   this.showEditDay = true;
  // }

  openEditDay(row: any) {
    this.activeDay = row;
    const day = String(row?.day || '').toUpperCase();
    let periodsToEdit: any[];
    if (this.isDraft) {
      const templateDay = (this.timetable?.week || []).find(
        (d: any) => String(d?.day || '').toUpperCase() === day,
      );
      periodsToEdit = (
        Array.isArray(templateDay?.periods) ? [...templateDay.periods] : []
      )
        .filter((p: any) => !p.isCancelled)
        .sort((a: any, b: any) => toInt(a.periodNo) - toInt(b.periodNo));
    } else {
      periodsToEdit = this.getAllRenderedPeriodsForDay(row).sort(
        (a: any, b: any) => toInt(a.__slotNo) - toInt(b.__slotNo),
      );
    }
    const mapped = periodsToEdit.map((p: any) => {
      const rawId = safeTrim(p.facultyId) || '';
      const staff = this.staffByCode[rawId] || this.staffById[rawId] || null;
      const startMin = toInt(p?.time?.startMin);
      const endMin = toInt(p?.time?.endMin);
      return {
        periodNo: toInt(p.periodNo || p.__slotNo || 0),
        startTime: minToTimeStr(startMin),
        endTime: minToTimeStr(endMin),
        startMin,
        endMin,
        periodType: p.periodType || 'LECTURE',
        mode: p.mode || 'OFFLINE',
        facultyId: staff ? safeTrim(staff.staffId) : rawId,
        facultyName: staff
          ? safeTrim(staff.staffName)
          : safeTrim(p.facultyName) || '',
        subjectCode: safeTrim(p.subjectCode) || '',
        subjectName: safeTrim(p.subjectName) || '',
        subjectId: safeTrim(p.subjectId) || '',
        phaseId: safeTrim(p.phaseId) || '',
        phaseName: safeTrim(p.phaseName) || '',
        __phases: [],
        topic: safeTrim(p.topic) || '',
        venue: safeTrim(p.venue) || '',
        zoomUrl: safeTrim(p.zoomUrl) || '',
        isCancelled: false,
      };
    });
    // this.editDayPeriods = mapped;
    // this.editDayOriginalPeriods = mapped.map((ep) => ({ ...ep }));
    // this.editDayPeriods = mapped.map((ep: any) => ({
    //   ...ep,
    //   __phases: this.phasesPerSubject[ep.subjectId] || [],
    // }));
    // this.editDayOriginalPeriods = this.editDayPeriods.map((ep) => ({ ...ep }));
    this.editDayPeriods = mapped.map((ep: any) => {
      const phases = this.phasesPerSubject[ep.subjectId] || [];
      const phaseExists = phases.some(
        (ph: any) => safeTrim(ph.phaseId) === safeTrim(ep.phaseId),
      );
      return {
        ...ep,
        __phases: phases,
        phaseId: phaseExists ? ep.phaseId : '',
        phaseName: ep.phaseName,
      };
    });
    this.editDayOriginalPeriods = this.editDayPeriods.map((ep) => ({ ...ep }));
    this.editDayConflicts = [];
    this.editDayDragIndex = null;
    this.editDayDragOverIndex = null;
    this.editDaySubmitAttempted = false;
    this.showEmptyDayConfirm = false;
    if (!this.editDayPeriods.length) this.addEditDayPeriod();
    const uniqueSubjectIds = [
      ...new Set(
        mapped.map((ep: any) => safeTrim(ep.subjectId)).filter(Boolean),
      ),
    ] as string[];
    if (!uniqueSubjectIds.length) {
      this.showEditDay = true;
      return;
    }
    const toFetch = uniqueSubjectIds.filter(
      (sid) => !this.phasesPerSubject[sid],
    );
    if (!toFetch.length) {
      this.showEditDay = true;
      return;
    }
    forkJoin(
      toFetch.map((sid) =>
        this.commonApi
          .fetchData(
            { entiId: this.tenantId },
            'institue',
            `phase/list?classNo=${this.batchClassNo}&subjectId=${sid}&programId=${this.batchProgramId}`,
          )
          .pipe(
            catchError(() => of({ data: [] })),
            takeUntil(this.destroy$),
            map((res: any) => ({
              subjectId: sid,
              phases: Array.isArray(res) ? res : res?.data || [],
            })),
          ),
      ),
    ).subscribe({
      // next: (results: any[]) => {
      //   console.log('3. forkJoin results:', results);
      //   const newEntries: Record<string, any[]> = {};
      //   results.forEach((r) => {
      //     newEntries[r.subjectId] = r.phases;
      //   });
      //   this.phasesPerSubject = { ...this.phasesPerSubject, ...newEntries };
      //   this.editDayPeriods = this.editDayPeriods.map((ep: any) => ({
      //     ...ep,
      //     __phases:
      //       newEntries[ep.subjectId] ||
      //       this.phasesPerSubject[ep.subjectId] ||
      //       [],
      //   }));
      //   this.editDayOriginalPeriods = this.editDayPeriods.map((ep) => ({
      //     ...ep,
      //   }));
      //   this.showEditDay = true;
      // },
      next: (results: any[]) => {
        const newEntries: Record<string, any[]> = {};
        results.forEach((r) => {
          newEntries[r.subjectId] = r.phases;
        });
        this.phasesPerSubject = { ...this.phasesPerSubject, ...newEntries };
        this.editDayPeriods = this.editDayPeriods.map((ep: any) => {
          const phases =
            newEntries[ep.subjectId] ||
            this.phasesPerSubject[ep.subjectId] ||
            [];
          const phaseExists = phases.some(
            (ph: any) => safeTrim(ph.phaseId) === safeTrim(ep.phaseId),
          );
          console.log('ep.phaseId:', ep.phaseId, 'phaseExists:', phaseExists, 'phases:', phases.map((p:any) => p.phaseId));
          return {
            ...ep,
            __phases: phases,
            phaseId: phaseExists ? ep.phaseId : '',
            phaseName: phaseExists ? ep.phaseName : '',
          };
        });
        this.editDayOriginalPeriods = this.editDayPeriods.map((ep) => ({
          ...ep,
        }));
        this.showEditDay = true;
      },
      error: () => {
        this.showEditDay = true;
      },
    });
  }

  closeEditDay() {
    this.showEditDay = false;
    this.activeDay = null;
    this.editDayPeriods = [];
    this.editDayOriginalPeriods = [];
    this.editDayConflicts = [];
    this.editDayValidating = false;
    this.editDaySubmitAttempted = false;
    this.editDayDragIndex = null;
    this.editDayDragOverIndex = null;
    this.showEmptyDayConfirm = false;
    this.phasesPerSubject = {};
  }

  gripMouseDown(event: MouseEvent) {
    const rowEl = (event.target as HTMLElement).closest(
      '.edit-day-row',
    ) as HTMLElement | null;
    if (!rowEl) return;
    rowEl.setAttribute('draggable', 'true');
    const cleanup = () => {
      rowEl.removeAttribute('draggable');
      document.removeEventListener('mouseup', cleanup);
    };
    document.addEventListener('mouseup', cleanup);
  }

  onDragStart(event: DragEvent, index: number) {
    this.editDayDragIndex = index;
    this.editDayDragOverIndex = null;
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    const ghost = event.currentTarget as HTMLElement;
    event.dataTransfer?.setDragImage(ghost, 20, 20);
  }

  onDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (this.editDayDragIndex !== null && this.editDayDragIndex !== index) {
      this.editDayDragOverIndex = index;
    }
  }

  onDragLeave(event: DragEvent, index: number) {
    const rel = event.relatedTarget as HTMLElement;
    const row = event.currentTarget as HTMLElement;
    if (!row.contains(rel)) {
      if (this.editDayDragOverIndex === index) this.editDayDragOverIndex = null;
    }
  }

  onDragEnd() {
    this.editDayDragIndex = null;
    this.editDayDragOverIndex = null;
    document
      .querySelectorAll('.edit-day-row')
      .forEach((el) => el.removeAttribute('draggable'));
  }

  onDrop(event: DragEvent, targetIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    const fromIndex = this.editDayDragIndex;
    this.editDayDragIndex = null;
    this.editDayDragOverIndex = null;
    if (fromIndex === null || fromIndex === targetIndex) return;

    const arr = this.editDayPeriods;
    const fromContent = pickFields(arr[fromIndex], CONTENT_FIELDS);
    const toContent = pickFields(arr[targetIndex], CONTENT_FIELDS);
    CONTENT_FIELDS.forEach((f) => {
      arr[fromIndex][f] = toContent[f];
      arr[targetIndex][f] = fromContent[f];
    });
    this.editDayConflicts = [];
  }

  selectSlotForSwap(index: number) {
    if (this.editDayDragIndex === null) {
      this.editDayDragIndex = index;
    } else if (this.editDayDragIndex === index) {
      this.editDayDragIndex = null;
    } else {
      const fromIndex = this.editDayDragIndex;
      this.editDayDragIndex = null;
      const arr = this.editDayPeriods;
      const fromContent = pickFields(arr[fromIndex], CONTENT_FIELDS);
      const toContent = pickFields(arr[index], CONTENT_FIELDS);
      CONTENT_FIELDS.forEach((f) => {
        arr[fromIndex][f] = toContent[f];
        arr[index][f] = fromContent[f];
      });
      this.editDayConflicts = [];
    }
  }

  resetEditDayPeriods() {
    this.editDayPeriods = this.editDayOriginalPeriods.map((ep) => ({
      ...ep,
      __timeError: '',
    }));
    this.editDayConflicts = [];
    this.editDaySubmitAttempted = false;
  }

  addEditDayPeriod() {
    const last = this.editDayPeriods[this.editDayPeriods.length - 1];
    const defaultStart = last?.endTime || '';
    const defaultStartMin = last?.endMin || 0;
    this.editDayPeriods.push({
      periodNo: this.editDayPeriods.length + 1,
      startTime: defaultStart,
      endTime: '',
      startMin: defaultStartMin,
      endMin: 0,
      periodType: 'LECTURE',
      mode: 'OFFLINE',
      facultyId: '',
      facultyName: '',
      subjectCode: '',
      subjectName: '',
      subjectId: '',
      phaseId: '',
      phaseName: '',
      topic: '',
      venue: '',
      zoomUrl: '',
      isCancelled: false,
    });
    this.editDayConflicts = [];
  }

  removeEditDayPeriod(i: number) {
    this.editDayPeriods.splice(i, 1);
    this.editDayPeriods.forEach((ep, idx) => {
      ep.periodNo = idx + 1;
    });
    this.editDayConflicts = [];
  }

  onEditDayTimeChange(ep: any) {
    ep.startMin = timeStrToMin(ep.startTime);
    ep.endMin = timeStrToMin(ep.endTime);
    ep.__timeError = '';
    if (ep.startMin && ep.endMin && ep.endMin <= ep.startMin) {
      ep.__timeError = 'End time must be after start time';
    }
    if (!ep.__timeError && ep.startMin && ep.endMin) {
      for (const other of this.editDayPeriods) {
        if (other === ep) continue;
        if (!other.startMin || !other.endMin) continue;
        if (
          timesOverlap(ep.startMin, ep.endMin, other.startMin, other.endMin)
        ) {
          ep.__timeError = `Overlaps with ${other.startTime}–${other.endTime}`;
          break;
        }
      }
    }
    this.editDayConflicts = [];
  }

  onEditDayFacultyChange(ep: any) {
    const s = this.staffById[safeTrim(ep.facultyId)];
    ep.facultyName = s?.staffName || '';
    this.editDayConflicts = [];
  }

  // onEditDaySubjectChange(ep: any) {
  //   const sub = this.subjectByCode[safeTrim(ep.subjectCode)];
  //   ep.subjectName = sub?.subjectName || '';
  //   ep.subjectId = sub?._id || '';
  //   ep.facultyId = '';
  //   ep.facultyName = '';
  //   ep.topic = '';
  //   ep.phaseId = '';
  //   ep.phaseName = '';
  //   this.editDayConflicts = [];
  //   if (ep.subjectId) this.loadPhasesForSubject(ep.subjectId);
  // }

  onEditDaySubjectChange(ep: any) {
    const sub = this.subjectByCode[safeTrim(ep.subjectCode)];
    ep.subjectName = sub?.subjectName || '';
    ep.subjectId = sub?._id || '';
    ep.facultyId = '';
    ep.facultyName = '';
    ep.topic = '';
    ep.phaseId = '';
    ep.phaseName = '';
    ep.__phases = [];
    this.editDayConflicts = [];
    if (ep.subjectId) {
      if (this.phasesPerSubject[ep.subjectId]) {
        ep.__phases = this.phasesPerSubject[ep.subjectId];
      } else {
        this.commonApi
          .fetchData(
            { entiId: this.tenantId },
            'institue',
            `phase/list?classNo=${this.batchClassNo}&subjectId=${ep.subjectId}&programId=${this.batchProgramId}`,
          )
          .pipe(
            catchError(() => of({ data: [] })),
            takeUntil(this.destroy$),
          )
          .subscribe((res: any) => {
            const phases = Array.isArray(res) ? res : res?.data || [];
            this.phasesPerSubject = {
              ...this.phasesPerSubject,
              [ep.subjectId]: phases,
            };
            ep.__phases = phases;
          });
      }
    }
  }

  // onEditDayPhaseChange(ep: any) {
  //   const ph = this.phasesFull.find(
  //     (p: any) => safeTrim(p?.phaseId) === safeTrim(ep.phaseId),
  //   );
  //   ep.phaseName = ph?.phaseName || '';
  //   this.editDayConflicts = [];
  // }

  onEditDayPhaseChange(ep: any) {
    const ph = (ep.__phases || []).find(
      (p: any) => safeTrim(p?.phaseId) === safeTrim(ep.phaseId),
    );
    ep.phaseName = ph?.phaseName || '';
    this.editDayConflicts = [];
  }

  onEditDayModeChange(ep: any) {
    if (ep.mode === 'OFFLINE') ep.zoomUrl = '';
    this.editDayConflicts = [];
  }

  private validateNoOverlaps(periods: any[]): string | null {
    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        const a = periods[i],
          b = periods[j];
        if (timesOverlap(a.startMin, a.endMin, b.startMin, b.endMin)) {
          return `Period ${i + 1} (${a.startTime}–${a.endTime}) overlaps with Period ${j + 1} (${b.startTime}–${b.endTime})`;
        }
      }
    }
    return null;
  }

  getRpStaffList(): { code: string; name: string; id: string }[] {
    if (!this.rp?.subjectId) return [];
    return this.batchStaffMap
      .filter(
        (sm: any) => safeTrim(sm?.subjectId) === safeTrim(this.rp.subjectId),
      )
      .map((sm: any) => {
        const rec = this.staffById[safeTrim(sm.staffId)] || null;
        const code = rec ? safeTrim(rec.staffCode) : safeTrim(sm.staffId);
        const name = rec
          ? safeTrim(rec.staffName)
          : safeTrim(sm.staffName) || code;
        return { code, name, id: safeTrim(rec?.staffId || sm.staffId) };
      });
  }

  private buildEditDayPayloadPeriods(): any[] | null {
    this.editDaySubmitAttempted = true;
    for (let i = 0; i < this.editDayPeriods.length; i++) {
      const ep = this.editDayPeriods[i];
      if (!ep.startTime || !ep.endTime) {
        this.alert.error(`Period ${i + 1}: start and end time are required`);
        return null;
      }
      if (ep.__timeError) {
        this.alert.error(`Period ${i + 1}: ${ep.__timeError}`);
        return null;
      }
      const startMin = timeStrToMin(ep.startTime);
      const endMin = timeStrToMin(ep.endTime);
      if (endMin <= startMin) {
        this.alert.error(`Period ${i + 1}: end time must be after start time`);
        return null;
      }
      if (!safeTrim(ep.facultyId)) {
        this.alert.error(`Period ${i + 1}: faculty is required`);
        return null;
      }
    }
    const overlapError = this.validateNoOverlaps(
      this.editDayPeriods.map((ep) => ({
        startMin: timeStrToMin(ep.startTime),
        endMin: timeStrToMin(ep.endTime),
        startTime: ep.startTime,
        endTime: ep.endTime,
      })),
    );
    if (overlapError) {
      this.alert.error(overlapError);
      return null;
    }

    return this.editDayPeriods.map((ep: any, idx: number) => {
      const startMin = timeStrToMin(ep.startTime);
      const endMin = timeStrToMin(ep.endTime);
      return {
        periodNo: idx + 1,
        time: {
          startMin,
          endMin,
          startLabel: minToLabel(startMin),
          endLabel: minToLabel(endMin),
        },
        periodType: ep.periodType || 'LECTURE',
        mode: ep.mode || 'OFFLINE',
        zoomUrl: ep.mode === 'ONLINE' ? safeTrim(ep.zoomUrl) || null : null,
        facultyId: safeTrim(ep.facultyId),
        facultyName: safeTrim(ep.facultyName) || null,
        subjectCode: safeTrim(ep.subjectCode) || null,
        subjectName: safeTrim(ep.subjectName) || null,
        subjectId: safeTrim(ep.subjectId) || null,
        // phaseId: safeTrim(ep.phaseId) || null,
        // phaseName: safeTrim(ep.phaseName) || null,
        phaseId: safeTrim(ep.phaseId) || null,
        phaseName: safeTrim(ep.phaseId)
          ? safeTrim(ep.phaseName) || null
          : safeTrim(ep.phaseName) || null,
        topic: safeTrim(ep.topic) || null,
        venue: safeTrim(ep.venue) || null,
        isCancelled: false,
      };
    });
  }

  submitEditDay() {
    if (!this.activeDay) return;
    if (!this.editDayPeriods.length) {
      this.showEmptyDayConfirm = true;
      return;
    }
    this.showEmptyDayConfirm = false;
    const periods = this.buildEditDayPayloadPeriods();
    if (!periods) return;
    const day = String(this.activeDay.day || '').toUpperCase();
    const dateMs = toInt(this.activeDay.dateMs);
    const payload: any = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      day,
      periods,
      userId: localStorage.getItem('userId'),
    };
    if (this.isPublished) {
      if (!dateMs) {
        this.alert.error('Cannot determine date for this day.');
        return;
      }
      payload.date = dateMs;
      this.doSubmitEditDay(payload);
    } else {
      this.doSubmitEditDay(payload);
    }
  }

  confirmEmptyDay() {
    this.showEmptyDayConfirm = false;
    const payload: any = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      day: String(this.activeDay.day || '').toUpperCase(),
      periods: [],
      userId: localStorage.getItem('userId'),
    };
    const dateMs = toInt(this.activeDay.dateMs);
    if (this.isPublished && dateMs) payload.date = dateMs;
    this.doSubmitEditDay(payload);
  }

  private doSubmitEditDay(payload: any) {
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'day/edit')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Day schedule updated');
          this.closeEditDay();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Failed to update day');
        },
      });
  }

  openCancelPeriod(row: any, pNum: number) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum);
    this.activePeriod = this.getRenderedPeriod(row, pNum);
    this.cancelPeriodReason = 'Cancelled';
    this.showCancelPeriod = true;
  }

  closeCancelPeriod() {
    this.showCancelPeriod = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
    this.activePeriod = null;
  }

  submitCancelPeriod() {
    if (!this.activeDay || !this.activePeriodNo) return;
    const day = String(this.activeDay.day || '').toUpperCase();
    const dateMs = toInt(this.activeDay.dateMs);
    if (this.isPublished && !dateMs) {
      this.alert.error('Cannot determine date for this day.');
      return;
    }
    const payload: any = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      day,
      periodNo: toInt(this.activePeriodNo),
      reason: safeTrim(this.cancelPeriodReason) || 'Cancelled',
      userId: localStorage.getItem('userId'),
    };
    if (this.isPublished) payload.date = dateMs;
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'period/cancel')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Period cancelled');
          this.closeCancelPeriod();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Cancel failed');
        },
      });
  }

  openRearrangeStaff(row: any, pNum: number) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum);
    this.activePeriod = this.getRenderedPeriod(row, pNum);
    this.activeSubjectId = safeTrim(this.activePeriod?.subjectId) || '';
    this.newFacultyId = '';
    this.newFacultyName = '';
    this.showRearrangeStaff = true;
  }

  closeRearrangeStaff() {
    this.showRearrangeStaff = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
    this.activePeriod = null;
    this.newFacultyId = '';
    this.newFacultyName = '';
    this.activeSubjectId = '';
  }

  onNewFacultySelected() {
    const s = this.staffById[safeTrim(this.newFacultyId)];
    this.newFacultyName = s?.staffName || '';
  }

  submitRearrangeStaff() {
    if (!this.activeDay || !this.activePeriodNo || !safeTrim(this.newFacultyId))
      return;
    const day = String(this.activeDay.day || '').toUpperCase();
    const dateMs = toInt(this.activeDay.dateMs);
    if (this.isPublished && !dateMs) {
      this.alert.error('Cannot determine date for this day.');
      return;
    }
    const payload: any = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      day,
      periodNo: toInt(this.activePeriodNo),
      newFacultyId: safeTrim(this.newFacultyId),
      newFacultyName: safeTrim(this.newFacultyName),
      userId: localStorage.getItem('userId'),
    };
    if (this.isPublished) payload.date = dateMs;
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'period/rearrange-staff')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Staff updated');
          this.closeRearrangeStaff();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Staff change failed');
        },
      });
  }

  openMovePeriod(row: any, pNum: number) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum);
    this.activePeriod = this.getRenderedPeriod(row, pNum);
    this.moveToPeriodNo = null;
    this.availablePeriodSlots = this.periodHeaders.filter(
      (n) => n !== toInt(pNum),
    );
    this.showMovePeriod = true;
  }

  closeMovePeriod() {
    this.showMovePeriod = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
    this.activePeriod = null;
    this.moveToPeriodNo = null;
  }

  getMoveSlotPreview(pNum: number): any {
    if (!this.activeDay) return null;
    return this.getRenderedPeriod(this.activeDay, pNum);
  }

  submitMovePeriod() {
    if (!this.activeDay || !this.activePeriodNo || !this.moveToPeriodNo) return;
    const day = String(this.activeDay.day || '').toUpperCase();
    const dateMs = toInt(this.activeDay.dateMs);
    if (this.isPublished && !dateMs) {
      this.alert.error('Cannot determine date for this day.');
      return;
    }
    const payload: any = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      day,
      fromPeriodNo: toInt(this.activePeriodNo),
      toPeriodNo: toInt(this.moveToPeriodNo),
      userId: localStorage.getItem('userId'),
    };
    if (this.isPublished) payload.date = dateMs;
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'period/move')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Period moved');
          this.closeMovePeriod();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Move failed');
        },
      });
  }

  openReplacePeriod(row: any, pNum: number) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum);
    const p = this.getRenderedPeriod(row, pNum) || {};
    this.activePeriod = p;
    const rawId = safeTrim(p.facultyId) || '';
    const staff = this.staffByCode[rawId] || this.staffById[rawId] || null;
    this.rp = {
      facultyId: staff ? safeTrim(staff.staffId) : rawId,
      facultyName: staff
        ? safeTrim(staff.staffName)
        : safeTrim(p.facultyName) || '',
      subjectCode: safeTrim(p.subjectCode) || '',
      subjectName: safeTrim(p.subjectName) || '',
      subjectId: safeTrim(p.subjectId) || '',
      venue: safeTrim(p.venue) || '',
      topic: safeTrim(p.topic) || '',
      periodType: safeTrim(p.periodType) || 'LECTURE',
      mode: safeTrim(p.mode) || 'OFFLINE',
      zoomUrl: safeTrim(p.zoomUrl) || '',
      phaseId: safeTrim(p.phaseId) || '',
      phaseName: safeTrim(p.phaseName) || '',
      _startMin: toInt(p?.time?.startMin),
      _endMin: toInt(p?.time?.endMin),
      _startLabel: p?.time?.startLabel || minToLabel(toInt(p?.time?.startMin)),
      _endLabel: p?.time?.endLabel || minToLabel(toInt(p?.time?.endMin)),
    };
    this.showReplacePeriod = true;
  }

  closeReplacePeriod() {
    this.showReplacePeriod = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
    this.activePeriod = null;
    this.rpPhases = [];
    this.rp = {
      facultyId: '',
      facultyName: '',
      subjectCode: '',
      subjectName: '',
      subjectId: '',
      venue: '',
      topic: '',
      periodType: '',
      mode: '',
      zoomUrl: '',
      phaseId: '',
      phaseName: '',
      _startMin: 0,
      _endMin: 0,
      _startLabel: '',
      _endLabel: '',
    };
  }

  onReplaceFacultySelected() {
    const s = this.staffById[safeTrim(this.rp?.facultyId)];
    this.rp.facultyName = s?.staffName || '';
  }

  onReplaceSubjectSelected() {
    const sub = this.subjectByCode[safeTrim(this.rp?.subjectCode)];
    this.rp.subjectName = sub?.subjectName || '';
    this.rp.subjectId = sub?._id || '';
    this.rp.facultyId = '';
    this.rp.facultyName = '';
    this.rp.topic = '';
    this.rp.phaseId = '';
    this.rp.phaseName = '';
    this.rpPhases = [];
    if (this.rp.subjectId) {
      const mapped = this.batchStaffMap.find(
        (sm: any) => safeTrim(sm?.subjectId) === safeTrim(this.rp.subjectId),
      );
      if (mapped) {
        const staffRec = this.staffById[safeTrim(mapped.staffId)] || null;
        // this.rp.facultyId = staffRec
        //   ? safeTrim(staffRec.staffCode)
        //   : safeTrim(mapped.staffId);
        this.rp.facultyId = staffRec
          ? safeTrim(staffRec.staffId)
          : safeTrim(mapped.staffId);
        this.rp.facultyName = staffRec
          ? safeTrim(staffRec.staffName)
          : safeTrim(mapped.staffName) || '';
      }
      this.loadRpPhases(this.rp.subjectId);
    }
  }

  onReplacePhaseSelected() {
    const ph = this.rpPhases.find(
      (p: any) => safeTrim(p?.phaseId) === safeTrim(this.rp.phaseId),
    );
    this.rp.phaseName = ph?.phaseName || '';
  }

  get rpPhasesFiltered(): any[] {
    return this.phasesFull.filter((ph: any) => {
      const matchProgram =
        !this.batchProgramId || safeTrim(ph?.programId) === this.batchProgramId;
      const matchClass =
        !this.batchClassNo || toInt(ph?.classNo) === this.batchClassNo;
      const matchSubject =
        !this.rp?.subjectId ||
        safeTrim(ph?.subjectId?._id || ph?.subjectId) ===
          safeTrim(this.rp.subjectId);
      return matchProgram && matchClass && matchSubject;
    });
  }

  onReplaceModeChange() {
    if (this.rp.mode === 'OFFLINE') this.rp.zoomUrl = '';
  }

  submitReplacePeriod() {
    if (!this.activeDay || !this.activePeriodNo) return;
    const day = String(this.activeDay.day || '').toUpperCase();
    const dateMs = toInt(this.activeDay.dateMs);
    if (this.isPublished && !dateMs) {
      this.alert.error('Cannot determine date for this day.');
      return;
    }
    const period: any = {
      periodType: safeTrim(this.rp.periodType) || 'LECTURE',
      mode: safeTrim(this.rp.mode) || 'OFFLINE',
    };
    if (safeTrim(this.rp.facultyId)) {
      period.facultyId = safeTrim(this.rp.facultyId);
      period.facultyName = safeTrim(this.rp.facultyName) || null;
    }
    if (safeTrim(this.rp.subjectCode)) {
      period.subjectCode = safeTrim(this.rp.subjectCode);
      period.subjectName = safeTrim(this.rp.subjectName) || null;
      period.subjectId = safeTrim(this.rp.subjectId) || null;
    }
    if (safeTrim(this.rp.venue)) period.venue = safeTrim(this.rp.venue);
    if (safeTrim(this.rp.topic)) period.topic = safeTrim(this.rp.topic);
    if (safeTrim(this.rp.phaseId)) {
      period.phaseId = safeTrim(this.rp.phaseId);
      period.phaseName = safeTrim(this.rp.phaseName) || null;
    }
    period.zoomUrl =
      this.rp.mode === 'ONLINE' ? safeTrim(this.rp.zoomUrl) || null : null;
    const payload: any = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      day,
      periodNo: toInt(this.activePeriodNo),
      period,
      userId: localStorage.getItem('userId'),
    };
    if (this.isPublished) payload.date = dateMs;
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'period/replace')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Period updated');
          this.closeReplacePeriod();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Replace failed');
        },
      });
  }

  openSetZoom(row: any, pNum: number, period: any) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum);
    this.activePeriod = period;
    this.zoomUrlInput = safeTrim(period?.zoomUrl) || '';
    this.showSetZoom = true;
  }

  closeSetZoom() {
    this.showSetZoom = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
    this.activePeriod = null;
    this.zoomUrlInput = '';
  }

  submitSetZoom() {
    if (!this.activeDay || !this.activePeriodNo) return;
    const day = String(this.activeDay.day || '').toUpperCase();
    const dateMs = toInt(this.activeDay.dateMs);
    const payload: any = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      day,
      periodNo: toInt(this.activePeriodNo),
      zoomUrl: safeTrim(this.zoomUrlInput) || '',
      userId: localStorage.getItem('userId'),
    };
    if (this.isPublished) payload.date = dateMs;
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'update/zoomlink')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Zoom link saved');
          this.closeSetZoom();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Zoom update failed');
        },
      });
  }

  openConvertToExam(row: any, pNum: number, period: any) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum);
    this.activePeriod = period;
    this.examForm = {
      examId: '',
      examDescription: '',
      facultyId: safeTrim(period?.facultyId) || '',
      facultyName: safeTrim(period?.facultyName) || '',
      venue: safeTrim(period?.venue) || '',
      topic: safeTrim(period?.topic) || '',
    };
    this.showConvertConfirm = true;
  }

  confirmConvertToExam() {
    this.showConvertConfirm = false;
    this.showConvertToExam = true;
  }

  cancelConvertConfirm() {
    this.showConvertConfirm = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
    this.activePeriod = null;
  }

  closeConvertToExam() {
    this.showConvertToExam = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
    this.activePeriod = null;
    this.examForm = {
      examId: '',
      examDescription: '',
      facultyId: '',
      facultyName: '',
      venue: '',
      topic: '',
    };
  }

  onExamFacultySelected() {
    const s = this.staffByCode[safeTrim(this.examForm.facultyId)];
    this.examForm.facultyName = s?.staffName || '';
  }

  submitConvertToExam() {
    if (!this.activeDay || !this.activePeriodNo) return;
    const day = String(this.activeDay.day || '').toUpperCase();
    const dateMs = toInt(this.activeDay.dateMs);
    const payload: any = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      day,
      periodNo: toInt(this.activePeriodNo),
      userId: localStorage.getItem('userId'),
    };
    if (this.isPublished) payload.date = dateMs;
    if (safeTrim(this.examForm.examId))
      payload.examId = safeTrim(this.examForm.examId);
    if (safeTrim(this.examForm.examDescription))
      payload.examDescription = safeTrim(this.examForm.examDescription);
    if (safeTrim(this.examForm.facultyId)) {
      payload.facultyId = safeTrim(this.examForm.facultyId);
      payload.facultyName = safeTrim(this.examForm.facultyName) || null;
    }
    if (safeTrim(this.examForm.venue))
      payload.venue = safeTrim(this.examForm.venue);
    if (safeTrim(this.examForm.topic))
      payload.topic = safeTrim(this.examForm.topic);
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'convertToExam')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Period converted to Exam');
          this.closeConvertToExam();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Convert failed');
        },
      });
  }

  toggleRangeView() {
    if (this.viewMode === 'range') this.resetToWeekly();
    else {
      this.viewMode = 'range';
      this.rangeMetaLabel = '';
    }
  }

  resetToWeekly() {
    this.viewMode = 'week';
    this.rangeMetaLabel = '';
    if (this.lastWeeklyTimetable) {
      this.timetable = this.lastWeeklyTimetable;
      this.processSchedule();
    } else this.loadTimetable();
  }

  loadByRange() {
    const fromMs = this.toStartOfDayMs(this.fromDateStr);
    const toMs = this.toStartOfDayMs(this.toDateStr) || fromMs;
    const batchCode = safeTrim(
      this.lastWeeklyTimetable?.batchCode || this.timetable?.batchCode,
    );
    if (!fromMs || !batchCode) {
      this.alert.warning('Please select From Date');
      return;
    }
    this.loading = true;
    this.commonApi
      .fetchData(
        { tenantId: this.tenantId, batchCode, fromDate: fromMs, toDate: toMs },
        this.moduleName,
        'viewbybatch',
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (res: any) => {
          const schedule = Array.isArray(res?.data) ? res.data : [];
          if (!schedule.length)
            this.alert.warning('No schedule found for selected range');
          this.sortedSchedule = schedule.map((d: any) => ({
            day: String(d?.day || '').toUpperCase(),
            dateMs: toInt(d?.date),
            dateLabel: this.fmtDateLabel(toInt(d?.date)),
            periods: Array.isArray(d?.periods) ? d.periods.slice() : [],
            __isHoliday: d?.isHoliday === true,
            __holidayReason: safeTrim(d?.holidayReason),
          }));
          let maxP = 0;
          this.sortedSchedule.forEach((r: any) => {
            (r?.periods || []).forEach((p: any) => {
              maxP = Math.max(maxP, toInt(p?.periodNo));
            });
          });
          this.maxPeriods = maxP <= 0 ? 1 : maxP;
          this.periodHeaders = Array.from(
            { length: this.maxPeriods },
            (_, i) => i + 1,
          );
          this.rangeMetaLabel = `${batchCode} • ${this.fromDateStr}${this.toDateStr ? ' → ' + this.toDateStr : ''}`;
        },
        error: (err: any) => {
          this.alert.error(
            err?.error?.message || 'Failed to load range schedule',
          );
        },
      });
  }

  // getEditDayPhasesForPeriod(ep: any): any[] {
  //   if (!ep?.subjectId || !this.batchProgramId || !this.batchClassNo) return [];
  //   return this.phasesFull.filter(
  //     (ph: any) =>
  //       safeTrim(ph?.programId) === this.batchProgramId &&
  //       toInt(ph?.classNo) === this.batchClassNo &&
  //       safeTrim(ph?.subjectId?._id || ph?.subjectId) ===
  //         safeTrim(ep.subjectId),
  //   );
  // }

  getEditDayPhasesForPeriod(ep: any): any[] {
    const id = safeTrim(ep?.subjectId);
    console.log('getEditDayPhasesForPeriod', id, this.phasesPerSubject[id]);
    if (!id) return [];
    return this.phasesPerSubject[id] || [];
  }

  openStaffLateEntry(row: any, pNum: number, period: any) {
    const dateMs = toInt(row?.dateMs);
    this.staffLateEntry = {
      timetableId: safeTrim(this.timetableId),
      periodNo: toInt(pNum),
      facultyId: safeTrim(period?.facultyId),
      facultyName:
        safeTrim(period?.facultyName) || this.resolveFacultyLabel(period),
      scheduledStartMin: toInt(period?.time?.startMin),
      startLabel: period?.time?.startLabel || '',
      endLabel: period?.time?.endLabel || '',
      batchCode: safeTrim(this.timetable?.batchCode || this.batchCode),
      dateMs,
      delayMinutes: 0,
      reason: '',
      entryType: 'LATE',
    };
    this.showStaffLateModal = true;
    this.closeActionMenu();
  }

  closeStaffLateModal() {
    this.showStaffLateModal = false;
  }

  submitStaffLateEntry() {
    if (this.loading) return;
    const e = this.staffLateEntry;
    if (!e.delayMinutes || e.delayMinutes <= 0) {
      this.alert.error('Enter delay minutes');
      return;
    }
    if (!e.dateMs) {
      this.alert.error('Date not available for this period');
      return;
    }
    const payload = {
      tenantId: this.tenantId,
      type: 'STAFF',
      personId: e.facultyId,
      personName: e.facultyName,
      timetableId: e.timetableId,
      batchCode: e.batchCode,
      date: e.dateMs,
      periodNo: e.periodNo,
      scheduledStartMin: e.scheduledStartMin,
      delayMinutes: Number(e.delayMinutes),
      entryType: safeTrim(e.entryType) || 'LATE',
      reason: safeTrim(e.reason) || null,
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, 'timetable', 'late-entry/log')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (res: any) => {
          this.alert.success(res?.message || 'Late entry logged');
          this.closeStaffLateModal();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Failed to log');
        },
      });
  }

  openSpecialClass(row: any) {
    this.activeDay = row;
    this.sc = {
      periodNo: this.maxPeriods + 1,
      startTime: '',
      endTime: '',
      periodType: 'LECTURE',
      mode: 'OFFLINE',
      subjectCode: '',
      subjectName: '',
      subjectId: '',
      facultyId: '',
      facultyName: '',
      phaseId: '',
      phaseName: '',
      topic: '',
      venue: '',
      zoomUrl: '',
      __timeError: '',
    };
    this.scPhases = [];
    this.specialClassConflict = '';
    this.showSpecialClass = true;
  }

  closeSpecialClass() {
    this.showSpecialClass = false;
    this.activeDay = null;
    this.scPhases = [];
    this.specialClassConflict = '';
    this.sc = {
      periodNo: null,
      startTime: '',
      endTime: '',
      periodType: 'LECTURE',
      mode: 'OFFLINE',
      subjectCode: '',
      subjectName: '',
      subjectId: '',
      facultyId: '',
      facultyName: '',
      phaseId: '',
      phaseName: '',
      topic: '',
      venue: '',
      zoomUrl: '',
      __timeError: '',
    };
  }

  onSpecialClassTimeChange() {
    this.sc.__timeError = '';
    this.specialClassConflict = '';
    if (!this.sc.startTime || !this.sc.endTime) return;
    const startMin = timeStrToMin(this.sc.startTime);
    const endMin = timeStrToMin(this.sc.endTime);
    if (endMin <= startMin) {
      this.sc.__timeError = 'End time must be after start time';
      return;
    }
    if (!this.activeDay) return;
    const day = String(this.activeDay.day || '').toUpperCase();
    for (const pNum of this.periodHeaders) {
      const p = this.getRenderedPeriod(this.activeDay, pNum);
      if (!p || p.__dayCancelled || p.isCancelled) continue;
      const pStart = toInt(p?.time?.startMin);
      const pEnd = toInt(p?.time?.endMin);
      if (!pStart || !pEnd) continue;
      if (timesOverlap(startMin, endMin, pStart, pEnd)) {
        this.specialClassConflict = `Time conflicts with Period ${pNum} (${p.time?.startLabel} – ${p.time?.endLabel})`;
        return;
      }
    }
  }

  onSpecialClassSubjectChange() {
    const sub = this.subjectByCode[safeTrim(this.sc.subjectCode)];
    this.sc.subjectName = sub?.subjectName || '';
    this.sc.subjectId = sub?._id || '';
    this.sc.facultyId = '';
    this.sc.facultyName = '';
    this.sc.phaseId = '';
    this.sc.phaseName = '';
    this.scPhases = [];
    this.specialClassConflict = '';
    if (this.sc.subjectId) {
      const mapped = this.batchStaffMap.find(
        (sm: any) => safeTrim(sm?.subjectId) === safeTrim(this.sc.subjectId),
      );
      if (mapped) {
        const staffRec = this.staffById[safeTrim(mapped.staffId)] || null;
        this.sc.facultyId = staffRec
          ? safeTrim(staffRec.staffId)
          : safeTrim(mapped.staffId);
        this.sc.facultyName = staffRec
          ? safeTrim(staffRec.staffName)
          : safeTrim(mapped.staffName) || '';
      }
      this.loadScPhases(this.sc.subjectId);
    }
  }

  onSpecialClassFacultyChange() {
    const s = this.staffById[safeTrim(this.sc.facultyId)];
    this.sc.facultyName = s?.staffName || '';
  }

  onSpecialClassPhaseChange() {
    const ph = this.scPhases.find(
      (p: any) => safeTrim(p?.phaseId) === safeTrim(this.sc.phaseId),
    );
    this.sc.phaseName = ph?.phaseName || '';
  }

  private loadScPhases(subjectId: string) {
    if (!subjectId || !this.batchProgramId || !this.batchClassNo) return;
    this.commonApi
      .fetchData(
        { entiId: this.tenantId },
        'institue',
        `phase/list?classNo=${this.batchClassNo}&subjectId=${subjectId}&programId=${this.batchProgramId}`,
      )
      .pipe(
        catchError(() => of({ data: [] })),
        takeUntil(this.destroy$),
      )
      .subscribe((res: any) => {
        this.scPhases = Array.isArray(res) ? res : res?.data || [];
      });
  }

  submitSpecialClass() {
    if (!this.activeDay) return;
    if (!this.sc.periodNo || this.sc.periodNo < 1) {
      this.alert.error('Period No is required');
      return;
    }
    if (!this.sc.startTime || !this.sc.endTime) {
      this.alert.error('Start and end time are required');
      return;
    }
    if (this.sc.__timeError) {
      this.alert.error(this.sc.__timeError);
      return;
    }
    if (this.specialClassConflict) {
      this.alert.error(this.specialClassConflict);
      return;
    }
    if (!safeTrim(this.sc.facultyId)) {
      this.alert.error('Faculty is required');
      return;
    }
    const startMin = timeStrToMin(this.sc.startTime);
    const endMin = timeStrToMin(this.sc.endTime);
    const dateMs = toInt(this.activeDay.dateMs);
    const period: any = {
      periodNo: toInt(this.sc.periodNo),
      periodType: safeTrim(this.sc.periodType) || 'LECTURE',
      mode: safeTrim(this.sc.mode) || 'OFFLINE',
      facultyId: safeTrim(this.sc.facultyId),
      facultyName: safeTrim(this.sc.facultyName) || null,
      subjectCode: safeTrim(this.sc.subjectCode) || null,
      subjectName: safeTrim(this.sc.subjectName) || null,
      subjectId: safeTrim(this.sc.subjectId) || null,
      phaseId: safeTrim(this.sc.phaseId) || null,
      phaseName: safeTrim(this.sc.phaseName) || null,
      topic: safeTrim(this.sc.topic) || null,
      venue: safeTrim(this.sc.venue) || null,
      zoomUrl:
        this.sc.mode === 'ONLINE' ? safeTrim(this.sc.zoomUrl) || null : null,
      time: {
        startMin,
        endMin,
        startLabel: minToLabel(startMin),
        endLabel: minToLabel(endMin),
      },
    };
    const payload: any = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      batchCode: safeTrim(this.timetable?.batchCode || this.batchCode),
      date: dateMs,
      day: String(this.activeDay.day || '').toUpperCase(),
      period,
      userId: localStorage.getItem('userId'),
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'period/add')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Special class added');
          this.closeSpecialClass();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.alert.error(
            err?.error?.message || 'Failed to add special class',
          );
        },
      });
  }

  confirmCloneWeek() {
    this.showCloneConfirm = true;
  }

  cancelCloneWeek() {
    this.showCloneConfirm = false;
    this.cloneResult = null;
  }

  submitCloneWeek() {
    this.showCloneConfirm = false;
    this.loading = true;
    this.commonApi
      .fetchData(
        {
          tenantId: this.tenantId,
          timetableId: this.timetableId,
          userId: localStorage.getItem('userId'),
        },
        this.moduleName,
        'clone-week',
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (res: any) => {
          this.cloneResult = res?.data || null;
          this.alert.success(res?.message || 'Week cloned successfully');
          this.loadWeekIndex(this.batchCode);
        },
        error: (err: any) => {
          const conflicts = err?.error?.conflicts;
          if (Array.isArray(conflicts) && conflicts.length) {
            this.alert.error(
              `Clone blocked: ${conflicts.length} issue(s) — ${conflicts[0]?.message}`,
            );
          } else {
            this.alert.error(err?.error?.message || 'Clone failed');
          }
        },
      });
  }

  submitUncancelDay(row: any) {
    const dateMs = toInt(row.dateMs);
    if (!dateMs) {
      this.alert.error('Cannot determine date for this day.');
      return;
    }
    this.loading = true;
    this.commonApi
      .fetchData(
        {
          tenantId: this.tenantId,
          timetableId: this.timetableId,
          date: dateMs,
          userId: localStorage.getItem('userId'),
        },
        this.moduleName,
        'day/uncancel',
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Holiday removed');
          this.loadTimetable();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Failed to remove holiday');
        },
      });
  }

  private loadPhasesForSubject(subjectId: string) {
    if (!subjectId || !this.batchProgramId || !this.batchClassNo) return;
    if (this.phasesPerSubject[subjectId]) return;
    this.commonApi
      .fetchData(
        { entiId: this.tenantId },
        'institue',
        `phase/list?classNo=${this.batchClassNo}&subjectId=${subjectId}&programId=${this.batchProgramId}`,
      )
      .pipe(
        catchError(() => of({ data: [] })),
        takeUntil(this.destroy$),
      )
      .subscribe((res: any) => {
        this.phasesPerSubject = {
          ...this.phasesPerSubject,
          [subjectId]: Array.isArray(res) ? res : res?.data || [],
        };
      });
  }
}
