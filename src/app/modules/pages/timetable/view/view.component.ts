import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil, catchError, of } from 'rxjs';

const safeTrim = (v: any) =>
  v === undefined || v === null ? '' : String(v).trim();

const toInt = (v: any, def = 0) => {
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
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${period}`;
};

const minToTimeStr = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

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
  private moduleName = 'timetable';
  timetable: any = null;
  centersFull: any[] = [];
  staffFull: any[] = [];
  subjectsFull: any[] = [];
  private staffByCode: Record<string, any> = {};
  private subjectByCode: Record<string, any> = {};
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
  activeDay: any = null;
  activePeriodNo = 0;
  showCancelDay = false;
  cancelDayReason = 'Holiday';
  showEditDay = false;
  editDayPeriods: any[] = [];
  showCancelPeriod = false;
  cancelPeriodReason = 'Cancelled';
  showRearrangeStaff = false;
  newFacultyId = '';
  newFacultyName = '';
  showMovePeriod = false;
  moveToPeriodNo: number | null = null;
  showReplacePeriod = false;
  rp: any = {
    facultyId: '',
    facultyName: '',
    subjectCode: '',
    subjectName: '',
    venue: '',
    topic: '',
    periodType: '',
    mode: '',
    zoomUrl: '',
  };
  showSetZoom = false;
  zoomUrlInput = '';
  showConvertToExam = false;
  examForm: any = {
    examId: '',
    examDescription: '',
    facultyId: '',
    facultyName: '',
    venue: '',
    topic: '',
  };
  viewMode: 'week' | 'range' = 'week';
  fromDateStr = '';
  toDateStr = '';
  rangeMetaLabel = '';
  private lastWeeklyTimetable: any = null;
  editDayConflicts: any[] = [];
  editDayValidating = false;
  private staffById: Record<string, any> = {};
  editDayOriginalPeriods: any[] = [];
  editDayDragIndex: number | null = null;
  editDaySubmitAttempted = false;
  activeSubjectId = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private alert: AlertService,
    private commonApi: CommonapiService,
  ) {
    this.tenantId =
      localStorage.getItem('tenantId') || localStorage.getItem('entiId');
  }

  ngOnInit(): void {
    this.timetableId = safeTrim(this.route.snapshot.paramMap.get('id'));
    if (!this.timetableId) {
      this.alert.error('Timetable ID missing');
      this.router.navigate(['/app/timetable']);
      return;
    }
    this.loadLookupsAndTimetable();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadLookupsAndTimetable() {
    this.loading = true;
    const tenantId = this.tenantId;
    forkJoin({
      center: this.commonApi
        .fetchData({ tenantId }, 'ims', 'center/list?list=full')
        .pipe(
          catchError((e) => {
            console.warn('center lookup failed', e);
            return of({ data: [] });
          }),
        ),
      staff: this.commonApi
        .fetchData({ tenantId }, 'ims', 'staff/list?list=full')
        .pipe(
          catchError((e) => {
            console.warn('staff lookup failed', e);
            return of({ data: [] });
          }),
        ),
      subject: this.commonApi
        .fetchData({ entiId: tenantId }, 'ims', 'subject/list?list=full')
        .pipe(
          catchError((e) => {
            console.warn('subject lookup failed', e);
            return of({ data: [] });
          }),
        ),
    })
      .pipe(takeUntil(this.destroy$))
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
          this.subjectsFull.forEach((sub: any) => {
            const code = safeTrim(sub?.subjectCode);
            if (code) this.subjectByCode[code] = sub;
          });

          this.loading = false;
          this.loadTimetable();
        },
        error: () => {
          this.loading = false;
          this.loadTimetable();
        },
      });
  }

  getCenterName(centerCode: string) {
    const c = this.centerByCode?.[safeTrim(centerCode)];
    return c?.centerName || centerCode || '-';
  }

  resolveFacultyLabel(p: any) {
    const name = safeTrim(p?.facultyName);
    if (name) return name;
    const idOrCode = safeTrim(p?.facultyId);
    if (!idOrCode) return '';
    return `${this.staffByCode?.[idOrCode]?.staffName} - ${idOrCode}`;
  }

  resolveSubjectLabel(p: any) {
    const code = safeTrim(p?.subjectCode);
    const name = safeTrim(p?.subjectName);
    return `${name} - ${code} ` || '';
  }

  loadTimetable() {
    this.loading = true;
    this.commonApi
      .fetchData(
        { tenantId: this.tenantId, timetableId: this.timetableId },
        this.moduleName,
        'view',
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.timetable = res?.data || null;
          this.lastWeeklyTimetable = this.timetable;
          const wkStart = toInt(this.timetable?.wkStartOn, 0);
          if (wkStart && !this.fromDateStr) {
            this.fromDateStr = this.toISODateInput(wkStart);
            this.toDateStr = this.toISODateInput(
              wkStart + 6 * 24 * 60 * 60 * 1000,
            );
          }
          this.processSchedule();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Failed to load timetable');
        },
      });
  }

  private fmtDateLabel(ms: number): string {
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mon = d.toLocaleString('en-US', { month: 'short' });
    return `${dd} ${mon} ${d.getFullYear()}`;
  }

  private buildWeekDateMap() {
    this.weekDateMap = {};
    const wkStartOn = toInt(this.timetable?.wkStartOn, 0);
    if (!wkStartOn) return;
    for (let i = 0; i < this.daysOrder.length; i++) {
      const d = new Date(wkStartOn);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      this.weekDateMap[this.daysOrder[i]] = {
        dateMs: d.getTime(),
        label: this.fmtDateLabel(d.getTime()),
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
    this.sortedSchedule.forEach((d) => {
      const last = d.periods?.[d.periods.length - 1];
      if (last && toInt(last.periodNo) > this.maxPeriods)
        this.maxPeriods = toInt(last.periodNo);
    });
    if (this.maxPeriods <= 0) this.maxPeriods = 1;
    this.periodHeaders = Array.from(
      { length: this.maxPeriods },
      (_, i) => i + 1,
    );
  }

  private findOverride(
    dateMs: number,
    day: string,
    periodNo: number | null,
    action?: string,
  ) {
    const ovs = Array.isArray(this.timetable?.overrides)
      ? this.timetable.overrides
      : [];
    const dayU = String(day || '').toUpperCase();
    return ovs.find((o: any) => {
      if (toInt(o?.date) !== toInt(dateMs)) return false;
      if (String(o?.day || '').toUpperCase() !== dayU) return false;
      const opn =
        o?.periodNo === null || o?.periodNo === undefined
          ? null
          : toInt(o?.periodNo);
      if (
        periodNo === null
          ? opn !== null
          : opn === null || opn !== toInt(periodNo)
      )
        return false;
      if (action) return safeTrim(o?.action) === action;
      return true;
    });
  }

  isDayCancelled(dateMs: number, day: string): boolean {
    return !!this.findOverride(dateMs, day, null, 'CANCEL_DAY');
  }

  private getDayReplacementPeriods(dateMs: number, day: string): any[] | null {
    const ov = this.findOverride(dateMs, day, null, 'REPLACE_PERIOD');
    console.log('getDayReplacementPeriods', day, dateMs, 'found ov:', ov);
    console.log('ov.period:', ov?.period);
    console.log('ov.period.periods:', ov?.period?.periods);
    const periods = ov?.period?.periods;
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
    const ovs = Array.isArray(this.timetable?.overrides)
      ? this.timetable.overrides
      : [];
    const dayU = String(day || '').toUpperCase();
    ovs.forEach((o: any) => {
      if (safeTrim(o?.action) !== 'MOVE_PERIOD') return;
      if (toInt(o?.date) !== toInt(dateMs)) return;
      if (String(o?.day || '').toUpperCase() !== dayU) return;
      const fromP = toInt(o?.periodNo);
      const toP = toInt(o?.period?.periodNo);
      if (!fromP || !toP) return;
      const movedPeriod = baseMap.get(fromP);
      const displacedPeriod = baseMap.get(toP);
      if (o?.period) {
        baseMap.set(toP, o.period);
      }
      if (displacedPeriod) {
        baseMap.set(fromP, { ...displacedPeriod, periodNo: fromP });
      } else {
        baseMap.delete(fromP);
      }
    });
  }

  // getRenderedPeriod(dayRow: any, pNum: number) {
  //   const dateMs = toInt(dayRow?.dateMs);
  //   const day = String(dayRow?.day || '').toUpperCase();
  //   if (!dateMs || !day) return null;
  //   if (this.viewMode === 'range') {
  //     if (dayRow?.__isHoliday)
  //       return { __dayCancelled: true, isCancelled: true, time: {} };
  //     const list = Array.isArray(dayRow?.periods) ? dayRow.periods : [];
  //     return list.find((p: any) => toInt(p?.periodNo) === toInt(pNum)) || null;
  //   }
  //   if (this.isDayCancelled(dateMs, day))
  //     return { __dayCancelled: true, isCancelled: true, time: {} };
  //   const replacedPeriods = this.getDayReplacementPeriods(dateMs, day);
  //   const basePeriods =
  //     replacedPeriods ?? (Array.isArray(dayRow?.periods) ? dayRow.periods : []);
  //   const baseMap = new Map<number, any>();
  //   basePeriods.forEach((p: any) => {
  //     const pn = toInt(p?.periodNo);
  //     if (pn > 0) baseMap.set(pn, p);
  //   });
  //   this.applyMoveOverrides(dateMs, day, baseMap);
  //   const base = baseMap.get(toInt(pNum)) || null;
  //   if (!base) return null;
  //   const cancelOv = this.findOverride(dateMs, day, pNum, 'CANCEL_PERIOD');
  //   if (cancelOv?.period) return { ...cancelOv.period, isCancelled: true };
  //   const replaceOv = this.findOverride(dateMs, day, pNum, 'REPLACE_PERIOD');
  //   if (replaceOv?.period) return { ...replaceOv.period, __staffChanged: true };
  //   const rearrangeOv = this.findOverride(dateMs, day, pNum, 'REARRANGE_STAFF');
  //   if (rearrangeOv?.period)
  //     return { ...rearrangeOv.period, __staffChanged: true };
  //   return base;
  // }

  getRenderedPeriod(dayRow: any, pNum: number) {
    const dateMs = toInt(dayRow?.dateMs);
    const day = String(dayRow?.day || '').toUpperCase();
    if (!dateMs || !day) return null;
    if (this.viewMode === 'range') {
      if (dayRow?.__isHoliday)
        return { __dayCancelled: true, isCancelled: true, time: {} };
      const list = Array.isArray(dayRow?.periods) ? dayRow.periods : [];
      return list.find((p: any) => toInt(p?.periodNo) === toInt(pNum)) || null;
    }
    if (this.isDayCancelled(dateMs, day))
      return { __dayCancelled: true, isCancelled: true, time: {} };
    const replacedPeriods = this.getDayReplacementPeriods(dateMs, day);
    if (replacedPeriods) {
      return (
        replacedPeriods.find((p: any) => toInt(p?.periodNo) === toInt(pNum)) ||
        null
      );
    }
    const basePeriods = Array.isArray(dayRow?.periods) ? dayRow.periods : [];
    const baseMap = new Map<number, any>();
    basePeriods.forEach((p: any) => {
      const pn = toInt(p?.periodNo);
      if (pn > 0) baseMap.set(pn, p);
    });
    this.applyMoveOverrides(dateMs, day, baseMap);
    const base = baseMap.get(toInt(pNum)) || null;
    if (!base) return null;
    const cancelOv = this.findOverride(dateMs, day, pNum, 'CANCEL_PERIOD');
    if (cancelOv?.period) return { ...cancelOv.period, isCancelled: true };
    const replaceOv = this.findOverride(dateMs, day, pNum, 'REPLACE_PERIOD');
    if (replaceOv?.period) return { ...replaceOv.period, __staffChanged: true };
    const rearrangeOv = this.findOverride(dateMs, day, pNum, 'REARRANGE_STAFF');
    if (rearrangeOv?.period)
      return { ...rearrangeOv.period, __staffChanged: true };

    return base;
  }

  private computeMaxPeriods(): number {
    let maxP = 0;
    (this.sortedSchedule || []).forEach((d: any) => {
      (d?.periods || []).forEach((p: any) => {
        maxP = Math.max(maxP, toInt(p?.periodNo));
      });
    });
    const ovs = Array.isArray(this.timetable?.overrides)
      ? this.timetable.overrides
      : [];
    ovs.forEach((o: any) => {
      maxP = Math.max(maxP, toInt(o?.periodNo));
      maxP = Math.max(maxP, toInt(o?.period?.periodNo));
      (o?.period?.periods || []).forEach((pp: any) => {
        maxP = Math.max(maxP, toInt(pp?.periodNo));
      });
    });
    return maxP;
  }

  back() {
    this.router.navigate(['/app/timetable']);
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
    if (!this.activeDay?.dateMs) return;
    const payload = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs),
      reason: safeTrim(this.cancelDayReason) || 'Holiday',
    };
    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, 'day/cancel').subscribe({
      next: () => {
        this.loading = false;
        this.alert.success('Holiday declared');
        this.closeCancelDay();
        this.loadTimetable();
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Holiday failed');
      },
    });
  }

  openEditDay(row: any) {
    this.activeDay = row;
    const currentPeriods: any[] = [];
    for (const pNum of this.periodHeaders) {
      const p = this.getRenderedPeriod(row, pNum);
      if (!p || p.__dayCancelled || p.isCancelled) continue;
      currentPeriods.push(p);
    }
    const mapped = currentPeriods.map((p: any) => {
      const rawId = safeTrim(p.facultyId) || '';
      const staff = this.staffByCode[rawId] || this.staffById[rawId] || null;
      const facultyId = staff ? safeTrim(staff.staffCode) : rawId;
      const facultyName = staff
        ? safeTrim(staff.staffName)
        : safeTrim(p.facultyName) || '';
      return {
        startTime: minToTimeStr(toInt(p?.time?.startMin)),
        endTime: minToTimeStr(toInt(p?.time?.endMin)),
        periodType: p.periodType || 'LECTURE',
        mode: p.mode || 'OFFLINE',
        facultyId,
        facultyName,
        subjectCode: safeTrim(p.subjectCode) || '',
        subjectName: safeTrim(p.subjectName) || '',
        subjectId: safeTrim(p.subjectId) || '',
        venue: safeTrim(p.venue) || '',
        topic: safeTrim(p.topic) || '',
        zoomUrl: safeTrim(p.zoomUrl) || '',
      };
    });
    this.editDayPeriods = mapped;
    this.editDayOriginalPeriods = mapped.map((ep: any) => ({ ...ep }));
    this.editDayConflicts = [];
    this.editDayDragIndex = null;
    this.editDaySubmitAttempted = false;
    if (!this.editDayPeriods.length) this.addEditDayPeriod();
    this.showEditDay = true;
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
  }

  onDragStart(index: number) {
    this.editDayDragIndex = index;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(targetIndex: number) {
    const fromIndex = this.editDayDragIndex;
    if (fromIndex === null || fromIndex === targetIndex) {
      this.editDayDragIndex = null;
      return;
    }
    const arr = this.editDayPeriods;
    const contentFields = [
      'periodType',
      'mode',
      'facultyId',
      'facultyName',
      'subjectCode',
      'subjectName',
      'subjectId',
      'venue',
      'topic',
      'zoomUrl',
    ];
    const fromContent: any = {};
    const toContent: any = {};
    contentFields.forEach((f) => {
      fromContent[f] = arr[fromIndex][f];
      toContent[f] = arr[targetIndex][f];
    });
    contentFields.forEach((f) => {
      arr[fromIndex][f] = toContent[f];
      arr[targetIndex][f] = fromContent[f];
    });

    this.editDayDragIndex = null;
    this.editDayConflicts = [];
  }

  onDragEnd() {
    this.editDayDragIndex = null;
  }

  resetEditDayPeriods() {
    this.editDayPeriods = this.editDayOriginalPeriods.map((ep: any) => ({
      ...ep,
    }));
    this.editDayConflicts = [];
    this.editDaySubmitAttempted = false;
  }

  addEditDayPeriod() {
    this.editDayPeriods.push({
      startTime: '',
      endTime: '',
      periodType: 'LECTURE',
      mode: 'OFFLINE',
      facultyId: '',
      facultyName: '',
      subjectCode: '',
      subjectName: '',
      subjectId: '',
      venue: '',
      topic: '',
      zoomUrl: '',
    });
    this.editDayConflicts = [];
  }

  getStaffForSubject(subjectId: string): any[] {
    const id = safeTrim(subjectId);
    if (!id) return this.staffFull;
    const filtered = this.staffFull.filter(
      (s: any) => safeTrim(s?.subject) === id,
    );
    return filtered.length ? filtered : this.staffFull;
  }

  removeEditDayPeriod(i: number) {
    this.editDayPeriods.splice(i, 1);
    this.editDayConflicts = [];
  }

  onEditDayFacultyChange(ep: any) {
    const s = this.staffByCode[safeTrim(ep.facultyId)];
    ep.facultyName = s?.staffName || '';
    this.editDayConflicts = [];
  }

  onEditDaySubjectChange(ep: any) {
    const sub = this.subjectByCode[safeTrim(ep.subjectCode)];
    ep.subjectName = sub?.subjectName || '';
    ep.subjectId = sub?._id || '';
    ep.facultyId = '';
    ep.facultyName = '';
    this.editDayConflicts = [];
  }

  onEditDayModeChange(ep: any) {
    if (ep.mode === 'OFFLINE') ep.zoomUrl = '';
    this.editDayConflicts = [];
  }

  private buildEditDayPeriods(): any[] | null {
    this.editDaySubmitAttempted = true;
    for (let i = 0; i < this.editDayPeriods.length; i++) {
      const ep = this.editDayPeriods[i];
      if (!ep.startTime || !ep.endTime) {
        this.alert.error(`Period ${i + 1}: start and end time are required`);
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
        zoomUrl:
          ep.mode === 'ONLINE' || ep.mode === 'HYBRID'
            ? safeTrim(ep.zoomUrl) || null
            : null,
        facultyId: safeTrim(ep.facultyId),
        facultyName: safeTrim(ep.facultyName) || null,
        subjectCode: safeTrim(ep.subjectCode) || null,
        subjectName: safeTrim(ep.subjectName) || null,
        subjectId: safeTrim(ep.subjectId) || null,
        venue: safeTrim(ep.venue) || null,
        topic: safeTrim(ep.topic) || null,
      };
    });
  }

  private submitEditDay(periods: any[], date: number) {
    const payload = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      date,
      periods,
    };

    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, 'day/edit').subscribe({
      next: () => {
        this.loading = false;
        this.alert.success('Day updated');
        this.closeEditDay();
        this.loadTimetable();
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Edit day failed');
      },
    });
  }

  openCancelPeriod(row: any, pNum: number) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum);
    this.cancelPeriodReason = 'Cancelled';
    this.showCancelPeriod = true;
  }
  closeCancelPeriod() {
    this.showCancelPeriod = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
  }

  submitCancelPeriod() {
    if (!this.activeDay?.dateMs || !this.activePeriodNo) return;
    const payload = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs),
      day: String(this.activeDay.day || '').toUpperCase(),
      periodNo: toInt(this.activePeriodNo),
      reason: safeTrim(this.cancelPeriodReason) || 'Cancelled',
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'period/cancel')
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Period cancelled');
          this.closeCancelPeriod();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Cancel failed');
        },
      });
  }

  openRearrangeStaff(row: any, pNum: number) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum);
    this.newFacultyId = '';
    this.newFacultyName = '';
    const p = this.getRenderedPeriod(row, pNum);
    this.activeSubjectId = safeTrim(p?.subjectId) || '';
    this.showRearrangeStaff = true;
  }

  closeRearrangeStaff() {
    this.showRearrangeStaff = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
    this.newFacultyId = '';
    this.newFacultyName = '';
    this.activeSubjectId = '';
  }

  onNewFacultySelected() {
    const s = this.staffByCode[safeTrim(this.newFacultyId)];
    this.newFacultyName = s?.staffName || '';
  }

  submitRearrangeStaff() {
    if (
      !this.activeDay?.dateMs ||
      !this.activePeriodNo ||
      !safeTrim(this.newFacultyId)
    )
      return;
    const payload = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs),
      day: String(this.activeDay.day || '').toUpperCase(),
      periodNo: toInt(this.activePeriodNo),
      newFacultyId: safeTrim(this.newFacultyId),
      newFacultyName: safeTrim(this.newFacultyName),
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'period/rearrange-staff')
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Staff updated');
          this.closeRearrangeStaff();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Staff change failed');
        },
      });
  }

  // ===================== MOVE PERIOD =====================

  openMovePeriod(row: any, pNum: number) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum);
    this.moveToPeriodNo = null;
    this.showMovePeriod = true;
  }
  closeMovePeriod() {
    this.showMovePeriod = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
    this.moveToPeriodNo = null;
  }

  submitMovePeriod() {
    if (!this.activeDay?.dateMs || !this.activePeriodNo || !this.moveToPeriodNo)
      return;
    const payload = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs),
      day: String(this.activeDay.day || '').toUpperCase(),
      fromPeriodNo: toInt(this.activePeriodNo),
      toPeriodNo: toInt(this.moveToPeriodNo),
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'period/move')
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Period moved');
          this.closeMovePeriod();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Move failed');
        },
      });
  }

  // ===================== REPLACE PERIOD =====================

  openReplacePeriod(row: any, pNum: number) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum);
    this.rp = {
      facultyId: '',
      facultyName: '',
      subjectCode: '',
      subjectName: '',
      venue: '',
      topic: '',
      periodType: '',
      mode: '',
      zoomUrl: '',
    };
    this.showReplacePeriod = true;
  }
  closeReplacePeriod() {
    this.showReplacePeriod = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
    this.rp = {
      facultyId: '',
      facultyName: '',
      subjectCode: '',
      subjectName: '',
      venue: '',
      topic: '',
      periodType: '',
      mode: '',
      zoomUrl: '',
    };
  }

  onReplaceFacultySelected() {
    const s = this.staffByCode[safeTrim(this.rp?.facultyId)];
    this.rp.facultyName = s?.staffName || '';
  }

  onReplaceSubjectSelected() {
    const sub = this.subjectByCode[safeTrim(this.rp?.subjectCode)];
    this.rp.subjectName = sub?.subjectName || '';
  }

  submitReplacePeriod() {
    if (!this.activeDay?.dateMs || !this.activePeriodNo) return;
    const period: any = {};
    if (safeTrim(this.rp.periodType))
      period.periodType = safeTrim(this.rp.periodType);
    if (safeTrim(this.rp.mode)) period.mode = safeTrim(this.rp.mode);
    if (safeTrim(this.rp.facultyId))
      period.facultyId = safeTrim(this.rp.facultyId);
    if (safeTrim(this.rp.facultyName))
      period.facultyName = safeTrim(this.rp.facultyName);
    if (safeTrim(this.rp.subjectCode))
      period.subjectCode = safeTrim(this.rp.subjectCode);
    if (safeTrim(this.rp.subjectName))
      period.subjectName = safeTrim(this.rp.subjectName);
    if (safeTrim(this.rp.venue)) period.venue = safeTrim(this.rp.venue);
    if (safeTrim(this.rp.topic)) period.topic = safeTrim(this.rp.topic);
    if (safeTrim(this.rp.zoomUrl)) period.zoomUrl = safeTrim(this.rp.zoomUrl);

    const payload = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs),
      day: String(this.activeDay.day || '').toUpperCase(),
      periodNo: toInt(this.activePeriodNo),
      period,
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'period/replace')
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Period replaced');
          this.closeReplacePeriod();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Replace failed');
        },
      });
  }

  // ===================== SET ZOOM =====================

  openSetZoom(row: any, pNum: number, period: any) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum);
    this.zoomUrlInput = safeTrim(period?.zoomUrl) || '';
    this.showSetZoom = true;
  }
  closeSetZoom() {
    this.showSetZoom = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
    this.zoomUrlInput = '';
  }

  submitSetZoom() {
    if (!this.activeDay?.dateMs || !this.activePeriodNo) return;
    const payload = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs),
      day: String(this.activeDay.day || '').toUpperCase(),
      periodNo: toInt(this.activePeriodNo),
      zoomUrl: safeTrim(this.zoomUrlInput) || '',
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'update/zoomlink')
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Zoom link saved');
          this.closeSetZoom();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Zoom update failed');
        },
      });
  }

  // ===================== CONVERT TO EXAM =====================

  openConvertToExam(row: any, pNum: number, period: any) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum);
    this.examForm = {
      examId: '',
      examDescription: '',
      facultyId: safeTrim(period?.facultyId) || '',
      facultyName: safeTrim(period?.facultyName) || '',
      venue: safeTrim(period?.venue) || '',
      topic: safeTrim(period?.topic) || '',
    };
    this.showConvertToExam = true;
  }
  closeConvertToExam() {
    this.showConvertToExam = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
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
    if (!this.activeDay?.dateMs || !this.activePeriodNo) return;
    const payload: any = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs),
      day: String(this.activeDay.day || '').toUpperCase(),
      periodNo: toInt(this.activePeriodNo),
    };
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
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Period converted to Exam');
          this.closeConvertToExam();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Convert failed');
        },
      });
  }

  // ===================== RANGE VIEW =====================

  toggleRangeView() {
    if (this.viewMode === 'range') {
      this.resetToWeekly();
    } else {
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
    } else {
      this.loadTimetable();
    }
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

    const payload = {
      tenantId: this.tenantId,
      batchCode,
      fromDate: fromMs,
      toDate: toMs,
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'viewbybatch')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
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
          this.loading = false;
          this.alert.error(
            err?.error?.message || 'Failed to load range schedule',
          );
        },
      });
  }

  private toStartOfDayMs(dateStr: string): number {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 0;
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  private toISODateInput(ms: number): string {
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  validateAndSubmitEditDay() {
    if (!this.activeDay?.dateMs || !this.editDayPeriods.length) return;

    const periods = this.buildEditDayPeriods();
    if (!periods) return;

    const validatePayload = {
      tenantId: this.tenantId,
      data: [
        {
          batchCode: safeTrim(this.timetable?.batchCode),
          timetableId: this.timetableId,
          wkStartOn: toInt(this.timetable?.wkStartOn),
          week: [
            {
              day: String(this.activeDay.day || '').toUpperCase(),
              periods,
            },
          ],
        },
      ],
    };

    this.editDayValidating = true;
    this.editDayConflicts = [];

    this.commonApi
      .fetchData(validatePayload, this.moduleName, 'validate')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.editDayValidating = false;
          this.doSubmitEditDay(periods);
        },
        error: (err: any) => {
          this.editDayValidating = false;
          const conflicts = err?.error?.conflicts;
          if (Array.isArray(conflicts) && conflicts.length) {
            // Show inline — modal stays open so user can fix
            this.editDayConflicts = conflicts;
          } else {
            this.alert.error(err?.error?.message || 'Validation failed');
          }
        },
      });
  }

  private doSubmitEditDay(periods: any[]) {
    const payload = {
      tenantId: this.tenantId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs),
      day: String(this.activeDay.day || '').toUpperCase(), // ← ADD
      periods,
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'day/edit')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Day schedule updated');
          this.closeEditDay();
          this.loadTimetable();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Failed to update day');
        },
      });
  }
}
