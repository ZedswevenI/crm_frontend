import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import * as XLSX from 'xlsx';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

const safeTrim = (v: any) => (v === undefined || v === null ? '' : String(v).trim());

type PreviewRow = {
  rowNo: number;
  enrolmentNo: string;
  fullName: string;
  batchCode: string;
  classNo: string;
  mobile: string;
  email: string;
  isValid: boolean;
  errors: string[];
  raw: any; // original normalized row object (for payload)
};

@Component({
  selector: 'app-studentupload',
  standalone: false,
  templateUrl: './studentupload.component.html',
  styleUrl: './studentupload.component.scss'
})
export class StudentuploadComponent implements OnInit {
  loading = false;
  entiId: any;
  userId: any;

  // batches
  batchesFull: any[] = [];
  private batchByCode: Record<string, any> = {};

  selectedBatchCode = '';

  // file + rows
  file: File | null = null;
  rawRows: any[] = []; // normalized rows from excel
  validated = false;

  previewRows: PreviewRow[] = [];
  validRows: PreviewRow[] = [];
  invalidRows: PreviewRow[] = [];

  // backend report
  uploadReport: any = null;

  constructor(
    private router: Router,
    private alert: AlertService,
    private commonApi: CommonapiService,
    private breadcrumb: BredcrumpService
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.userId = localStorage.getItem('userId'); // keep your pattern
    this.breadcrumb.set([{ label: 'Admissions & Fees' }, { label: 'Admission' }, { label: 'Student Bulk Upload' }]);
  }

  ngOnInit(): void {
    this.loadBatches();
  }

  back() {
    this.router.navigate(['/app/student']);
  }

  // ================== BATCH LIST ==================
  private loadBatches() {
    const payload = { entiId: this.entiId };
    this.loading = true;

    this.commonApi.fetchData(payload, 'batch', 'list?list=full').subscribe({
      next: (res: any) => {
        this.loading = false;
        this.batchesFull = Array.isArray(res?.data) ? res.data : [];
        this.batchByCode = {};
        this.batchesFull.forEach((b: any) => {
          const code = safeTrim(b?.batchCode);
          if (code) this.batchByCode[code] = b;
        });
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Failed to load batch list');
      },
    });
  }

  // ================== TEMPLATE DOWNLOAD ==================
  downloadTemplate() {
    const header = [
      'Enrolment Number*',
      'Full Name*',
      'Batch Code*',
      'Class*',
      'Mobile',
      'Email',
    ].join(',');

    const row1 = ['ENR001', 'Student One', 'COITR246A01', '11', '9876543210', 's1@mail.com'].join(',');
    const row2 = ['ENR002', 'Student Two', '1254A4', '12', '9876543211', 's2@mail.com'].join(',');

    const csvContent = 'data:text/csv;charset=utf-8,' + [header, row1, row2].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Student_Upload_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ================== FILE PARSE ==================
  onFileChange(e: any) {
    const f = e.target.files?.[0];
    if (!f) return;

    this.resetAll(false);
    this.file = f;

    const name = (f.name || '').toLowerCase();
    if (name.endsWith('.csv')) {
      this.readCsvFile(f);
      return;
    }

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      this.readExcelFile(f);
      return;
    }

    this.alert.warning('Please upload .xlsx, .xls or .csv file');
  }

  private normalizeHeader(h: string): string {
    // "Enrolment Number*" -> "Enrolment Number"
    return safeTrim(h).replace(/\*/g, '').trim();
  }

  private readExcelFile(file: File) {
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames?.[0];
        if (!sheetName) {
          this.alert.error('No sheet found in file');
          return;
        }
        const ws = wb.Sheets[sheetName];

        // get raw rows with header row
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        // normalize keys
        this.rawRows = json.map((r: any) => {
          const out: any = {};
          Object.keys(r || {}).forEach((k) => {
            out[this.normalizeHeader(k)] = r[k];
          });
          return out;
        });

        if (!this.rawRows.length) this.alert.warning('No rows found in file');
      } catch (err) {
        this.alert.error('Failed to read excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private readCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      const text = String(evt.target.result || '');
      const lines = text.split(/\r\n|\n/).filter((l) => l.trim() !== '');
      if (lines.length < 2) {
        this.alert.warning('CSV has no data rows');
        return;
      }

      const headers = lines[0].split(',').map((h) => this.normalizeHeader(h));
      const out: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const row: any = {};
        headers.forEach((h, idx) => (row[h] = safeTrim(cols[idx])));
        out.push(row);
      }

      this.rawRows = out;
      if (!this.rawRows.length) this.alert.warning('No rows found in file');
    };
    reader.readAsText(file);
  }

  // ================== VALIDATION ==================
  validateRows() {
    if (!this.rawRows.length) return;

    this.validated = false;
    this.previewRows = [];
    this.validRows = [];
    this.invalidRows = [];
    this.uploadReport = null;

    const seenEnrol = new Set<string>();

    const rows: PreviewRow[] = this.rawRows.map((r: any, idx: number) => {
      const rowNo = idx + 2; // assuming header at row 1 in excel/csv
      const enrolmentNo = safeTrim(r['Enrolment Number']);
      const fullName = safeTrim(r['Full Name']);
      let batchCode = safeTrim(r['Batch Code']);
      const classNo = safeTrim(r['Class']);
      const mobile = safeTrim(r['Mobile'] || r['Phone']);
      const email = safeTrim(r['Email']);

      const errors: string[] = [];

      // optional helper: auto fill batch code from selection if missing
      if (!batchCode && safeTrim(this.selectedBatchCode)) {
        batchCode = safeTrim(this.selectedBatchCode);
      }

      // mandatory checks
      if (!enrolmentNo) errors.push('Missing Enrolment Number');
      if (!fullName) errors.push('Missing Full Name');
      if (!batchCode) errors.push('Missing Batch Code');
      if (!classNo) errors.push('Missing Class');

      // duplicate inside file
      if (enrolmentNo) {
        if (seenEnrol.has(enrolmentNo)) errors.push('Duplicate Enrolment Number in file');
        seenEnrol.add(enrolmentNo);
      }

      // batch exists validation
      if (batchCode && !this.batchByCode?.[batchCode]) {
        errors.push(`Batch Code '${batchCode}' not found in master`);
      }

      const isValid = errors.length === 0;

      // keep raw mapped keys EXACTLY like backend expects
      const rawForPayload: any = {
        'Enrolment Number': enrolmentNo,
        'Full Name': fullName,
        'Batch Code': batchCode,
        'Class': classNo,
      };
      if (mobile) rawForPayload['Mobile'] = mobile;
      if (email) rawForPayload['Email'] = email;

      // keep all extra columns too (optional)
      // (backend ignores unknown keys, but you said remaining you can have it)
      Object.keys(r || {}).forEach((k) => {
        const nk = safeTrim(k);
        if (!nk) return;
        if (rawForPayload[nk] === undefined && r[nk] !== undefined && r[nk] !== null && String(r[nk]).trim() !== '') {
          rawForPayload[nk] = r[nk];
        }
      });

      return {
        rowNo,
        enrolmentNo,
        fullName,
        batchCode,
        classNo,
        mobile,
        email,
        isValid,
        errors,
        raw: rawForPayload,
      };
    });

    this.previewRows = rows;
    this.validRows = rows.filter((x) => x.isValid);
    this.invalidRows = rows.filter((x) => !x.isValid);
    this.validated = true;

    if (!this.validRows.length) this.alert.warning('No valid rows to upload');
  }

  resetAll(resetFile: boolean = true) {
    this.validated = false;
    this.rawRows = [];
    this.previewRows = [];
    this.validRows = [];
    this.invalidRows = [];
    this.uploadReport = null;
    if (resetFile) this.file = null;
  }

  // ================== UPLOAD ==================
  submitUpload() {
    if (!this.validRows.length) return;
    const payload = {
      entiId: this.entiId,
      userId: this.userId,
      students: this.validRows.map((r) => r.raw),
    };
    this.loading = true;
    this.commonApi.fetchData(payload, 'admi', 'bulkupload').subscribe({
      next: (res: any) => {
        this.loading = false;
        this.alert.success(res?.message || 'Bulk upload completed');
        this.uploadReport = res?.data || null;
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Upload failed');
      },
    });
  }
}
