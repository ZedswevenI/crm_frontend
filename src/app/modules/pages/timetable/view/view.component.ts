import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { forkJoin } from 'rxjs';

const safeTrim = (v: any) =>
  v === undefined || v === null ? '' : String(v).trim();
const toInt = (v: any, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

@Component({
  selector: 'app-view',
  standalone: false,
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss',
})
export class ViewComponent implements OnInit {
  loading = false;
  entiId: any;
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
  showUpload = false;
  file: File | null = null;
  parsedPayload: any = null;
  parseStats = { daysFound: 0, periodsFound: 0 };
  uploadMeta: any = {};
  weekDateMap: any = {};
  activeDay: any = null;
  activePeriodNo: number = 0;
  showCancelDay = false;
  cancelDayReason = 'Holiday';
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
  };
  viewMode: 'week' | 'range' = 'week';
  fromDateStr = '';
  toDateStr = '';
  rangeMetaLabel = '';

  private lastWeeklyTimetable: any = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private alert: AlertService,
    private commonApi: CommonapiService,
  ) {
    this.entiId = localStorage.getItem('tenantId');
  }

  ngOnInit(): void {
    this.timetableId = safeTrim(this.route.snapshot.paramMap.get('id'));
    if (!this.timetableId) {
      this.alert.error('Timetable ID missing');
      this.router.navigate(['/app/timetable']);
      return;
    }

    // load lookups first (so selects are ready), then load timetable
    this.loadLookupsAndTimetable();
  }

  // ================= LOOKUPS =================
  private loadLookupsAndTimetable() {
    this.loading = true;
    const entiId = this.entiId;

    forkJoin({
      center: this.commonApi.fetchData(
        { entiId },
        'ims',
        'center/list?list=full',
      ),
      staff: this.commonApi.fetchData(
        { entiId },
        'ims',
        'staff/list?list=full',
      ),
      subject: this.commonApi.fetchData(
        { entiId },
        'ims',
        'subject/list?list=full',
      ),
    }).subscribe({
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
        this.staffFull.forEach((s: any) => {
          const code = safeTrim(s?.staffCode);
          if (code) this.staffByCode[code] = s;
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
        // even if lookups fail, still try to load timetable (do not block screen)
        this.loadTimetable();
      },
    });
  }

  getCenterName(centerCode: string) {
    const code = safeTrim(centerCode);
    const c = this.centerByCode?.[code];
    return c?.centerName ? c.centerName : centerCode || '-';
  }

  // Used in grid render
  resolveFacultyLabel(p: any) {
    // Prefer existing name in timetable; else lookup by facultyId/code
    const name = safeTrim(p?.facultyName);
    if (name) return name;

    const idOrCode = safeTrim(p?.facultyId);
    if (!idOrCode) return '';

    const staff = this.staffByCode?.[idOrCode];
    if (staff?.staffName) return staff.staffName;

    // fallback show id/code
    return idOrCode;
  }

  resolveSubjectLabel(p: any) {
    const code = safeTrim(p?.subjectCode);
    const name = safeTrim(p?.subjectName);

    if (code || name) return code || name;

    // If backend later stores subjectId instead of code, you can still display safe fallback:
    const maybeCode = safeTrim(p?.subject);
    if (maybeCode && this.subjectByCode?.[maybeCode]?.subjectName) {
      return `${maybeCode}`;
    }
    return '';
  }

  // ================= VIEW API =================
  loadTimetable() {
    this.loading = true;
    const payload = {
      entiId: this.entiId,
      timetableId: this.timetableId,
    };
    this.commonApi.fetchData(payload, this.moduleName, 'view').subscribe({
      next: (res: any) => {
        this.loading = false;
        this.timetable = res?.data || null;
        this.lastWeeklyTimetable = this.timetable;
        const wkStart = toInt(this.timetable?.wkStartOn, 0);
        if (wkStart && !this.fromDateStr) {
          this.fromDateStr = this.toISODateInput(wkStart);
          const end = wkStart + 6 * 24 * 60 * 60 * 1000;
          this.toDateStr = this.toISODateInput(end);
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
    const yyyy = d.getFullYear();
    return `${dd} ${mon} ${yyyy}`;
  }

  private buildWeekDateMap() {
    this.weekDateMap = {};
    const wkStartOn = toInt(this.timetable?.wkStartOn, 0);
    if (!wkStartOn) return;

    for (let i = 0; i < this.daysOrder.length; i++) {
      const d = new Date(wkStartOn);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const ms = d.getTime();
      const day = this.daysOrder[i];
      this.weekDateMap[day] = { dateMs: ms, label: this.fmtDateLabel(ms) };
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
        .sort((a: any, b: any) => toInt(a.periodNo, 0) - toInt(b.periodNo, 0));
      const dateMs = this.weekDateMap?.[day]?.dateMs || 0;
      const dateLabel = this.weekDateMap?.[day]?.label || '-';
      return {
        day,
        dateMs,
        dateLabel,
        periods,
        __isHoliday: this.isDayCancelled(dateMs, day),
      };
    });
    this.maxPeriods = this.computeMaxPeriodsFromTemplateAndOverrides();
    this.sortedSchedule.forEach((d) => {
      const lastP = d.periods?.[d.periods.length - 1];
      if (lastP && toInt(lastP.periodNo, 0) > this.maxPeriods) {
        this.maxPeriods = toInt(lastP.periodNo, 0);
      }
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
      const od = toInt(o?.date, 0);
      const oday = String(o?.day || '').toUpperCase();
      const opn =
        o?.periodNo === null || o?.periodNo === undefined
          ? null
          : toInt(o?.periodNo, 0);
      const oa = safeTrim(o?.action);
      if (od !== toInt(dateMs, 0)) return false;
      if (oday !== dayU) return false;
      if (periodNo === null) {
        if (opn !== null) return false;
      } else {
        if (opn === null) return false;
        if (opn !== toInt(periodNo, 0)) return false;
      }
      if (action) return oa === action;
      return true;
    });
  }

  isDayCancelled(dateMs: number, day: string): boolean {
    const ov = this.findOverride(dateMs, day, null, 'CANCEL_DAY');
    return !!ov;
  }

  private getDayReplacementPeriods(dateMs: number, day: string): any[] | null {
    const ov = this.findOverride(dateMs, day, null, 'REPLACE_PERIOD');
    const periods = ov?.period?.periods;
    if (Array.isArray(periods)) {
      return periods
        .slice()
        .sort((a: any, b: any) => toInt(a.periodNo, 0) - toInt(b.periodNo, 0));
    }
    return null;
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
      if (toInt(o?.date, 0) !== toInt(dateMs, 0)) return;
      if (String(o?.day || '').toUpperCase() !== dayU) return;
      const fromP =
        o?.periodNo === null || o?.periodNo === undefined
          ? 0
          : toInt(o?.periodNo, 0);
      const toP = toInt(o?.period?.periodNo, 0);
      if (!fromP || !toP) return;
      const moved = o?.period || null;
      if (baseMap.has(fromP)) baseMap.delete(fromP);
      if (moved) baseMap.set(toP, moved);
    });
  }

  getRenderedPeriod(dayRow: any, pNum: number) {
    const dateMs = toInt(dayRow?.dateMs, 0);
    const day = String(dayRow?.day || '').toUpperCase();
    if (!dateMs || !day) return null;
    if (this.viewMode === 'range') {
      if (dayRow?.__isHoliday) {
        return {
          __dayCancelled: true,
          isCancelled: true,
          time: { startLabel: null, endLabel: null },
        };
      }
      const list = Array.isArray(dayRow?.periods) ? dayRow.periods : [];
      const hit = list.find(
        (p: any) => toInt(p?.periodNo, 0) === toInt(pNum, 0),
      );
      return hit || null;
    }
    if (this.isDayCancelled(dateMs, day)) {
      return {
        __dayCancelled: true,
        isCancelled: true,
        time: { startLabel: null, endLabel: null },
      };
    }
    const replacedPeriods = this.getDayReplacementPeriods(dateMs, day);
    const basePeriods = replacedPeriods
      ? replacedPeriods
      : Array.isArray(dayRow?.periods)
        ? dayRow.periods
        : [];

    const baseMap = new Map<number, any>();
    basePeriods.forEach((p: any) => {
      const pn = toInt(p?.periodNo, 0);
      if (pn > 0) baseMap.set(pn, p);
    });
    this.applyMoveOverrides(dateMs, day, baseMap);
    const base = baseMap.get(toInt(pNum, 0)) || null;
    if (!base) return null;
    const cancelOv = this.findOverride(dateMs, day, pNum, 'CANCEL_PERIOD');
    if (cancelOv?.period) {
      cancelOv.period.isCancelled = true;
      return cancelOv.period;
    }
    const replaceOv = this.findOverride(dateMs, day, pNum, 'REPLACE_PERIOD');
    if (replaceOv?.period) {
      replaceOv.period.__staffChanged = true;
      return replaceOv.period;
    }
    const rearrangeOv = this.findOverride(dateMs, day, pNum, 'REARRANGE_STAFF');
    if (rearrangeOv?.period) {
      rearrangeOv.period.__staffChanged = true;
      return rearrangeOv.period;
    }
    return base;
  }

  back() {
    this.router.navigate(['/app/timetable']);
  }

  openUpload() {
    this.showUpload = true;
    this.file = null;
    this.parsedPayload = null;
    this.uploadMeta = {};
    this.parseStats = { daysFound: 0, periodsFound: 0 };
  }

  closeUpload() {
    this.showUpload = false;
  }

  onFileChange(e: any): void {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.name.endsWith('.csv') || f.type === 'text/csv') {
      this.file = f;
      this.parseCsv(f);
    } else {
      this.alert.warning('Please upload a .csv file');
    }
  }

  parseCsv(file: File) {
    const reader = new FileReader();
    reader.onload = (evt: any) => this.processCsvData(evt.target.result);
    reader.readAsText(file);
  }

  processCsvData(csvText: string) {
    const lines = csvText.split(/\r\n|\n/).filter((line) => line.trim() !== '');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map((h) => h.trim());
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      if (row.length < headers.length) continue;

      const obj: any = {};
      headers.forEach((h, idx) => (obj[h] = safeTrim(row[idx])));
      data.push(obj);
    }

    if (!data.length) {
      this.alert.error('No valid data');
      return;
    }

    const first = data[0];

    this.uploadMeta = {
      batchCode: first['BatchCode'],
      centerCode: first['CentCode'],
      phase: first['Phase'],
      wkStartOn: first['WkStartOn'],
    };

    const weekMap = new Map<string, any[]>();
    const daysOrder = this.daysOrder;

    data.forEach((row) => {
      const dateStr = row['Dates'];
      if (!dateStr) return;

      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return;

      const dayName =
        daysOrder[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1];
      if (!weekMap.has(dayName)) weekMap.set(dayName, []);

      const startMin = this.timeToMin(row['TimeStart']);
      const endMin = this.timeToMin(row['TimeEnd']);

      if (startMin !== null && endMin !== null) {
        weekMap.get(dayName)?.push({
          startMin,
          endMin,
          facultyId: row['FacultyID'],
          topic: row['Descriptions'],
          venue: row['Venue'],
        });
      }
    });

    const weekPayload: any[] = [];
    weekMap.forEach((periods, day) => {
      periods.sort((a, b) => a.startMin - b.startMin);
      const periodsWithNo = periods.map((p, idx) => ({
        periodNo: idx + 1,
        time: { startMin: p.startMin, endMin: p.endMin },
        facultyId: p.facultyId,
        topic: p.topic,
        venue: p.venue,
      }));
      weekPayload.push({ day, periods: periodsWithNo });
    });

    this.parsedPayload = weekPayload;

    this.parseStats = {
      daysFound: weekPayload.length,
      periodsFound: weekPayload.reduce((acc, d) => acc + d.periods.length, 0),
    };
  }

  timeToMin(timeStr: string): number | null {
    if (!timeStr) return null;
    const parts = String(timeStr).split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  }

  submitUpload() {
    if (!this.parsedPayload) return;

    const payload = {
      entiId: this.entiId,
      batchCode: safeTrim(this.uploadMeta.batchCode),
      centerCode: safeTrim(this.uploadMeta.centerCode),
      phase: safeTrim(this.uploadMeta.phase),
      wkStartOn: new Date(this.uploadMeta.wkStartOn).getTime(),
      week: this.parsedPayload,
    };

    this.loading = true;

    this.commonApi.fetchData(payload, this.moduleName, 'create').subscribe({
      next: (res: any) => {
        this.loading = false;
        const saved = res?.data;
        this.alert.success('Timetable updated successfully');
        this.closeUpload();

        if (saved?._id) {
          this.router.navigate(['/app/timetable/view', saved._id]);
        } else {
          this.loadTimetable();
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Update failed');
      },
    });
  }

  downloadSample() {}

  // ===== ACTION MODALS =====
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
      entiId: this.entiId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs, 0),
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

  openCancelPeriod(row: any, pNum: number) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum, 0);
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
      entiId: this.entiId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs, 0),
      day: String(this.activeDay.day || '').toUpperCase(),
      periodNo: toInt(this.activePeriodNo, 0),
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
    this.activePeriodNo = toInt(pNum, 0);
    this.newFacultyId = '';
    this.newFacultyName = '';
    this.showRearrangeStaff = true;
  }
  closeRearrangeStaff() {
    this.showRearrangeStaff = false;
    this.activeDay = null;
    this.activePeriodNo = 0;
    this.newFacultyId = '';
    this.newFacultyName = '';
  }

  onNewFacultySelected() {
    const code = safeTrim(this.newFacultyId);
    const staff = this.staffByCode?.[code];
    this.newFacultyName = staff?.staffName ? staff.staffName : '';
  }

  submitRearrangeStaff() {
    if (
      !this.activeDay?.dateMs ||
      !this.activePeriodNo ||
      !safeTrim(this.newFacultyId)
    )
      return;

    // payload keys unchanged
    const payload = {
      entiId: this.entiId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs, 0),
      day: String(this.activeDay.day || '').toUpperCase(),
      periodNo: toInt(this.activePeriodNo, 0),
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

  openMovePeriod(row: any, pNum: number) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum, 0);
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
      entiId: this.entiId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs, 0),
      day: String(this.activeDay.day || '').toUpperCase(),
      fromPeriodNo: toInt(this.activePeriodNo, 0),
      toPeriodNo: toInt(this.moveToPeriodNo, 0),
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

  openReplacePeriod(row: any, pNum: number) {
    this.activeDay = row;
    this.activePeriodNo = toInt(pNum, 0);

    this.rp = {
      facultyId: '',
      facultyName: '',
      subjectCode: '',
      subjectName: '',
      venue: '',
      topic: '',
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
    };
  }

  onReplaceFacultySelected() {
    const code = safeTrim(this.rp?.facultyId);
    if (!code) {
      this.rp.facultyName = '';
      return;
    }
    const staff = this.staffByCode?.[code];
    this.rp.facultyName = staff?.staffName ? staff.staffName : '';
  }

  onReplaceSubjectSelected() {
    const code = safeTrim(this.rp?.subjectCode);
    if (!code) {
      this.rp.subjectName = '';
      return;
    }
    const sub = this.subjectByCode?.[code];
    this.rp.subjectName = sub?.subjectName ? sub.subjectName : '';
  }

  submitReplacePeriod() {
    if (!this.activeDay?.dateMs || !this.activePeriodNo) return;

    const period: any = {};
    // payload keys unchanged (only set if user selected/typed)
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

    const payload = {
      entiId: this.entiId,
      timetableId: this.timetableId,
      date: toInt(this.activeDay.dateMs, 0),
      day: String(this.activeDay.day || '').toUpperCase(),
      periodNo: toInt(this.activePeriodNo, 0),
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

  private computeMaxPeriodsFromTemplateAndOverrides(): number {
    let maxP = 0;
    (this.sortedSchedule || []).forEach((d: any) => {
      (d?.periods || []).forEach((p: any) => {
        maxP = Math.max(maxP, toInt(p?.periodNo, 0));
      });
    });
    const ovs = Array.isArray(this.timetable?.overrides)
      ? this.timetable.overrides
      : [];
    ovs.forEach((o: any) => {
      const pn =
        o?.periodNo === null || o?.periodNo === undefined
          ? 0
          : toInt(o?.periodNo, 0);
      maxP = Math.max(maxP, pn);

      const toPn = toInt(o?.period?.periodNo, 0);
      maxP = Math.max(maxP, toPn);
      const replPeriods = o?.period?.periods;
      if (Array.isArray(replPeriods)) {
        replPeriods.forEach((pp: any) => {
          maxP = Math.max(maxP, toInt(pp?.periodNo, 0));
        });
      }
    });
    return maxP;
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
    // yyyy-MM-dd
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  toggleRangeView() {
    if (this.viewMode === 'range') {
      this.resetToWeekly();
    } else {
      this.viewMode = 'range';
      // do not auto-call API; user will choose date and click Load
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

    if (
      !fromMs ||
      !safeTrim(
        this.lastWeeklyTimetable?.batchCode || this.timetable?.batchCode,
      )
    ) {
      this.alert.warning(
        'Please select From Date (and ensure batchCode is available)',
      );
      return;
    }

    const batchCode = safeTrim(
      this.lastWeeklyTimetable?.batchCode || this.timetable?.batchCode,
    );

    const payload = {
      entiId: this.entiId,
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
          if (!schedule.length) {
            this.alert.warning('No schedule found for selected range');
          }
          const builtRows = schedule.map((d: any) => {
            const dateMs = toInt(d?.date, 0);
            const day = String(d?.day || '').toUpperCase();
            const dateLabel = this.fmtDateLabel(dateMs);
            const isHoliday = d?.isHoliday === true;
            const periods = Array.isArray(d?.periods) ? d.periods.slice() : [];
            return {
              day,
              dateMs,
              dateLabel,
              periods,
              __isHoliday: isHoliday,
              __holidayReason: safeTrim(d?.holidayReason),
            };
          });
          this.sortedSchedule = builtRows;
          let maxP = 0;
          this.sortedSchedule.forEach((r: any) => {
            (r?.periods || []).forEach((p: any) => {
              maxP = Math.max(maxP, toInt(p?.periodNo, 0));
            });
          });
          if (maxP <= 0) maxP = 1;
          this.maxPeriods = maxP;
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
}
