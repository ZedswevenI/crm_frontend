import { Component, EventEmitter, Output } from '@angular/core';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';
import * as XLSX from 'xlsx';

type ImportRow = { admissionNo: string; studentRpa: string[] };
type ImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  matched: number;
  unmatched: number;
  updated: number;
};

@Component({
  selector: 'app-rpaimport',
  standalone: false,
  templateUrl: './rpaimport.component.html',
  styleUrl: './rpaimport.component.scss'
})
export class RpaimportComponent {
 tenantId = localStorage.getItem('tenantId') || '';
  fileName = '';
  parseLoading = false;
  parsedRows: ImportRow[] = [];
  parseErrors: string[] = [];
  selectedFile: File | null = null;
  submitting = false;
  summary: ImportSummary | null = null;
  unmatchedList: {
    admissionNo: string;
    studentRpa: string[];
    reason: string;
  }[] = [];
  step: 'upload' | 'preview' | 'done' = 'upload';

  @Output() imported = new EventEmitter<void>();

  constructor(
    private commonApi: CommonapiService,
    private alert: AlertService,
  ) {}

  reset(): void {
    this.fileName = '';
    this.parseLoading = false;
    this.parsedRows = [];
    this.parseErrors = [];
    this.selectedFile = null;
    this.submitting = false;
    this.summary = null;
    this.unmatchedList = [];
    this.step = 'upload';
  }

  downloadSample(): void {
    const wb = XLSX.utils.book_new();
    const data = [
      {
        'Enrollment No': '9020642590040',
        'Student RPA 1': 'AIR2000',
        'Student RPA 2': 'AIR8520S',
        'Student RPA 3': '',
      },
      {
        'Enrollment No': '9020642590041',
        'Student RPA 1': 'AIR8965230',
        'Student RPA 2': '',
        'Student RPA 3': '',
      },
      {
        'Enrollment No': '9020642590042',
        'Student RPA 1': 'AIR1234',
        'Student RPA 2': 'AIR5678',
        'Student RPA 3': 'AIR9012',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.sheet_add_aoa(ws, [['* Add more columns: Student RPA 4, Student RPA 5 ... as needed']], { origin: -1 });
    XLSX.utils.book_append_sheet(wb, ws, 'RPA Import');
    XLSX.writeFile(wb, 'rpa_import_sample.xlsx');
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.parsedRows = [];
    this.parseErrors = [];
    this.selectedFile = null;
    this.fileName = '';
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      this.alert.error('Only .xlsx or .xls files allowed');
      (event.target as HTMLInputElement).value = '';
      return;
    }
    this.selectedFile = file;
    this.fileName = file.name;
    this.parseLoading = true;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), {
          type: 'array',
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
        const errors: string[] = [];
        const rows: ImportRow[] = [];
        const seen = new Set<string>();
        if (!raw.length) {
          errors.push('File is empty');
        }
        const allHeaders = Object.keys(raw[0] || {});
        const rpaColKeys = allHeaders.filter((h) =>
          /^Student\s*RPA\s*\d+$/i.test(h.trim()),
        );

        if (!rpaColKeys.length && raw.length) {
          errors.push(
            'No RPA ID columns found. Expected columns like "RPA ID 1", "RPA ID 2" ...',
          );
        }
        rpaColKeys.sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ''), 10);
          const numB = parseInt(b.replace(/\D/g, ''), 10);
          return numA - numB;
        });
        raw.forEach((r, idx) => {
          const rowNo = idx + 2;
          const admissionNo = String(
            r['Enrollment No'] ||
              r['Admission No'] ||
              r['EnrollmentNo'] ||
              r['enrollment no'] ||
              r['admissionNo'] ||
              r['ADMISSION NO'] ||
              '',
          ).trim();
          const rpaArr: string[] = rpaColKeys
            .map((col) => String(r[col] || '').trim())
            .filter(Boolean);
          if (!admissionNo && !rpaArr.length) return;
          if (!admissionNo) {
            errors.push(`Row ${rowNo}: Enrollment No is empty`);
            return;
          }
          if (!rpaArr.length) {
            errors.push(
              `Row ${rowNo} (${admissionNo}): No RPA ID values found`,
            );
            return;
          }
          if (seen.has(admissionNo.toLowerCase())) {
            errors.push(
              `Row ${rowNo}: Duplicate Enrollment No "${admissionNo}"`,
            );
            return;
          }
          seen.add(admissionNo.toLowerCase());
          rows.push({ admissionNo, studentRpa: rpaArr });
        });
        this.parsedRows = rows;
        this.parseErrors = errors;
        this.parseLoading = false;
        if (errors.length) {
          this.alert.error(`${errors.length} validation error(s) found`);
        } else if (rows.length) {
          this.step = 'preview';
        }
      } catch {
        this.alert.error('Failed to parse Excel file');
        this.selectedFile = null;
        this.fileName = '';
        this.parseLoading = false;
        (event.target as HTMLInputElement).value = '';
      }
    };
    reader.onerror = () => {
      this.alert.error('Failed to read file');
      this.parseLoading = false;
    };
    reader.readAsArrayBuffer(file);
  }

  clearFile(): void {
    this.selectedFile = null;
    this.fileName = '';
    this.parsedRows = [];
    this.parseErrors = [];
    this.step = 'upload';
  }

  submit(): void {
    if (!this.parsedRows.length || this.parseErrors.length) return;
    this.submitting = true;
    this.commonApi
      .fetchData(
        { entiId: this.tenantId, rows: this.parsedRows },
        'student',
        'rpa-import',
      )
      .subscribe({
        next: (res: any) => {
          this.submitting = false;
          this.summary = res.summary;
          this.unmatchedList = res.unmatchedList || [];
          this.step = 'done';
          if (res.summary?.updated > 0) this.imported.emit();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Import failed');
          this.submitting = false;
        },
      });
  }

  rpaDisplay(rpa: string[]): string {
    return Array.isArray(rpa) ? rpa.join(', ') : String(rpa || '');
  }
}

