import { Component, EventEmitter, Output } from '@angular/core';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';
import * as XLSX from 'xlsx';

type AlumniRow = { enrollmentNumber: string; [key: string]: any };
type AlumniSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  matched: number;
  unmatched: number;
  updated: number;
  created: number;
};

// Mapping: Excel column header → dot-notation key sent to backend
const COLUMN_MAP: { header: string; key: string }[] = [
  // JEE Main
  { header: 'JEE Main Physics', key: 'jeeMain.physics' },
  { header: 'JEE Main Chemistry', key: 'jeeMain.chemistry' },
  { header: 'JEE Main Maths', key: 'jeeMain.maths' },
  { header: 'JEE Main Total', key: 'jeeMain.total' },
  { header: 'JEE Main Rank', key: 'jeeMain.rank' },
  { header: 'JEE Main Selected', key: 'jeeMain.selected' },
  // JEE Advanced Paper 1
  { header: 'JEE Adv P1 Physics', key: 'jeeAdv.paper1.physics' },
  { header: 'JEE Adv P1 Chemistry', key: 'jeeAdv.paper1.chemistry' },
  { header: 'JEE Adv P1 Maths', key: 'jeeAdv.paper1.maths' },
  { header: 'JEE Adv P1 Total', key: 'jeeAdv.paper1.total' },
  // JEE Advanced Paper 2
  { header: 'JEE Adv P2 Physics', key: 'jeeAdv.paper2.physics' },
  { header: 'JEE Adv P2 Chemistry', key: 'jeeAdv.paper2.chemistry' },
  { header: 'JEE Adv P2 Maths', key: 'jeeAdv.paper2.maths' },
  { header: 'JEE Adv P2 Total', key: 'jeeAdv.paper2.total' },
  // JEE Advanced overall
  { header: 'JEE Adv Grand Total', key: 'jeeAdv.grandTotal' },
  { header: 'JEE Adv Rank', key: 'jeeAdv.rank' },
  { header: 'JEE Adv Selected', key: 'jeeAdv.selected' },
  // NEET
  { header: 'NEET Physics', key: 'neet.physics' },
  { header: 'NEET Chemistry', key: 'neet.chemistry' },
  { header: 'NEET Biology', key: 'neet.biology' },
  { header: 'NEET Total', key: 'neet.total' },
  { header: 'NEET Rank', key: 'neet.rank' },
  { header: 'NEET College', key: 'neet.collegeName' },
  { header: 'NEET Course', key: 'neet.course' },
];

@Component({
  selector: 'app-alumni-import',
  standalone: false,
  templateUrl: './alumni-import.component.html',
  styleUrl: './alumni-import.component.scss'
})
export class AlumniImportComponent {
 tenantId = localStorage.getItem('tenantId') || '';
  step: 'upload' | 'preview' | 'done' = 'upload';
  fileName = '';
  parseLoading = false;
  parsedRows: AlumniRow[] = [];
  parseErrors: string[] = [];
  selectedFile: File | null = null;
  submitting = false;
  summary: AlumniSummary | null = null;
  unmatchedList: any[] = [];
  showModal = false;
  @Output() imported = new EventEmitter<void>();

  constructor(
    private commonApi: CommonapiService,
    private alert: AlertService,
  ) {}

  open() {
    this.showModal = true;
    this.reset();
  }
  close() {
    if (this.submitting) return;
    this.showModal = false;
  }

  reset(): void {
    this.step = 'upload';
    this.fileName = '';
    this.parseLoading = false;
    this.parsedRows = [];
    this.parseErrors = [];
    this.selectedFile = null;
    this.submitting = false;
    this.summary = null;
    this.unmatchedList = [];
  }

  downloadSample(): void {
    const wb = XLSX.utils.book_new();
    const row: any = { 'Enrollment Number': 'ADM001' };
    COLUMN_MAP.forEach((c) => {
      row[c.header] = '';
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([row]), 'Alumni');
    XLSX.writeFile(wb, 'alumni_import_sample.xlsx');
  }

  private toNum(v: any): number | null {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
  }

  private isNumericKey(key: string): boolean {
    return (
      !key.includes('selected') &&
      !key.includes('collegeName') &&
      !key.includes('course')
    );
  }

  /** Returns which exam badges to show in preview */
  getExamBadges(row: AlumniRow): string[] {
    const badges: string[] = [];
    if (Object.keys(row).some((k) => k.startsWith('jeeMain.')))
      badges.push('JEE Main');
    if (Object.keys(row).some((k) => k.startsWith('jeeAdv.')))
      badges.push('JEE Adv');
    if (Object.keys(row).some((k) => k.startsWith('neet.')))
      badges.push('NEET');
    return badges;
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
        const rows: AlumniRow[] = [];
        const seen = new Set<string>();
        if (!raw.length) errors.push('File is empty');
        raw.forEach((r, idx) => {
          const rowNo = idx + 2;
          const enrollmentNumber = String(
            r['Enrollment Number'] ||
              r['Enrolment Number'] ||
              r['enrollmentNumber'] ||
              r['admissionNo'] ||
              '',
          ).trim();
          if (!enrollmentNumber) {
            errors.push(`Row ${rowNo}: Enrollment Number is empty`);
            return;
          }
          if (seen.has(enrollmentNumber.toLowerCase())) {
            errors.push(
              `Row ${rowNo}: Duplicate Enrollment Number "${enrollmentNumber}"`,
            );
            return;
          }
          seen.add(enrollmentNumber.toLowerCase());
          const mapped: AlumniRow = { enrollmentNumber };
          for (const { header, key } of COLUMN_MAP) {
            const val = r[header];
            if (val === '' || val === null || val === undefined) continue;
            mapped[key] = this.isNumericKey(key)
              ? this.toNum(val)
              : String(val).trim();
          }
          rows.push(mapped);
        });
        this.parsedRows = rows;
        this.parseErrors = errors;
        this.parseLoading = false;
        if (errors.length) {
          this.alert.error(`${errors.length} error(s) found`);
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

  get canSubmit(): boolean {
    return (
      this.parsedRows.length > 0 &&
      this.parseErrors.length === 0
    );
  }

  submit(): void {
    this.submitting = true;
    this.commonApi
      .fetchData(
        {
          entiId: this.tenantId,
          rows: this.parsedRows,
        },
        'student',
        'alumni-import',
      )
      .subscribe({
        next: (res: any) => {
          this.submitting = false;
          this.summary = res.summary;
          this.unmatchedList = res.unmatchedList || [];
          this.step = 'done';
          if ((res.summary?.updated || 0) + (res.summary?.created || 0) > 0)
            this.imported.emit();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Import failed');
          this.submitting = false;
        },
      });
  }
}
