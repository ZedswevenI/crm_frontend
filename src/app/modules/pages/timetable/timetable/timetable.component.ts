import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
  uploadForm!: FormGroup;
  file: File | null = null;
  loading = false;
  entiId: any;
  private moduleName = 'timetable';

  // Data
  timetables: any[] = [];
  totalRecords = 0;
  pageSize = 20;

  // Filters
  selectedProgram = '';
  selectedBatch = '';
  selectedCenter = '';

  // Dropdowns
  programsFull: any[] = [];
  batchesFull: any[] = [];
  centersFull: any[] = [];
  filteredBatches: any[] = [];

  // Parsed Data
  parsedPayload: any = null;
  parseStats = { daysFound: 0, periodsFound: 0 };

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
    private fb: FormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private router: Router,
    private commonApi: CommonapiService,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Timetable' }]);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadAllLookupsAndInit();
  }

  initForm() {
    this.uploadForm = this.fb.group({
      batchCode: ['', Validators.required],
      centerCode: ['', Validators.required],
      wkStartOn: ['', Validators.required],
      phase: [''],
    });
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

    let sortParam = '';
    if (params.sortKey) {
      sortParam =
        params.sortDirection === 'desc' ? `-${params.sortKey}` : params.sortKey;
    }

    const query: any = {
      page: params.page,
      limit: params.pageSize,
    };

    if (sortParam) query.sort = sortParam;
    if (params.search) query.search = params.search;

    // ✅ APPLY FILTERS
    if (this.selectedBatch) query.batchCode = this.selectedBatch;
    if (this.selectedCenter) query.centerCode = this.selectedCenter;

    const queryString = Object.keys(query)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`,
      )
      .join('&');

    const body = {
      entiId: this.entiId,
    };

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

  // ================= LOOKUPS =================

  loadAllLookupsAndInit() {
    const entiId = this.entiId;
    this.loading = true;

    forkJoin({
      program: this.commonApi.fetchData(
        { entiId },
        'ims',
        'program/list?list=full',
      ),
      batch: this.commonApi.fetchData({ entiId }, 'batch', 'list?list=full'),
      center: this.commonApi.fetchData(
        { entiId },
        'ims',
        'center/list?list=full',
      ),
    }).subscribe({
      next: ({ program, batch, center }) => {
        this.programsFull = program?.data || [];
        this.batchesFull = batch?.data || [];
        this.filteredBatches = this.batchesFull;
        this.centersFull = center?.data || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.alert.error('Unable to load initial data!');
      },
    });
  }

  onProgramFilterChange() {
    if (this.selectedProgram) {
      this.filteredBatches = this.batchesFull.filter(
        (b) =>
          safeTrim(b.programId) === this.selectedProgram ||
          safeTrim(b._id) === this.selectedProgram,
      );
    } else {
      this.filteredBatches = this.batchesFull;
    }

    this.selectedBatch = '';
    this.fetchTableData({ page: 1, pageSize: this.pageSize });
  }

  applyFilters() {
    this.fetchTableData({ page: 1, pageSize: this.pageSize });
  }

  // ================= UPLOAD =================

  openUpload() {
    this.showUpload = true;
    this.parsedPayload = null;
    this.parseStats = { daysFound: 0, periodsFound: 0 };
  }

  closeUpload() {
    this.showUpload = false;
    this.file = null;
    this.uploadForm.reset();
    this.parsedPayload = null;
  }

  onFileChange(e: any): void {
    const f = e.target.files?.[0];
    if (!f) return;

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
      this.alert.error('No valid data found in CSV');
      return;
    }

    const first = data[0];

    this.uploadForm.patchValue({
      batchCode: first['BatchCode'],
      centerCode: first['CentCode'],
      phase: first['Phase'],
      wkStartOn: first['WkStartOn'],
    });

    const weekMap = new Map<string, any[]>();
    const daysOrder = [
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ];

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

      weekPayload.push({
        day,
        periods: periodsWithNo,
      });
    });

    this.parsedPayload = weekPayload;

    this.parseStats = {
      daysFound: weekPayload.length,
      periodsFound: weekPayload.reduce((acc, d) => acc + d.periods.length, 0),
    };
  }

  timeToMin(timeStr: string): number | null {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return h * 60 + m;
  }

  submitUpload() {
    if (this.uploadForm.invalid) {
      this.uploadForm.markAllAsTouched();
      return;
    }

    if (!this.parsedPayload) {
      this.alert.error('No schedule data parsed.');
      return;
    }

    const v = this.uploadForm.value;

    const payload = {
      entiId: this.entiId,
      batchCode: safeTrim(v.batchCode),
      centerCode: safeTrim(v.centerCode),
      phase: safeTrim(v.phase),
      wkStartOn: new Date(v.wkStartOn).getTime(),
      week: this.parsedPayload,
    };

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
          this.fetchTableData({ page: 1, pageSize: this.pageSize });
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Create failed');
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
      'JEE-2025-A,09:00,10:30,2026-02-09,FAC001,Physics - Kinematics,Hall A,,,,Phase 1,CEN01,2026-02-09',
      'JEE-2025-A,10:45,12:15,2026-02-09,FAC002,Maths - Calculus,Hall A,,,,Phase 1,CEN01,2026-02-09',
      'JEE-2025-A,09:00,10:30,2026-02-10,FAC003,Chemistry - Atomic Structure,Lab 1,FAC004,Staff Replacement,,Phase 1,CEN01,2026-02-09',
      'JEE-2025-A,09:00,10:30,2026-02-11,FAC001,Physics - Motion,Hall B,,Faculty on Leave,YES,Phase 1,CEN01,2026-02-09',
      'JEE-2025-A,11:00,12:30,2026-02-12,FAC002,Maths - Limits,Hall A,,,,Phase 1,CEN01,2026-02-09',
    ];
    const csvContent =
      'data:text/csv;charset=utf-8,' + [header, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Timetable_Upload_Format.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
