import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil, catchError, of } from 'rxjs';
import * as XLSX from 'xlsx';

const safeTrim = (v: any) =>
  v === undefined || v === null ? '' : String(v).trim();

// ---- Helpers ---------------------------------------------------------------

/** Convert "HH:MM" (24h) → minutes from midnight */
const timeToMin = (timeStr: string): number | null => {
  if (!timeStr) return null;
  const parts = String(timeStr).split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

/**
 * Convert minutes from midnight → "hh:mm AM/PM" label
 * e.g. 540 → "09:00 AM", 780 → "01:00 PM"
 */
const minToLabel = (min: number): string => {
  const h24 = Math.floor(min / 60);
  const mm = min % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${period}`;
};

/** Accepted period types */
const VALID_PERIOD_TYPES = [
  'LECTURE',
  'LAB',
  'TUTORIAL',
  'BREAK',
  'TEST',
  'REVISION',
];

/** Accepted modes */
const VALID_MODES = ['OFFLINE', 'ONLINE', 'HYBRID'];

// ---------------------------------------------------------------------------

@Component({
  selector: 'app-timetable',
  standalone: false,
  templateUrl: './timetable.component.html',
  styleUrl: './timetable.component.scss',
})
export class TimetableComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  showUpload = false;
  file: File | null = null;
  loading = false;
  tenantId: any;
  private moduleName = 'timetable';

  // Data
  timetables: any[] = [];
  totalRecords = 0;
  pageSize = 20;

  // Filters
  selectedBatch = '';
  selectedCenter = '';

  // Dropdowns
  batchesFull: any[] = [];
  centersFull: any[] = [];
  filteredBatches: any[] = [];

  // Lookups for mapping CSV
  private centerByCode = new Map<string, any>();
  private staffByKey = new Map<string, any>();
  private subjectById = new Map<string, any>();
  private subjectByCode = new Map<string, any>();

  // Parsed CSV payload
  parsedPayload: any = null;
  parsedMeta: any = null;
  parseStats = { totalGroups: 0, totalDays: 0, totalPeriods: 0 };
  parsedGroupsPreview: any[] = [];
  parseError = '';

  columns = [
    { key: 'batchCode', label: 'Batch', sortable: true },
    { key: 'centerCode', label: 'Center', sortable: true },
    { key: 'wkStartOn', label: 'Week Starting', sortable: true, date: true },
    { key: 'phase', label: 'Phase', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      type: 'badge',
      badgeColors: {
        Active: 'badge bg-success-subtle text-success',
        Inactive: 'badge bg-secondary-subtle text-secondary',
      },
    },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View Timetable',
      callback: (row: any) => this.openView(row),
    },
  ];

  constructor(
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private router: Router,
    private commonApi: CommonapiService,
  ) {
    // Support both old key (entiId) and new key (tenantId) from localStorage
    this.tenantId =
      localStorage.getItem('tenantId') || localStorage.getItem('entiId');
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Timetable' }]);
  }

  ngOnInit(): void {
    this.loadAllLookupsAndInit();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ================= LIST API =================

  fetchTableData(params: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: string;
  }) {
    this.loading = true;

    const query: any = {
      page: params.page,
      limit: params.pageSize,
    };

    if (params.search) query.search = params.search;
    if (this.selectedBatch) query.batchCode = this.selectedBatch;
    if (this.selectedCenter) query.centerCode = this.selectedCenter;

    const queryString = Object.keys(query)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`,
      )
      .join('&');

    const body = { tenantId: this.tenantId };

    this.commonApi
      .fetchData(body, this.moduleName, `list?${queryString}`)
      .subscribe({
        next: (res: any) => {
          this.timetables = res?.data || [];
          this.totalRecords = res?.count || 0;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.alert.error('Error loading timetables');
        },
      });
  }

  applyFilters() {
    this.fetchTableData({ page: 1, pageSize: this.pageSize });
  }

  loadAllLookupsAndInit() {
    const tenantId = this.tenantId;
    this.loading = true;

    // Each stream has its own catchError so a single API failure does NOT
    // cancel the other three (which is what causes the "cancelled" status
    // you see in the network tab when using bare forkJoin).
    forkJoin({
      center: this.commonApi
        .fetchData({ tenantId }, 'ims', 'center/list?list=full')
        .pipe(
          catchError((err) => {
            console.warn('center lookup failed', err);
            return of({ data: [] });
          }),
        ),

      batch: this.commonApi
        .fetchData({ tenantId }, 'batch', 'list?list=full')
        .pipe(
          catchError((err) => {
            console.warn('batch lookup failed', err);
            return of({ data: [] });
          }),
        ),

      staff: this.commonApi
        .fetchData({ tenantId }, 'ims', 'staff/list?list=full')
        .pipe(
          catchError((err) => {
            console.warn('staff lookup failed', err);
            return of({ data: [] });
          }),
        ),
      subject: this.commonApi
        .fetchData({ entiId : tenantId }, 'ims', 'subject/list?list=full')
        .pipe(
          catchError((err) => {
            console.warn('subject lookup failed', err);
            return of({ data: [] });
          }),
        ),
    })
      .pipe(takeUntil(this.destroy$)) // cancel cleanly if component is destroyed
      .subscribe({
        next: ({ center, batch, staff, subject }) => {
          this.centersFull = center?.data || [];
          this.batchesFull = batch?.data || [];
          this.filteredBatches = this.batchesFull;

          this.centerByCode.clear();
          this.centersFull.forEach((c: any) => {
            const code = safeTrim(c?.centerCode);
            if (code) this.centerByCode.set(code, c);
          });

          this.staffByKey.clear();
          const staffRows = staff?.data || [];
          staffRows.forEach((s: any) => {
            const keys = [
              safeTrim(s?.staffId),
              safeTrim(s?.staffCode),
              safeTrim(s?.employeeId),
              safeTrim(s?._id),
            ]
              .filter(Boolean)
              .map((x) => String(x).toLowerCase());
            keys.forEach((k) => this.staffByKey.set(k, s));
          });

          this.subjectById.clear();
          this.subjectByCode.clear();
          const subRows = subject?.data || [];
          subRows.forEach((x: any) => {
            const id = safeTrim(x?._id);
            const code = safeTrim(x?.subjectCode).toLowerCase();
            if (id) this.subjectById.set(id, x);
            if (code) this.subjectByCode.set(code, x);
          });

          this.loading = false;
          this.fetchTableData({ page: 1, pageSize: this.pageSize });
        },
        error: () => {
          // This block is now only reached if something truly unexpected happens
          // (individual API errors are swallowed above with catchError + of())
          this.loading = false;
          this.alert.error('Unable to load initial data!');
        },
      });
  }

  onCenterFilterChange() {
    if (this.selectedCenter) {
      const cc = String(this.selectedCenter);
      this.filteredBatches = this.batchesFull.filter((b: any) => {
        const bCenterCode =
          safeTrim(b?.centerCode) ||
          safeTrim(b?.center?.centerCode) ||
          safeTrim(b?.centerId?.centerCode);
        return bCenterCode ? String(bCenterCode) === cc : true;
      });
    } else {
      this.filteredBatches = this.batchesFull;
    }
    this.selectedBatch = '';
    this.applyFilters();
  }

  // ================= UPLOAD / IMPORT =================

  openUpload() {
    this.showUpload = true;
    this.file = null;
    this.parsedPayload = null;
    this.parsedMeta = null;
    this.parseError = '';
    this.parseStats = { totalGroups: 0, totalDays: 0, totalPeriods: 0 };
    this.parsedGroupsPreview = [];
  }

  closeUpload() {
    this.showUpload = false;
    this.file = null;
    this.parsedPayload = null;
    this.parsedMeta = null;
    this.parseError = '';
    this.parseStats = { totalGroups: 0, totalDays: 0, totalPeriods: 0 };
    this.parsedGroupsPreview = [];
  }

  onFileChange(e: any): void {
    const f = e.target.files?.[0];
    if (!f) return;

    this.parseError = '';
    this.parsedPayload = null;
    this.parsedMeta = null;
    this.parseStats = { totalGroups: 0, totalDays: 0, totalPeriods: 0 };
    this.parsedGroupsPreview = [];

    const name = f.name.toLowerCase();
    if (name.endsWith('.csv') || f.type === 'text/csv') {
      this.file = f;
      this.parseCsv(f);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      this.file = f;
      this.parseExcel(f);
    } else {
      this.alert.warning('Please upload a .csv, .xlsx, or .xls file.');
    }
  }

  parseCsv(file: File) {
    const reader = new FileReader();
    reader.onload = (evt: any) => this.processCsvData(evt.target.result);
    reader.readAsText(file);
  }

  /**
   * Parse an Excel file (.xlsx / .xls) using SheetJS and convert the first
   * sheet to CSV text, then hand off to the same processCsvData pipeline.
   * Install SheetJS once if not already present:  npm install xlsx
   */
  parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      try {
        const data = new Uint8Array(evt.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Use the first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          this.parseError = 'Excel file has no sheets.';
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        // Convert to CSV string so the same processCsvData() can handle it
        const csvText = XLSX.utils.sheet_to_csv(sheet, { forceQuotes: false });
        this.processCsvData(csvText);
      } catch (err) {
        this.parseError =
          'Failed to parse Excel file. Make sure it is a valid .xlsx/.xls file.';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ================= STRICT DATE PARSING =================
  // ONLY accepts "02-Feb-2026" (dd-MMM-yyyy). Anything else => invalid.
  private parseDDMMMYYYY(dateStr: string): number | null {
    const s = safeTrim(dateStr);
    if (!s) return null;

    const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (!m) return null;

    const dd = parseInt(m[1], 10);
    const monTxt = String(m[2]).toLowerCase();
    const yyyy = parseInt(m[3], 10);

    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    if (dd < 1 || dd > 31) return null;
    if (yyyy < 1900) return null;
    if (months[monTxt] === undefined) return null;

    const dt = new Date(yyyy, months[monTxt], dd);
    if (
      dt.getFullYear() !== yyyy ||
      dt.getMonth() !== months[monTxt] ||
      dt.getDate() !== dd
    )
      return null;

    dt.setHours(0, 0, 0, 0);
    return dt.getTime();
  }

  private getStaffFromCsv(value: string) {
    const key = safeTrim(value).toLowerCase();
    if (!key) return null;
    return this.staffByKey.get(key) || null;
  }

  private getSubjectFromStaff(staff: any) {
    const subId = safeTrim(staff?.subject);
    if (!subId) return null;
    return this.subjectById.get(subId) || null;
  }

  private buildWeekPayloadFromRows(rows: any[]) {
    const daysOrder = [
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ];
    const weekMap = new Map<string, any[]>();

    for (const row of rows) {
      // --- date ---
      const dateStr = safeTrim(row['Dates']);
      const epoch = this.parseDDMMMYYYY(dateStr);
      if (!epoch) {
        this.parseError = `Invalid date format in "Dates": "${dateStr}". Use dd-MMM-yyyy like 02-Feb-2026`;
        return null;
      }

      const dateObj = new Date(epoch);
      const dayName =
        daysOrder[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1];

      // --- time ---
      const startMin = timeToMin(row['TimeStart']);
      const endMin = timeToMin(row['TimeEnd']);
      if (startMin === null || endMin === null) continue;

      // --- staff ---
      const facultyRaw = safeTrim(row['FacultyID']);
      const staff = this.getStaffFromCsv(facultyRaw);
      if (!staff) {
        this.parseError = `Staff not found for FacultyID "${facultyRaw}". Please match with staffId/staffCode/employeeId in DB.`;
        return null;
      }

      // --- subject ---
      const subj = this.getSubjectFromStaff(staff);

      // --- periodType (NEW) ---
      const periodTypeRaw =
        safeTrim(row['PeriodType']).toUpperCase() || 'LECTURE';
      const periodType = VALID_PERIOD_TYPES.includes(periodTypeRaw)
        ? periodTypeRaw
        : 'LECTURE';

      // --- mode (NEW) ---
      const modeRaw = safeTrim(row['Mode']).toUpperCase() || 'OFFLINE';
      const mode = VALID_MODES.includes(modeRaw) ? modeRaw : 'OFFLINE';

      // --- zoomUrl (NEW – only relevant for ONLINE) ---
      const zoomUrl =
        mode === 'ONLINE' ? safeTrim(row['ZoomUrl']) || null : null;

      if (!weekMap.has(dayName)) weekMap.set(dayName, []);

      weekMap.get(dayName)!.push({
        startMin,
        endMin,
        // time labels (NEW)
        startLabel: minToLabel(startMin),
        endLabel: minToLabel(endMin),
        // period meta (NEW)
        periodType,
        mode,
        zoomUrl,
        // staff
        facultyId:
          safeTrim(staff?.staffId) || safeTrim(staff?._id) || facultyRaw,
        facultyName: safeTrim(staff?.staffName) || null,
        // subject
        subjectId: subj ? safeTrim(subj?._id) : null,
        subjectCode: subj ? safeTrim(subj?.subjectCode) : null,
        subjectName: subj ? safeTrim(subj?.subjectName) : null,
        // misc
        topic: safeTrim(row['Descriptions']) || null,
        venue: safeTrim(row['Venue']) || null,
      });
    }

    const weekPayload: any[] = [];
    weekMap.forEach((periods, day) => {
      periods.sort((a, b) => a.startMin - b.startMin);

      const periodsWithNo = periods.map((p, idx) => {
        const period: any = {
          periodNo: idx + 1,
          time: {
            startMin: p.startMin,
            endMin: p.endMin,
            startLabel: p.startLabel, // NEW
            endLabel: p.endLabel, // NEW
          },
          periodType: p.periodType, // NEW
          mode: p.mode, // NEW
          facultyId: p.facultyId,
          facultyName: p.facultyName,
          subjectId: p.subjectId,
          subjectCode: p.subjectCode,
          subjectName: p.subjectName,
          topic: p.topic,
          venue: p.venue,
        };

        // Only include zoomUrl when mode is ONLINE (NEW)
        if (p.mode === 'ONLINE' && p.zoomUrl) {
          period.zoomUrl = p.zoomUrl;
        }

        return period;
      });

      weekPayload.push({ day, periods: periodsWithNo });
    });

    return weekPayload;
  }

  processCsvData(csvText: string) {
    this.parseError = '';

    const lines = csvText.split(/\r\n|\n/).filter((line) => line.trim() !== '');
    if (lines.length < 2) {
      this.parseError = 'CSV is empty';
      return;
    }

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
      this.parseError = 'No valid data found in CSV';
      return;
    }

    // Group by BatchCode + CentCode + WkStartOn + Phase
    const groupsMap = new Map<string, any[]>();
    const metaMap = new Map<string, any>();

    for (const r of data) {
      const batchCode = safeTrim(r['BatchCode']);
      const centerCode = safeTrim(r['CentCode']);
      const phase = safeTrim(r['Phase']);
      const wkStartOnStr = safeTrim(r['WkStartOn']);

      if (!batchCode) continue;

      const wkStartOnMs = this.parseDDMMMYYYY(wkStartOnStr);
      if (!wkStartOnMs) {
        this.parseError = `Invalid date format in "WkStartOn": "${wkStartOnStr}". Use dd-MMM-yyyy like 02-Feb-2026`;
        return;
      }

      if (centerCode) {
        const c = this.centerByCode.get(centerCode);
        if (!c) {
          this.parseError = `Center not found for CentCode "${centerCode}". Please match with Center centerCode in DB.`;
          return;
        }
      }

      const key = `${batchCode}||${centerCode}||${wkStartOnStr}||${phase}`;
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(r);

      if (!metaMap.has(key)) {
        metaMap.set(key, {
          batchCode,
          centerCode,
          phase,
          wkStartOn: wkStartOnMs,
          wkStartOnLabel: wkStartOnStr,
        });
      }
    }

    const groupKeys = Array.from(groupsMap.keys());
    if (!groupKeys.length) {
      this.parseError = 'No valid timetable meta found (BatchCode/WkStartOn)';
      return;
    }

    const payloadGroups: any[] = [];
    let totalDays = 0;
    let totalPeriods = 0;

    for (const k of groupKeys) {
      const rows = groupsMap.get(k) || [];
      const meta = metaMap.get(k);

      const week = this.buildWeekPayloadFromRows(rows);
      if (!week) return; // parseError already set

      const daysCount = week.length;
      const periodsCount = week.reduce(
        (acc, d) => acc + (d.periods || []).length,
        0,
      );
      const allPeriods = week.flatMap((d: any) => d.periods || []);
      const onlineCount = allPeriods.filter(
        (p: any) => p.mode === 'ONLINE',
      ).length;
      const offlineCount = allPeriods.filter(
        (p: any) => p.mode !== 'ONLINE',
      ).length;

      totalDays += daysCount;
      totalPeriods += periodsCount;

      payloadGroups.push({
        batchCode: meta.batchCode,
        centerCode: meta.centerCode || null,
        phase: meta.phase || null,
        wkStartOn: meta.wkStartOn,
        wkStartOnLabel: meta.wkStartOnLabel,
        week,
        daysCount,
        periodsCount,
        onlineCount,
        offlineCount,
      });
    }

    this.parseStats = {
      totalGroups: payloadGroups.length,
      totalDays,
      totalPeriods,
    };

    if (payloadGroups.length === 1) {
      const one = payloadGroups[0];
      this.parsedMeta = {
        batchCode: one.batchCode,
        centerCode: one.centerCode,
        phase: one.phase,
        wkStartOn: one.wkStartOn,
        wkStartOnLabel: one.wkStartOnLabel,
      };
      this.parsedPayload = {
        batchCode: one.batchCode,
        centerCode: one.centerCode,
        phase: one.phase,
        wkStartOn: one.wkStartOn,
        week: one.week,
      };
      this.parsedGroupsPreview = [];
    } else {
      this.parsedMeta = null;
      this.parsedPayload = payloadGroups.map((g) => ({
        batchCode: g.batchCode,
        centerCode: g.centerCode,
        phase: g.phase,
        wkStartOn: g.wkStartOn,
        week: g.week,
      }));
      this.parsedGroupsPreview = payloadGroups.map((g) => ({
        batchCode: g.batchCode,
        centerCode: g.centerCode,
        phase: g.phase,
        wkStartOnLabel: g.wkStartOnLabel,
        daysCount: g.daysCount,
        periodsCount: g.periodsCount,
        onlineCount: g.onlineCount, // NEW – shown in multi-summary table
        offlineCount: g.offlineCount, // NEW
      }));
    }
  }

  // ================= CREATE from CSV (single group) =================
  submitCreateFromCsv() {
    if (!this.parsedPayload || this.parseError) return;

    const payload = {
      tenantId: this.tenantId, // ← changed from entiId
      batchCode: safeTrim(this.parsedPayload.batchCode),
      centerCode: safeTrim(this.parsedPayload.centerCode) || undefined,
      phase: safeTrim(this.parsedPayload.phase) || undefined,
      wkStartOn: this.parsedPayload.wkStartOn,
      week: this.parsedPayload.week,
    };

    if (!payload.batchCode || !payload.wkStartOn) {
      this.alert.error('BatchCode and WkStartOn missing in CSV');
      return;
    }
    if (!Array.isArray(payload.week) || !payload.week.length) {
      this.alert.error('No week data parsed');
      return;
    }

    this.loading = true;

    this.commonApi.fetchData(payload, this.moduleName, 'create').subscribe({
      next: (res: any) => {
        this.loading = false;
        const saved = res?.data;
        this.alert.success('Timetable saved successfully');
        this.closeUpload();
        if (saved?._id) {
          this.router.navigate(['/app/timetable/view', saved._id]);
        } else {
          this.applyFilters();
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Create failed');
      },
    });
  }

  // ================= IMPORT from CSV (multi group) =================
  submitImportFromCsv() {
    if (
      !this.parsedPayload ||
      !Array.isArray(this.parsedPayload) ||
      this.parseError
    )
      return;

    const payload = {
      tenantId: this.tenantId, // ← changed from entiId
      data: this.parsedPayload,
    };

    if (!payload.data.length) {
      this.alert.error('No valid timetable groups to import');
      return;
    }

    this.loading = true;

    this.commonApi.fetchData(payload, this.moduleName, 'import').subscribe({
      next: () => {
        this.loading = false;
        this.alert.success('Import completed successfully');
        this.closeUpload();
        this.applyFilters();
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Import failed');
      },
    });
  }

  openView(row: any) {
    const item = row?._raw || row;
    this.router.navigate(['/app/timetable/view', item._id]);
  }

  // ================= SAMPLE EXCEL DOWNLOAD =================
  downloadSample() {
    const headers = [
      'BatchCode',
      'TimeStart',
      'TimeEnd',
      'Dates',
      'FacultyID',
      'PeriodType',
      'Mode',
      'ZoomUrl',
      'Descriptions',
      'Venue',
      'Phase',
      'CentCode',
      'WkStartOn',
    ];

    const rows = [
      [
        'JEE-2025-A',
        '09:00',
        '10:30',
        '09-Feb-2026',
        'STF0016',
        'LECTURE',
        'OFFLINE',
        '',
        'Physics - Kinematics',
        'Hall A',
        'Phase 1',
        '64',
        '09-Feb-2026',
      ],
      [
        'JEE-2025-A',
        '10:45',
        '12:15',
        '09-Feb-2026',
        'STF0016',
        'LECTURE',
        'ONLINE',
        'https://zoom.us/j/1234567890',
        'Maths - Calculus',
        '',
        'Phase 1',
        '64',
        '09-Feb-2026',
      ],
      [
        'JEE-2025-A',
        '09:00',
        '10:30',
        '10-Feb-2026',
        'STF0016',
        'LAB',
        'OFFLINE',
        '',
        'Chemistry - Atomic Structure',
        'Lab 1',
        'Phase 1',
        '64',
        '09-Feb-2026',
      ],
      [
        'JEE-2025-A',
        '11:00',
        '12:00',
        '10-Feb-2026',
        'STF0016',
        'TUTORIAL',
        'HYBRID',
        '',
        'Maths - Revision',
        'Hall B',
        'Phase 1',
        '64',
        '09-Feb-2026',
      ],
    ];

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Style the header row bold by setting cell metadata
    headers.forEach((_, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
      if (ws[cellRef]) {
        ws[cellRef].s = { font: { bold: true } };
      }
    });

    // Set column widths for readability
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
    XLSX.writeFile(wb, 'Timetable_Upload_Format.xlsx');
  }
}
