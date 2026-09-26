import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { ExcelExportService, ExportColumn } from '../../../../service/excel-export/excel-export.service';
import { REGISTRATION_EXPORT_FIELD_GROUPS } from './admission-registration-export-fields';
import { ENROLLMENT_EXPORT_FIELD_GROUPS } from './admission-enrollment-export-fields';

Chart.register(...registerables);

type ReportType = 'registration' | 'enrollment' | 'snj' | 'analysis';

const SNJ_COLUMNS: ExportColumn[] = [
  { key: 'registrationNumber', label: 'Registration Number' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'mobileNo', label: 'Mobile No' },
  { key: 'city', label: 'City' },
  { key: 'testDate', label: 'Test Date' },
  { key: 'testCity', label: 'Test City' },
  { key: 'programOffered1', label: 'Program Offered 1' },
  { key: 'programOffered2', label: 'Program Offered 2' },
  { key: 'normalizedScore', label: 'Normalized Score' },
  { key: 'normalizedPercentage', label: 'Normalized %' },
  { key: 'normalizedRank', label: 'Normalized Rank' },
  { key: 'testResultStatus', label: 'Result Status' },
];

@Component({
  selector: 'app-admissionreports',
  standalone: false,
  templateUrl: './admissionreports.component.html',
  styleUrl: './admissionreports.component.scss',
})
export class AdmissionreportsComponent implements AfterViewInit, OnDestroy {
  reportType: ReportType = 'registration';
  entiId = localStorage.getItem('tenantId');

  // ---------------- Registration ----------------
  registrationFilter = {
    testDateFrom: '',
    testDateTo: '',
    programCode: '',
    programOffered1: '',
    testCity: '',
    testCentre: '',
    centerCode: '',
    testResultStatus: '',
  };
  registrationFieldGroups = REGISTRATION_EXPORT_FIELD_GROUPS;
  showRegistrationPicker = false;
  registrationExporting = false;

  // ---------------- Enrollment ----------------
  enrollmentFilter = {
    courseStartYear: new Date().getFullYear(),
    programId: '',
    centerId: '',
    batchId: '',
    academicYear: '',
    includeInactive: false,
  };
  enrollmentFieldGroups = ENROLLMENT_EXPORT_FIELD_GROUPS;
  showEnrollmentPicker = false;
  enrollmentExporting = false;

  // ---------------- SNJ ----------------
  snjFilter = {
    testDateFrom: '',
    testDateTo: '',
    programCode: '',
    programOffered1: '',
  };
  snjLoading = false;
  snjSummary: { totalSelected: number; joined: number; notJoined: number } | null = null;
  snjRows: any[] = [];

  // ---------------- Analysis ----------------
  analysisFilter = {
    testDateFrom: '',
    testDateTo: '',
    programCode: '',
    testCity: '',
    centerCode: '',
  };
  analysisLoading = false;
  analysisData: {
    funnel: { registered: number; selected: number; confirmed: number; enrolled: number };
    scoreBands: { _id: string; count: number; selected: number }[];
    geography: { _id: string; registered: number; selected: number; confirmed: number; enrolled: number }[];
    programWise: { program: string; center: string; registered: number; selected: number; confirmed: number; enrolled: number }[];
  } | null = null;

  private scoreBandChart?: Chart;
  private funnelChart?: Chart;

  constructor(
    private breadcrumb: BredcrumpService,
    private api: CommonapiService,
    private alert: AlertService,
    private excelExport: ExcelExportService,
  ) {
    this.breadcrumb.set([{ label: 'Admissions & Fees' }, { label: 'Admission' }, { label: 'Reports' }]);
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.scoreBandChart?.destroy();
    this.funnelChart?.destroy();
  }

  setReport(type: ReportType): void {
    this.reportType = type;
  }

  private toEpochMs(dateStr: string): number | undefined {
    if (!dateStr) return undefined;
    const t = new Date(dateStr).getTime();
    return isNaN(t) ? undefined : t;
  }

  // ===================== Registration =====================

  openRegistrationPicker(): void {
    this.showRegistrationPicker = true;
  }

  closeRegistrationPicker(): void {
    this.showRegistrationPicker = false;
  }

  resetRegistrationFilter(): void {
    this.registrationFilter = {
      testDateFrom: '',
      testDateTo: '',
      programCode: '',
      programOffered1: '',
      testCity: '',
      testCentre: '',
      centerCode: '',
      testResultStatus: '',
    };
  }

  onRegistrationExportFields(fields: string[]): void {
    const f = this.registrationFilter;
    const body: any = { tenantId: this.entiId, fields };
    const testDateFrom = this.toEpochMs(f.testDateFrom);
    const testDateTo = this.toEpochMs(f.testDateTo);
    if (testDateFrom) body.testDateFrom = testDateFrom;
    if (testDateTo) body.testDateTo = testDateTo;
    if (f.programCode) body.programCode = f.programCode;
    if (f.programOffered1) body.programOffered1 = f.programOffered1;
    if (f.testCity) body.testCity = f.testCity;
    if (f.testCentre) body.testCentre = f.testCentre;
    if (f.centerCode) body.centerCode = f.centerCode;
    if (f.testResultStatus) body.testResultStatus = f.testResultStatus;

    this.registrationExporting = true;
    this.api.fetchData(body, 'reports/admission', 'registration').subscribe({
      next: (res: any) => {
        this.registrationExporting = false;
        if (!res?.status) {
          this.alert.error(res?.message || 'Failed to load registration report');
          return;
        }
        const rows = Array.isArray(res?.data) ? res.data : [];
        const columns = this.registrationFieldGroups
          .flatMap((g) => g.fields)
          .filter((fld) => fields.includes(fld.key));
        this.excelExport.exportRows(
          rows,
          columns,
          `Registration_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
        );
        this.showRegistrationPicker = false;
        this.alert.success(`Exported ${rows.length} record(s)`);
      },
      error: (err: any) => {
        this.registrationExporting = false;
        this.alert.error(err?.error?.message || 'Failed to load registration report');
      },
    });
  }

  // ===================== Enrollment =====================

  openEnrollmentPicker(): void {
    if (!this.enrollmentFilter.courseStartYear) {
      this.alert.error('Course Start Year is required');
      return;
    }
    this.showEnrollmentPicker = true;
  }

  closeEnrollmentPicker(): void {
    this.showEnrollmentPicker = false;
  }

  resetEnrollmentFilter(): void {
    this.enrollmentFilter = {
      courseStartYear: new Date().getFullYear(),
      programId: '',
      centerId: '',
      batchId: '',
      academicYear: '',
      includeInactive: false,
    };
  }

  onEnrollmentExportFields(fields: string[]): void {
    const f = this.enrollmentFilter;
    const body: any = {
      tenantId: this.entiId,
      courseStartYear: Number(f.courseStartYear),
      fields,
    };
    if (f.programId) body.programId = f.programId;
    if (f.centerId) body.centerId = f.centerId;
    if (f.batchId) body.batchId = f.batchId;
    if (f.academicYear) body.academicYear = f.academicYear;
    if (f.includeInactive) body.includeInactive = true;

    this.enrollmentExporting = true;
    this.api.fetchData(body, 'reports/admission', 'enrollment').subscribe({
      next: (res: any) => {
        this.enrollmentExporting = false;
        if (!res?.status) {
          this.alert.error(res?.message || 'Failed to load enrollment report');
          return;
        }
        const rows = Array.isArray(res?.data) ? res.data : [];
        const columns = this.enrollmentFieldGroups
          .flatMap((g) => g.fields)
          .filter((fld) => fields.includes(fld.key));
        this.excelExport.exportRows(
          rows,
          columns,
          `Enrollment_Report_${f.courseStartYear}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        );
        this.showEnrollmentPicker = false;
        this.alert.success(`Exported ${rows.length} record(s)`);
      },
      error: (err: any) => {
        this.enrollmentExporting = false;
        this.alert.error(err?.error?.message || 'Failed to load enrollment report');
      },
    });
  }

  // ===================== SNJ =====================

  resetSnjFilter(): void {
    this.snjFilter = { testDateFrom: '', testDateTo: '', programCode: '', programOffered1: '' };
    this.snjSummary = null;
    this.snjRows = [];
  }

  runSnjReport(): void {
    const f = this.snjFilter;
    const body: any = { tenantId: this.entiId };
    const testDateFrom = this.toEpochMs(f.testDateFrom);
    const testDateTo = this.toEpochMs(f.testDateTo);
    if (testDateFrom) body.testDateFrom = testDateFrom;
    if (testDateTo) body.testDateTo = testDateTo;
    if (f.programCode) body.programCode = f.programCode;
    if (f.programOffered1) body.programOffered1 = f.programOffered1;

    this.snjLoading = true;
    this.api.fetchData(body, 'reports/admission', 'snj').subscribe({
      next: (res: any) => {
        this.snjLoading = false;
        if (!res?.status) {
          this.alert.error(res?.message || 'Failed to load SNJ report');
          return;
        }
        this.snjSummary = res?.summary || null;
        this.snjRows = Array.isArray(res?.data) ? res.data : [];
      },
      error: (err: any) => {
        this.snjLoading = false;
        this.alert.error(err?.error?.message || 'Failed to load SNJ report');
      },
    });
  }

  exportSnj(): void {
    if (!this.snjRows.length) {
      this.alert.error('Run the report first');
      return;
    }
    this.excelExport.exportRows(
      this.snjRows,
      SNJ_COLUMNS,
      `SNJ_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  trackByIndex(i: number): number {
    return i;
  }

  // ===================== Analysis =====================

  resetAnalysisFilter(): void {
    this.analysisFilter = { testDateFrom: '', testDateTo: '', programCode: '', testCity: '', centerCode: '' };
    this.analysisData = null;
    this.scoreBandChart?.destroy();
    this.funnelChart?.destroy();
  }

  runAnalysisReport(): void {
    const f = this.analysisFilter;
    const body: any = { tenantId: this.entiId };
    const testDateFrom = this.toEpochMs(f.testDateFrom);
    const testDateTo = this.toEpochMs(f.testDateTo);
    if (testDateFrom) body.testDateFrom = testDateFrom;
    if (testDateTo) body.testDateTo = testDateTo;
    if (f.programCode) body.programCode = f.programCode;
    if (f.testCity) body.testCity = f.testCity;
    if (f.centerCode) body.centerCode = f.centerCode;

    this.analysisLoading = true;
    this.api.fetchData(body, 'reports/admission', 'analysis').subscribe({
      next: (res: any) => {
        this.analysisLoading = false;
        if (!res?.status) {
          this.alert.error(res?.message || 'Failed to load analysis report');
          return;
        }
        this.analysisData = res?.data || null;
        setTimeout(() => this.renderAnalysisCharts(), 0);
      },
      error: (err: any) => {
        this.analysisLoading = false;
        this.alert.error(err?.error?.message || 'Failed to load analysis report');
      },
    });
  }

  funnelConversion(from: number, to: number): string {
    if (!from) return '—';
    return `${Math.round((to / from) * 100)}%`;
  }

  private renderAnalysisCharts(): void {
    this.scoreBandChart?.destroy();
    this.funnelChart?.destroy();
    if (!this.analysisData) return;

    const bands = this.analysisData.scoreBands || [];
    const canvas1 = document.getElementById('reportScoreBandChart');
    if (canvas1) {
      this.scoreBandChart = new Chart('reportScoreBandChart', {
        type: 'bar',
        data: {
          labels: bands.map((b) => b._id),
          datasets: [
            { label: 'Registered', data: bands.map((b) => b.count), backgroundColor: '#1B6FB0' },
            { label: 'Selected', data: bands.map((b) => b.selected), backgroundColor: '#F26522' },
          ],
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
      });
    }

    const funnel = this.analysisData.funnel;
    const canvas2 = document.getElementById('reportFunnelChart');
    if (canvas2 && funnel) {
      this.funnelChart = new Chart('reportFunnelChart', {
        type: 'bar',
        data: {
          labels: ['Registered', 'Selected', 'Confirmed', 'Enrolled'],
          datasets: [
            {
              label: 'Candidates',
              data: [funnel.registered, funnel.selected, funnel.confirmed, funnel.enrolled],
              backgroundColor: ['#1B6FB0', '#F26522', '#2FA84F', '#6c757d'],
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
        },
      });
    }
  }
}
