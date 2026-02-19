import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { forkJoin } from 'rxjs';

const safeTrim = (v: any) =>
  v === undefined || v === null ? '' : String(v).trim();

@Component({
  selector: 'app-timetable',
  standalone: false,
  templateUrl: './timetable.component.html',
  styleUrl: './timetable.component.scss',
})
export class TimetableComponent implements OnInit {
  showUpload = false;
  file: File | null = null;
  loading = false;
  entiId: any;
  private moduleName = 'timetable';

  // Data
  timetables: any[] = [];
  totalRecords = 0;
  pageSize = 20;

  // Filters (Program removed)
  selectedBatch = '';
  selectedCenter = '';

  // Dropdowns
  batchesFull: any[] = [];
  centersFull: any[] = [];
  filteredBatches: any[] = [];

  // Lookups for mapping CSV
  private centerByCode = new Map<string, any>();

  private staffByKey = new Map<string, any>(); // key: staffId/staffCode/employeeId/_id (lower)
  private subjectById = new Map<string, any>(); // key: _id
  private subjectByCode = new Map<string, any>(); // key: subjectCode (lower)

  // Parsed CSV payload
  parsedPayload: any = null; // single => object, multi => array
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
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Timetable' }]);
  }

  ngOnInit(): void {
    this.loadAllLookupsAndInit();
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
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
      .join('&');

    const body = { entiId: this.entiId };

    this.commonApi.fetchData(body, this.moduleName, `list?${queryString}`).subscribe({
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

  // ================= LOOKUPS =================
  loadAllLookupsAndInit() {
    const entiId = this.entiId;
    this.loading = true;

    forkJoin({
      // Centers (as requested)
      center: this.commonApi.fetchData({ entiId }, 'ims', 'center/list?list=full'),

      // Batches (kept as your existing)
      batch: this.commonApi.fetchData({ entiId }, 'batch', 'list?list=full'),

      // Staff full (as requested)
      staff: this.commonApi.fetchData({ entiId }, 'ims', 'staff/list?list=full'),

      // Subject full (as requested)
      subject: this.commonApi.fetchData({ entiId }, 'ims', 'subject/list?list=full'),
    }).subscribe({
      next: ({ center, batch, staff, subject }) => {
        this.centersFull = center?.data || [];
        this.batchesFull = batch?.data || [];
        this.filteredBatches = this.batchesFull;

        // build center map
        this.centerByCode.clear();
        this.centersFull.forEach((c: any) => {
          const code = safeTrim(c?.centerCode);
          if (code) this.centerByCode.set(code, c);
        });

        // build staff map (multiple keys)
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

        // build subject maps
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

        // initial load
        this.fetchTableData({ page: 1, pageSize: this.pageSize });
      },
      error: () => {
        this.loading = false;
        this.alert.error('Unable to load initial data!');
      },
    });
  }

  onCenterFilterChange() {
    // filter batches by center if batch has centerCode/centerId mapping; else keep all
    if (this.selectedCenter) {
      const cc = String(this.selectedCenter);

      this.filteredBatches = this.batchesFull.filter((b: any) => {
        const bCenterCode =
          safeTrim(b?.centerCode) ||
          safeTrim(b?.center?.centerCode) ||
          safeTrim(b?.centerId?.centerCode) ||
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

    if (f.name.endsWith('.csv') || f.type === 'text/csv') {
      this.file = f;
      this.parseCsv(f);
    } else {
      this.alert.warning('Please upload a .csv file.');
    }
  }

  parseCsv(file: File) {
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      const text = evt.target.result;
      this.processCsvData(text);
    };
    reader.readAsText(file);
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

    const months: any = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };

    if (dd < 1 || dd > 31) return null;
    if (yyyy < 1900) return null;
    if (months[monTxt] === undefined) return null;

    const dt = new Date(yyyy, months[monTxt], dd);
    // validate date (avoid 31-Feb rollover)
    if (dt.getFullYear() !== yyyy || dt.getMonth() !== months[monTxt] || dt.getDate() !== dd) return null;

    dt.setHours(0, 0, 0, 0);
    return dt.getTime();
  }

  private timeToMin(timeStr: string): number | null {
    if (!timeStr) return null;
    const parts = String(timeStr).split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
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
      'MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'
    ];

    const weekMap = new Map<string, any[]>();

    for (const row of rows) {
      const dateStr = safeTrim(row['Dates']);
      const epoch = this.parseDDMMMYYYY(dateStr);
      if (!epoch) {
        this.parseError = `Invalid date format in "Dates": "${dateStr}". Use dd-MMM-yyyy like 02-Feb-2026`;
        return null;
      }

      const dateObj = new Date(epoch);
      const dayName = daysOrder[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1];

      const startMin = this.timeToMin(row['TimeStart']);
      const endMin = this.timeToMin(row['TimeEnd']);
      if (startMin === null || endMin === null) continue;

      const facultyRaw = safeTrim(row['FacultyID']);
      const staff = this.getStaffFromCsv(facultyRaw);
      if (!staff) {
        this.parseError = `Staff not found for FacultyID "${facultyRaw}". Please match with staffId/staffCode/employeeId in DB.`;
        return null;
      }

      const subj = this.getSubjectFromStaff(staff);

      if (!weekMap.has(dayName)) weekMap.set(dayName, []);

      weekMap.get(dayName)!.push({
        startMin,
        endMin,
        facultyId: safeTrim(staff?.staffId) || safeTrim(staff?._id) || facultyRaw,
        facultyName: safeTrim(staff?.staffName) || null,
        subjectId: subj ? safeTrim(subj?._id) : null,
        subjectCode: subj ? safeTrim(subj?.subjectCode) : null,
        subjectName: subj ? safeTrim(subj?.subjectName) : null,
        topic: safeTrim(row['Descriptions']) || null,
        venue: safeTrim(row['Venue']) || null,
      });
    }

    const weekPayload: any[] = [];
    weekMap.forEach((periods, day) => {
      periods.sort((a, b) => a.startMin - b.startMin);

      const periodsWithNo = periods.map((p, idx) => ({
        periodNo: idx + 1,
        time: { startMin: p.startMin, endMin: p.endMin },
        facultyId: p.facultyId,
        facultyName: p.facultyName,
        subjectId: p.subjectId,
        subjectCode: p.subjectCode,
        subjectName: p.subjectName,
        topic: p.topic,
        venue: p.venue,
      }));

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

      // enforce dd-MMM-yyyy
      const wkStartOnMs = this.parseDDMMMYYYY(wkStartOnStr);
      if (!wkStartOnMs) {
        this.parseError = `Invalid date format in "WkStartOn": "${wkStartOnStr}". Use dd-MMM-yyyy like 02-Feb-2026`;
        return;
      }

      // center must exist in DB
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
      const periodsCount = week.reduce((acc, d) => acc + (d.periods || []).length, 0);

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
      }));
    }
  }

  // CREATE from CSV (single group)
  submitCreateFromCsv() {
    if (!this.parsedPayload || this.parseError) return;

    const payload = {
      entiId: this.entiId,
      batchCode: safeTrim(this.parsedPayload.batchCode),
      centerCode: safeTrim(this.parsedPayload.centerCode),
      phase: safeTrim(this.parsedPayload.phase),
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

  // IMPORT from CSV (multi group)
  submitImportFromCsv() {
    if (!this.parsedPayload || !Array.isArray(this.parsedPayload) || this.parseError) return;

    const payload = {
      entiId: this.entiId,
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

  downloadSample() {
    const header =
      'BatchCode,TimeStart,TimeEnd,Dates,FacultyID,Descriptions,Venue,RearrangedTo,Reason,IfCancelled,Phase,CentCode,WkStartOn';
    const rows = [
      'JEE-2025-A,09:00,10:30,09-Feb-2026,STF0016,Physics - Kinematics,Hall A,,,,Phase 1,64,09-Feb-2026',
      'JEE-2025-A,10:45,12:15,09-Feb-2026,STF0016,Maths - Calculus,Hall A,,,,Phase 1,64,09-Feb-2026',
      'JEE-2025-A,09:00,10:30,10-Feb-2026,STF0016,Chemistry - Atomic Structure,Lab 1,,,,Phase 1,64,09-Feb-2026',
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [header, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Timetable_Upload_Format.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}