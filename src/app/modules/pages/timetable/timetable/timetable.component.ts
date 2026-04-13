import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil, catchError, of, finalize } from 'rxjs';
import * as XLSX from 'xlsx';
import { AuthService } from '../../../../service/auth/auth.service';
import { RoleLevel } from '../../../../shared/role.config';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const safeTrim = (v: any): string =>
  v === undefined || v === null ? '' : String(v).trim();

const timeToMin = (timeVal: any): number | null => {
  if (timeVal === null || timeVal === undefined || timeVal === '') return null;
  if (typeof timeVal === 'number' && Number.isFinite(timeVal)) {
    if (timeVal < 0) return null;
    if (timeVal > 0 && timeVal < 1) {
      const mins = Math.round(timeVal * 24 * 60);
      return mins >= 0 && mins <= 24 * 60 ? mins : null;
    }
    if (timeVal >= 1 && timeVal <= 24 * 60) return Math.trunc(timeVal);
    if (timeVal > 20000 && timeVal < 90000) {
      const dayFraction = timeVal - Math.floor(timeVal);
      const mins = Math.round(dayFraction * 24 * 60);
      return mins >= 0 && mins <= 24 * 60 ? mins : null;
    }
  }
  const s = String(timeVal).trim();
  if (!s) return null;
  const parts = s.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const minToLabel = (min: number): string => {
  const h24 = Math.floor(min / 60);
  const mm = min % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${period}`;
};

const VALID_PERIOD_TYPES = [
  'LECTURE',
  'EXAM',
  'LAB',
  'TUTORIAL',
  'TEST',
  'REVISION',
  'PT',
  'YOGA',
  'PET',
];
const VALID_MODES = ['OFFLINE', 'ONLINE'];

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
};
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
  timetables: any[] = [];
  totalRecords = 0;
  pageSize = 10;
  selectedBatch = '';
  selectedCenter = '';
  batchesFull: any[] = [];
  centersFull: any[] = [];
  filteredBatches: any[] = [];
  hasSearched = false;
  private centerByCode = new Map<string, any>();
  private staffByKey = new Map<string, any>();
  private subjectById = new Map<string, any>();
  private phasesByProgram = new Map<string, any[]>();
  private batchProgramMap = new Map<string, string>();
  parsedPayload: any = null;
  parsedMeta: any = null;
  parseStats = { totalGroups: 0, totalDays: 0, totalPeriods: 0 };
  parsedGroupsPreview: any[] = [];
  parseError = '';
  parsing = false;
  parsedPreviewRows: any[] = [];
  parsedPreviewTruncated = false;
  private PREVIEW_LIMIT = 25;
  showConfirm = false;
  confirmMode: 'single' | 'bulk' = 'single';
  validateLoading = false;
  validateOk = false;
  validateConflicts: any[] = [];

  // ─── Columns: one row per batch ───────────────────────────────────────
  columns = [
    { key: 'batchCode', label: 'Batch', sortable: true },
    { key: 'centerCode', label: 'Center', sortable: true },
    {
      key: 'latestStatus',
      label: 'Status',
      sortable: false,
      type: 'badge',
      badgeColors: {
        Active: 'badge bg-success-subtle text-success',
        DRAFT: 'badge bg-warning-subtle text-warning',
        Inactive: 'badge bg-secondary-subtle text-secondary',
      },
    },
    { key: 'lastUpdatedLabel', label: 'Last Updated', sortable: false },
  ];

  // ─── Only View action ─────────────────────────────────────────────────
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
    private authService: AuthService,
  ) {
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

  showimport() {
    // return (
    //   this.authService.getRole() === 'L1' || this.authService.getRole() === 'L3'
    // );
  }

  // ─── Table data ───────────────────────────────────────────────────────
  fetchTableData(params: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: string;
  }) {
    this.loading = true;

    // Fetch all rows (list=full) so we can deduplicate by batchCode client-side
    const body: any = {
      tenantId: this.tenantId,
      list: 'full',
    };
    if (this.selectedBatch) body.batchCode = this.selectedBatch;
    if (this.selectedCenter) body.centerCode = this.selectedCenter;
    if (params.search) body.search = params.search;

    this.commonApi
      .fetchData(body, this.moduleName, 'list')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.hasSearched = true;
        }),
      )
      .subscribe({
        next: (res: any) => {
          const raw: any[] = res?.data || [];

          // ── Deduplicate: one row per batchCode, most recent wkStartOn wins ──
          const batchMap = new Map<string, any>();
          for (const tt of raw) {
            const existing = batchMap.get(tt.batchCode);
            if (!existing || (tt.wkStartOn ?? 0) > (existing.wkStartOn ?? 0)) {
              batchMap.set(tt.batchCode, tt);
            }
          }

          this.timetables = Array.from(batchMap.values()).map((tt: any) => ({
            ...tt,
            _raw: tt,
            latestStatus: tt.status,
            lastUpdatedLabel: tt.updatedAt
              ? new Date(tt.updatedAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '-',
          }));

          this.totalRecords = this.timetables.length;
        },
        error: () => {
          this.alert.error('Error loading timetables');
        },
      });
  }

  applyFilters() {
    this.timetables = [];
    this.totalRecords = 0;
    this.fetchTableData({ page: 1, pageSize: this.pageSize });
  }

  resetFilters() {
    this.selectedCenter = '';
    this.selectedBatch = '';
    this.filteredBatches = this.batchesFull;
    this.hasSearched = false;
    this.timetables = [];
    this.totalRecords = 0;
  }

  onCenterFilterChange() {
    if (this.selectedCenter) {
      const cc = String(this.selectedCenter);
      this.filteredBatches = this.batchesFull.filter((b: any) => {
        const bcc =
          safeTrim(b?.centerCode) ||
          safeTrim(b?.center?.centerCode) ||
          safeTrim(b?.centerId?.centerCode);
        return bcc ? String(bcc) === cc : true;
      });
    } else {
      this.filteredBatches = this.batchesFull;
    }
    this.selectedBatch = '';
    this.hasSearched = false;
    this.timetables = [];
    this.totalRecords = 0;
  }

  onBatchChange() {
    // intentionally empty — user must click Search
  }

  // ─── Boot: load lookups ───────────────────────────────────────────────
  loadAllLookupsAndInit() {
    const tenantId = this.tenantId;
    this.loading = true;

    forkJoin({
      center: this.commonApi
        .fetchData({ entiId: tenantId }, 'ims', 'center/list?list=full')
        .pipe(catchError(() => of({ data: [] }))),
      batch: this.commonApi
        .fetchData({ entiId: tenantId }, 'batch', 'list?list=full')
        .pipe(catchError(() => of({ data: [] }))),
      staff: this.commonApi
        .fetchData({ entiId: tenantId }, 'ims', 'staff/list?list=full')
        .pipe(catchError(() => of({ data: [] }))),
      subject: this.commonApi
        .fetchData({ entiId: tenantId }, 'ims', 'subject/list?list=full')
        .pipe(catchError(() => of({ data: [] }))),
      phase: this.commonApi
        .fetchData({ entiId: tenantId }, 'institue', 'phase/list?list=full')
        .pipe(catchError(() => of({ data: [] }))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: ({ center, batch, staff, subject, phase }) => {
          this.centersFull = center?.data || [];
          this.centerByCode.clear();
          this.centersFull.forEach((c: any) => {
            const code = safeTrim(c?.centerCode);
            if (code) this.centerByCode.set(code, c);
          });

          this.batchesFull = batch?.data || [];
          this.filteredBatches = this.batchesFull;
          this.batchProgramMap.clear();
          this.batchesFull.forEach((b: any) => {
            const bCode = safeTrim(b?.batchCode);
            const progId = safeTrim(
              b?.programId || b?.program || b?.programCode,
            );
            if (bCode && progId) this.batchProgramMap.set(bCode, progId);
          });

          this.staffByKey.clear();
          (staff?.data || []).forEach((s: any) => {
            [
              safeTrim(s?.staffId),
              safeTrim(s?.staffCode),
              safeTrim(s?.employeeId),
              safeTrim(s?._id),
            ]
              .filter(Boolean)
              .map((x) => x.toLowerCase())
              .forEach((k) => this.staffByKey.set(k, s));
          });

          this.subjectById.clear();
          (subject?.data || []).forEach((x: any) => {
            const id = safeTrim(x?._id);
            if (id) this.subjectById.set(id, x);
          });

          this.phasesByProgram.clear();
          (phase?.data || []).forEach((ph: any) => {
            const progId = safeTrim(ph?.programId);
            if (!progId) return;
            if (!this.phasesByProgram.has(progId))
              this.phasesByProgram.set(progId, []);
            this.phasesByProgram.get(progId)!.push(ph);
          });
        },
        error: () => {
          this.alert.error('Unable to load initial data!');
        },
      });
  }

  private resolvePhaseForBatch(
    batchCode: string,
    phaseName: string,
  ): { phaseId: string; phaseName: string } | null {
    const name = safeTrim(phaseName);
    if (!name) return null;
    const programId = this.batchProgramMap.get(safeTrim(batchCode));
    if (!programId) return null;
    const phases = this.phasesByProgram.get(programId) || [];
    const match = phases.find(
      (ph: any) => safeTrim(ph?.phaseName).toLowerCase() === name.toLowerCase(),
    );
    if (!match) return null;
    return {
      phaseId: safeTrim(match.phaseId),
      phaseName: safeTrim(match.phaseName),
    };
  }

  // ─── View — navigate by batchCode ─────────────────────────────────────
  openView(row: any) {
    const item = row?._raw || row;
    this.router.navigate(['/app/timetable/view', item.batchCode]);
  }

  // ─── Upload modal ─────────────────────────────────────────────────────
  openUpload() {
    this.showUpload = true;
    this._resetUploadState();
  }

  closeUpload() {
    this.showUpload = false;
    this._resetUploadState();
  }

  private _resetUploadState() {
    this.file = null;
    this.parsedPayload = null;
    this.parsedMeta = null;
    this.parseError = '';
    this.parsing = false;
    this.parseStats = { totalGroups: 0, totalDays: 0, totalPeriods: 0 };
    this.parsedGroupsPreview = [];
    this.parsedPreviewRows = [];
    this.parsedPreviewTruncated = false;
    this.validateLoading = false;
    this.validateOk = false;
    this.validateConflicts = [];
    this.showConfirm = false;
  }

  onFileChange(e: any): void {
    const f = e.target.files?.[0];
    if (!f) return;
    this.parseError = '';
    this.parsedPayload = null;
    this.parsedMeta = null;
    this.parseStats = { totalGroups: 0, totalDays: 0, totalPeriods: 0 };
    this.parsedGroupsPreview = [];
    this.parsedPreviewRows = [];
    this.parsedPreviewTruncated = false;
    this.validateLoading = false;
    this.validateOk = false;
    this.validateConflicts = [];
    this.showConfirm = false;
    const name = f.name.toLowerCase();
    if (name.endsWith('.csv') || f.type === 'text/csv') {
      this.file = f;
      this.parsing = true;
      this.parseCsv(f);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      this.file = f;
      this.parsing = true;
      this.parseExcel(f);
    } else {
      this.alert.warning('Please upload a .csv, .xlsx, or .xls file.');
    }
  }

  parseCsv(file: File) {
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      try {
        this.processCsvData(evt.target.result);
      } finally {
        this.parsing = false;
      }
    };
    reader.onerror = () => {
      this.parsing = false;
      this.parseError = 'Failed to read file.';
    };
    reader.readAsText(file);
  }

  parseExcel(file: File) {
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      try {
        const data = new Uint8Array(evt.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          this.parseError = 'Excel file has no sheets.';
          return;
        }
        const rows: any[] = XLSX.utils.sheet_to_json(
          workbook.Sheets[sheetName],
          { defval: '', raw: true },
        );
        this.processTabularRows(rows);
      } catch {
        this.parseError =
          'Failed to parse Excel file. Make sure it is a valid .xlsx/.xls file.';
      } finally {
        this.parsing = false;
      }
    };
    reader.onerror = () => {
      this.parsing = false;
      this.parseError = 'Failed to read Excel file.';
    };
    reader.readAsArrayBuffer(file);
  }

  private processTabularRows(data: any[]) {
    this.parseError = '';
    this.parsedPreviewRows = [];
    this.parsedPreviewTruncated = false;
    if (!Array.isArray(data) || !data.length) {
      this.parseError = 'No valid data found in file';
      return;
    }
    this.parsedPreviewRows = data
      .slice(0, this.PREVIEW_LIMIT)
      .map((r: any) => ({
        BatchCode: safeTrim(r['BatchCode']),
        CentCode: safeTrim(r['CentCode']),
        PhaseName: safeTrim(r['PhaseName']),
        FacultyID: safeTrim(r['FacultyID']),
        PeriodType: safeTrim(r['PeriodType']),
        Mode: safeTrim(r['Mode']),
        ZoomUrl: safeTrim(r['ZoomUrl']),
        Descriptions: safeTrim(r['Descriptions']),
        Venue: safeTrim(r['Venue']),
        TimeStart: this.previewTime(r['TimeStart']),
        TimeEnd: this.previewTime(r['TimeEnd']),
        WkStartOn: this.previewDate(r['WkStartOn']),
        Dates: this.previewDate(r['Dates']),
      }));
    this.parsedPreviewTruncated = data.length > this.PREVIEW_LIMIT;
    const groupsMap = new Map<string, any[]>();
    const metaMap = new Map<string, any>();
    for (const r of data) {
      const batchCode = safeTrim(r['BatchCode']);
      const centerCode = safeTrim(r['CentCode']);
      const phase = safeTrim(r['Phase']);
      const wkRaw = r['WkStartOn'];
      if (!batchCode) continue;
      const wkStartOnMs = this.parseDDMMMYYYY(wkRaw);
      if (!wkStartOnMs) {
        this.parseError = `Invalid date format in "WkStartOn": "${safeTrim(wkRaw)}". Use dd-MMM-yyyy like 02-Feb-2026`;
        return;
      }
      if (centerCode && !this.centerByCode.get(centerCode)) {
        this.parseError = `Center not found for CentCode "${centerCode}". Please match with Center centerCode in DB.`;
        return;
      }
      const key = `${batchCode}||${centerCode}||${wkStartOnMs}`;
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(r);
      if (!metaMap.has(key))
        metaMap.set(key, {
          batchCode,
          centerCode,
          wkStartOn: wkStartOnMs,
          wkStartOnLabel: this.previewDate(wkRaw),
        });
    }
    this._buildPayloadFromGroups(groupsMap, metaMap);
  }

  processCsvData(csvText: string) {
    this.parseError = '';
    this.parsedPreviewRows = [];
    this.parsedPreviewTruncated = false;
    const lines = csvText.split(/\r\n|\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) {
      this.parseError = 'CSV is empty';
      return;
    }
    const headers = parseCsvLine(lines[0]);
    const data: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      if (values.length < headers.length) continue;
      const obj: any = {};
      headers.forEach((h, idx) => (obj[h] = safeTrim(values[idx])));
      data.push(obj);
    }
    if (!data.length) {
      this.parseError = 'No valid data found in CSV';
      return;
    }
    this.parsedPreviewRows = data
      .slice(0, this.PREVIEW_LIMIT)
      .map((r: any) => ({
        BatchCode: safeTrim(r['BatchCode']),
        CentCode: safeTrim(r['CentCode']),
        WkStartOn: this.previewDate(r['WkStartOn']),
        PhaseName: safeTrim(r['PhaseName']),
        Dates: this.previewDate(r['Dates']),
        TimeStart: this.previewTime(r['TimeStart']),
        TimeEnd: this.previewTime(r['TimeEnd']),
        FacultyID: safeTrim(r['FacultyID']),
        PeriodType: safeTrim(r['PeriodType']),
        Mode: safeTrim(r['Mode']),
        ZoomUrl: safeTrim(r['ZoomUrl']),
        Descriptions: safeTrim(r['Descriptions']),
        Venue: safeTrim(r['Venue']),
      }));
    this.parsedPreviewTruncated = data.length > this.PREVIEW_LIMIT;

    const groupsMap = new Map<string, any[]>();
    const metaMap = new Map<string, any>();
    for (const r of data) {
      const batchCode = safeTrim(r['BatchCode']);
      const centerCode = safeTrim(r['CentCode']);
      const phase = safeTrim(r['Phase']);
      const wkRaw = safeTrim(r['WkStartOn']);
      if (!batchCode) continue;
      const wkStartOnMs = this.parseDDMMMYYYY(wkRaw);
      if (!wkStartOnMs) {
        this.parseError = `Invalid date format in "WkStartOn": "${wkRaw}". Use dd-MMM-yyyy like 02-Feb-2026`;
        return;
      }
      if (centerCode && !this.centerByCode.get(centerCode)) {
        this.parseError = `Center not found for CentCode "${centerCode}". Please match with Center centerCode in DB.`;
        return;
      }
      const key = `${batchCode}||${centerCode}||${wkStartOnMs}`;
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(r);
      if (!metaMap.has(key))
        metaMap.set(key, {
          batchCode,
          centerCode,
          wkStartOn: wkStartOnMs,
          wkStartOnLabel: this.previewDate(wkRaw),
        });
    }
    this._buildPayloadFromGroups(groupsMap, metaMap);
  }

  private _buildPayloadFromGroups(
    groupsMap: Map<string, any[]>,
    metaMap: Map<string, any>,
  ) {
    const groupKeys = Array.from(groupsMap.keys());
    if (!groupKeys.length) {
      this.parseError = 'No valid timetable meta found (BatchCode/WkStartOn)';
      return;
    }

    const payloadGroups: any[] = [];
    let totalDays = 0,
      totalPeriods = 0;

    for (const k of groupKeys) {
      const rows = groupsMap.get(k) || [];
      const meta = metaMap.get(k);
      const week = this.buildWeekPayloadFromRows(rows, meta.batchCode);
      if (!week) return;

      const daysCount = week.length;
      const periodsCount = week.reduce(
        (acc: number, d: any) => acc + (d.periods || []).length,
        0,
      );
      const allPeriods = week.flatMap((d: any) => d.periods || []);
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
        onlineCount: allPeriods.filter((p: any) => p.mode === 'ONLINE').length,
        offlineCount: allPeriods.filter((p: any) => p.mode !== 'ONLINE').length,
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
        onlineCount: g.onlineCount,
        offlineCount: g.offlineCount,
      }));
    }
  }

  private parseDDMMMYYYY(dateStr: any): number | null {
    if (dateStr instanceof Date && !isNaN(dateStr.getTime()))
      return Date.UTC(
        dateStr.getFullYear(),
        dateStr.getMonth(),
        dateStr.getDate(),
      );
    if (
      typeof dateStr === 'number' &&
      Number.isFinite(dateStr) &&
      dateStr > 59 &&
      dateStr < 2958466
    ) {
      const ms = (Math.round(dateStr) - 25569) * 86400 * 1000;
      const d = new Date(ms);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    const raw =
      dateStr === undefined || dateStr === null ? '' : String(dateStr).trim();
    if (!raw) return null;
    if (/^\d{5,6}(\.\d+)?$/.test(raw)) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 59 && n < 2958466) {
        const ms = (Math.round(n) - 25569) * 86400 * 1000;
        const d = new Date(ms);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      }
    }
    const s = raw.split(/[\sT]/)[0].trim();
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const [, y, mo, dd] = iso.map(Number);
      if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
      return Date.UTC(y, mo - 1, dd);
    }
    const named = s.match(
      /^(\d{1,2})[-\/\s]([A-Za-z]{3,9})[-\/\s](\d{2}|\d{4})$/,
    );
    if (named) {
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
      const dd = Number(named[1]);
      const mo = months[named[2].slice(0, 3).toLowerCase()];
      let yyyy = Number(named[3]);
      if (yyyy < 100) yyyy += yyyy < 50 ? 2000 : 1900;
      if (mo === undefined || dd < 1 || dd > 31 || yyyy < 1900) return null;
      return Date.UTC(yyyy, mo, dd);
    }
    return null;
  }

  private getStaffFromCsv(value: string) {
    return this.staffByKey.get(safeTrim(value).toLowerCase()) || null;
  }
  private getSubjectFromStaff(staff: any) {
    const subId = safeTrim(staff?.subject);
    return subId ? this.subjectById.get(subId) || null : null;
  }

  private buildWeekPayloadFromRows(
    rows: any[],
    batchCode: string,
  ): any[] | null {
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
      const dateStr = safeTrim(row['Dates']);
      const epoch = this.parseDDMMMYYYY(dateStr);
      if (!epoch) {
        this.parseError = `Invalid date format in "Dates": "${dateStr}". Use dd-MMM-yyyy`;
        return null;
      }
      const dayName =
        daysOrder[
          new Date(epoch).getUTCDay() === 0
            ? 6
            : new Date(epoch).getUTCDay() - 1
        ];
      const startMin = timeToMin(row['TimeStart']);
      const endMin = timeToMin(row['TimeEnd']);
      if (startMin === null || endMin === null) {
        this.parseError = `Invalid time — FacultyID "${safeTrim(row['FacultyID'])}" date "${dateStr}"`;
        return null;
      }
      if (endMin <= startMin) {
        this.parseError = `TimeEnd must be after TimeStart — FacultyID "${safeTrim(row['FacultyID'])}" date "${dateStr}"`;
        return null;
      }
      const facultyRaw = safeTrim(row['FacultyID']);
      const staff = this.getStaffFromCsv(facultyRaw);
      if (!staff) {
        this.parseError = `Staff not found for FacultyID "${facultyRaw}". Match staffId/staffCode/employeeId in DB.`;
        return null;
      }

      const subj = this.getSubjectFromStaff(staff);
      const periodType = (() => {
        const t = safeTrim(row['PeriodType']).toUpperCase() || 'LECTURE';
        return VALID_PERIOD_TYPES.includes(t) ? t : 'LECTURE';
      })();
      const mode = (() => {
        const m = safeTrim(row['Mode']).toUpperCase() || 'OFFLINE';
        return VALID_MODES.includes(m) ? m : 'OFFLINE';
      })();
      const zoomUrl =
        mode === 'ONLINE' ? safeTrim(row['ZoomUrl']) || null : null;
      const phaseNameRaw = safeTrim(row['PhaseName']) || safeTrim(row['Phase']);
      const resolvedPhase = phaseNameRaw
        ? this.resolvePhaseForBatch(batchCode, phaseNameRaw)
        : null;
      if (phaseNameRaw && !resolvedPhase)
        console.warn(
          `Phase "${phaseNameRaw}" not found for batch "${batchCode}" — period will have no phase link`,
        );

      if (!weekMap.has(dayName)) weekMap.set(dayName, []);
      weekMap.get(dayName)!.push({
        startMin,
        endMin,
        startLabel: minToLabel(startMin),
        endLabel: minToLabel(endMin),
        periodType,
        mode,
        zoomUrl,
        facultyId:
          safeTrim(staff?.staffId) || safeTrim(staff?._id) || facultyRaw,
        facultyName: safeTrim(staff?.staffName) || null,
        subjectId: subj ? safeTrim(subj?._id) : null,
        subjectCode: subj ? safeTrim(subj?.subjectCode) : null,
        subjectName: subj ? safeTrim(subj?.subjectName) : null,
        phaseId: resolvedPhase?.phaseId || null,
        phaseName: resolvedPhase?.phaseName || null,
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
            startLabel: p.startLabel,
            endLabel: p.endLabel,
          },
          periodType: p.periodType,
          mode: p.mode,
          facultyId: p.facultyId,
          facultyName: p.facultyName,
          subjectId: p.subjectId,
          subjectCode: p.subjectCode,
          subjectName: p.subjectName,
          topic: p.topic,
          venue: p.venue,
        };
        if (p.phaseId) period.phaseId = p.phaseId;
        if (p.phaseName) period.phaseName = p.phaseName;
        if (p.mode === 'ONLINE' && p.zoomUrl) period.zoomUrl = p.zoomUrl;
        return period;
      });
      weekPayload.push({ day, periods: periodsWithNo });
    });
    return weekPayload;
  }

  submitCreateFromCsv() {
    if (!this.parsedPayload || this.parseError || this.parsing) return;
    const payload = {
      tenantId: this.tenantId,
      batchCode: safeTrim(this.parsedPayload.batchCode),
      centerCode: safeTrim(this.parsedPayload.centerCode) || undefined,
      phase: safeTrim(this.parsedPayload.phase) || undefined,
      wkStartOn: this.parsedPayload.wkStartOn,
      week: this.parsedPayload.week,
      userId: localStorage.getItem('userId'),
    };
    if (!payload.batchCode || !payload.wkStartOn) {
      this.alert.error('BatchCode and WkStartOn missing');
      return;
    }
    if (!Array.isArray(payload.week) || !payload.week.length) {
      this.alert.error('No week data parsed');
      return;
    }
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'create')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (res: any) => {
          this.alert.success('Timetable saved successfully');
          this.closeUpload();
          // Navigate to view screen by batchCode
          this.router.navigate([
            '/app/timetable/view',
            safeTrim(this.parsedPayload.batchCode),
          ]);
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Create failed');
        },
      });
  }

  submitImportFromCsv() {
    if (
      !this.parsedPayload ||
      !Array.isArray(this.parsedPayload) ||
      this.parseError ||
      this.parsing
    )
      return;
    const payload = {
      tenantId: this.tenantId,
      data: this.parsedPayload,
      userId: localStorage.getItem('userId'),
    };
    if (!payload.data.length) {
      this.alert.error('No valid timetable groups to import');
      return;
    }
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'import')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.alert.success('Import completed');
          this.closeUpload();
          this.applyFilters();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Import failed');
        },
      });
  }

  // ─── Validate/confirm flow ────────────────────────────────────────────
  openConfirm(mode: 'single' | 'bulk') {
    if (!this.parsedPayload || this.parseError) return;
    this.confirmMode = mode;
    this.showConfirm = true;
    this.validateLoading = false;
    this.validateOk = false;
    this.validateConflicts = [];
  }

  closeConfirm() {
    if (this.validateLoading) return;
    this.showConfirm = false;
    this.validateLoading = false;
    this.validateOk = false;
    this.validateConflicts = [];
  }

  private buildValidationGroups(): any[] {
    if (!this.parsedPayload) return [];
    if (!Array.isArray(this.parsedPayload))
      return [
        {
          batchCode: safeTrim(this.parsedPayload.batchCode),
          centerCode: safeTrim(this.parsedPayload.centerCode) || null,
          phase: safeTrim(this.parsedPayload.phase) || null,
          wkStartOn: this.parsedPayload.wkStartOn,
          week: this.parsedPayload.week,
        },
      ];
    return this.parsedPayload.map((g: any) => ({
      batchCode: safeTrim(g?.batchCode),
      centerCode: safeTrim(g?.centerCode) || null,
      phase: safeTrim(g?.phase) || null,
      wkStartOn: g?.wkStartOn,
      week: g?.week,
    }));
  }

  runValidateAndProceed() {
    if (this.validateLoading) return;
    const groups = this.buildValidationGroups();
    if (!groups.length) {
      this.alert.error('No valid data to validate');
      return;
    }
    this.validateLoading = true;
    this.validateOk = false;
    this.validateConflicts = [];
    this.commonApi
      .fetchData(
        { tenantId: this.tenantId, data: groups },
        this.moduleName,
        'validate',
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.validateLoading = false)),
      )
      .subscribe({
        next: (res: any) => {
          const conflicts = Array.isArray(res?.conflicts) ? res.conflicts : [];
          this.validateConflicts = conflicts;
          if (res?.status === true && !conflicts.length) {
            this.validateOk = true;
            this.alert.success('Validation passed — no conflicts found');
          } else {
            this.validateOk = false;
            if (conflicts.length)
              this.alert.warning(
                `${conflicts.length} conflict(s) detected. Fix and re-upload.`,
              );
          }
        },
        error: (err: any) => {
          this.validateOk = false;
          const conflicts = Array.isArray(err?.error?.conflicts)
            ? err.error.conflicts
            : [];
          this.validateConflicts = conflicts;
          if (conflicts.length)
            this.alert.warning(
              `${conflicts.length} conflict(s) detected. Fix and re-upload.`,
            );
          else this.alert.error(err?.error?.message || 'Validation failed');
        },
      });
  }

  confirmProceed() {
    if (!this.validateOk || this.validateConflicts.length) return;
    this.showConfirm = false;
    Array.isArray(this.parsedPayload)
      ? this.submitImportFromCsv()
      : this.submitCreateFromCsv();
  }

  private toAmPm(min: any): string {
    const n = Number(min);
    return Number.isFinite(n) && n >= 0 ? minToLabel(Math.trunc(n)) : '-';
  }
  conflictTimeRange(c: any): string {
    const s = c?.startMin ?? c?.time?.startMin ?? c?.period?.time?.startMin;
    const e = c?.endMin ?? c?.time?.endMin ?? c?.period?.time?.endMin;
    const sn = Number(s),
      en = Number(e);
    if (Number.isFinite(sn) && Number.isFinite(en))
      return `${this.toAmPm(sn)} – ${this.toAmPm(en)}`;
    const m = String(c?.message || '').match(
      /from\s+(\d+)\s+to\s+(\d+)\s+mins?/i,
    );
    if (m) {
      const [, a, b] = m.map(Number);
      if (Number.isFinite(a) && Number.isFinite(b))
        return `${this.toAmPm(a)} – ${this.toAmPm(b)}`;
    }
    return '-';
  }

  private previewTime(v: any): string {
    const mins = timeToMin(v);
    return mins === null ? safeTrim(v) : minToLabel(mins);
  }
  private previewDate(v: any): string {
    const ms = this.parseDDMMMYYYY(v);
    if (!ms) return safeTrim(v);
    const d = new Date(ms);
    return `${String(d.getUTCDate()).padStart(2, '0')}-${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}-${d.getUTCFullYear()}`;
  }

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
      'PhaseName',
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
        'CENTER-01',
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
        'CENTER-01',
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
        'CENTER-01',
        '09-Feb-2026',
      ],
      [
        'JEE-2025-A',
        '11:00',
        '12:00',
        '10-Feb-2026',
        'STF0016',
        'TUTORIAL',
        'OFFLINE',
        '',
        'Maths - Revision',
        'Hall B',
        'Phase 1',
        'CENTER-01',
        '09-Feb-2026',
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    headers.forEach((_, i) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: i });
      if (ws[ref]) ws[ref].s = { font: { bold: true } };
    });
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
    XLSX.writeFile(wb, 'Timetable_Upload_Format.xlsx');
  }
}
