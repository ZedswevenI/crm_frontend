import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

const safeTrim = (v: any) =>
  v === undefined || v === null ? '' : String(v).trim();

@Component({
  selector: 'app-view',
  standalone: false,
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss'
})
export class ViewComponent implements OnInit {

  loading = false;
  entiId: any;
  timetableId = '';
  private moduleName = 'timetable';

  timetable: any = null;

  daysOrder = [
    'MONDAY','TUESDAY','WEDNESDAY',
    'THURSDAY','FRIDAY','SATURDAY','SUNDAY'
  ];

  sortedSchedule: any[] = [];
  maxPeriods = 0;
  periodHeaders: number[] = [];

  showUpload = false;
  file: File | null = null;
  parsedPayload: any = null;
  parseStats = { daysFound: 0, periodsFound: 0 };
  uploadMeta: any = {};

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private alert: AlertService,
    private commonApi: CommonapiService
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
    this.loadTimetable();
  }

  loadTimetable() {
    this.loading = true;

    const payload = {
      entiId: this.entiId,
      timetableId: this.timetableId
    };

    this.commonApi.fetchData(payload, this.moduleName, 'view')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.timetable = res?.data || null;
          this.processSchedule();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Failed to load timetable');
        }
      });
  }

  processSchedule() {

    if (!this.timetable?.week) return;

    const weekMap = new Map<string, any>(
      this.timetable.week.map((d: any) => [d.day.toUpperCase(), d])
    );

    this.sortedSchedule = this.daysOrder.map(day => ({
      day,
      periods: (weekMap.get(day)?.periods || [])
        .sort((a: any, b: any) => a.periodNo - b.periodNo)
    })).filter(d => d.periods.length > 0);

    this.maxPeriods = 0;

    this.sortedSchedule.forEach(d => {
      const lastP = d.periods[d.periods.length - 1];
      if (lastP && lastP.periodNo > this.maxPeriods)
        this.maxPeriods = lastP.periodNo;
    });

    this.periodHeaders = Array.from(
      { length: this.maxPeriods },
      (_, i) => i + 1
    );
  }

  // ===== APPLY OVERRIDES =====

  getPeriod(dayRow: any, pNum: number) {

    const base = dayRow.periods.find(
      (p: any) => p.periodNo === pNum
    );

    if (!base) return null;

    if (!this.timetable?.overrides?.length)
      return base;

    const override = this.timetable.overrides.find(
      (o: any) =>
        o.day === dayRow.day &&
        o.periodNo === pNum
    );

    if (!override) return base;

    return override.period || base;
  }

  back() {
    this.router.navigate(['/app/timetable']);
  }

  // ===== CSV UPDATE =====

  openUpload() {
    this.showUpload = true;
    this.file = null;
    this.parsedPayload = null;
    this.uploadMeta = {};
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
    reader.onload = (evt: any) => {
      this.processCsvData(evt.target.result);
    };
    reader.readAsText(file);
  }

  processCsvData(csvText: string) {

    const lines = csvText.split(/\r\n|\n/)
      .filter(line => line.trim() !== '');

    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim());
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',');
      if (row.length < headers.length) continue;

      const obj: any = {};
      headers.forEach((h, idx) =>
        obj[h] = safeTrim(row[idx])
      );
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
      wkStartOn: first['WkStartOn']
    };

    const weekMap = new Map<string, any[]>();
    const daysOrder = this.daysOrder;

    data.forEach(row => {
      const dateStr = row['Dates'];
      if (!dateStr) return;

      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return;

      const dayName =
        daysOrder[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1];

      if (!weekMap.has(dayName))
        weekMap.set(dayName, []);

      const startMin = this.timeToMin(row['TimeStart']);
      const endMin = this.timeToMin(row['TimeEnd']);

      if (startMin !== null && endMin !== null) {
        weekMap.get(dayName)?.push({
          startMin,
          endMin,
          facultyId: row['FacultyID'],
          topic: row['Descriptions'],
          venue: row['Venue']
        });
      }
    });

    const weekPayload: any[] = [];

    weekMap.forEach((periods, day) => {

      periods.sort((a, b) =>
        a.startMin - b.startMin
      );

      const periodsWithNo = periods.map((p, idx) => ({
        periodNo: idx + 1,
        time: { startMin: p.startMin, endMin: p.endMin },
        facultyId: p.facultyId,
        topic: p.topic,
        venue: p.venue
      }));

      weekPayload.push({ day, periods: periodsWithNo });
    });

    this.parsedPayload = weekPayload;

    this.parseStats = {
      daysFound: weekPayload.length,
      periodsFound: weekPayload.reduce(
        (acc, d) => acc + d.periods.length,
        0
      )
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

    if (!this.parsedPayload) return;

    const payload = {
      entiId: this.entiId,
      batchCode: safeTrim(this.uploadMeta.batchCode),
      centerCode: safeTrim(this.uploadMeta.centerCode),
      phase: safeTrim(this.uploadMeta.phase),
      wkStartOn: new Date(this.uploadMeta.wkStartOn).getTime(),
      week: this.parsedPayload
    };

    this.loading = true;

    this.commonApi.fetchData(payload, this.moduleName, 'create')
      .subscribe({
        next: (res: any) => {
          this.loading = false;

          const saved = res?.data;

          this.alert.success('Timetable updated successfully');

          this.closeUpload();

          if (saved?._id) {
            this.router.navigate(
              ['/app/timetable/view', saved._id]
            );
          } else {
            this.loadTimetable();
          }
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Update failed');
        }
      });
  }
}