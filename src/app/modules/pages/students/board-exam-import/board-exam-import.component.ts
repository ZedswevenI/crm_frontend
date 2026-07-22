import { Component, EventEmitter, Output } from '@angular/core';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';
import * as XLSX from 'xlsx';

type BoardExamRow = {
  enrollmentNumber: string;
  boardExamName: string;
  schoolId?: string;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  s4: number | null;
  s5: number | null;
  s6: number | null;
  s7: number | null;
  total: number | null;
};
type BoardExamSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  matched: number;
  unmatched: number;
  updated: number;
};

@Component({
  selector: 'app-board-exam-import',
  standalone: false,
  templateUrl: './board-exam-import.component.html',
  styleUrl: './board-exam-import.component.scss'
})
export class BoardExamImportComponent {
  tenantId = localStorage.getItem('tenantId') || '';
  step: 'upload' | 'preview' | 'done' = 'upload';
  fileName = '';
  parseLoading = false;
  parsedRows: BoardExamRow[] = [];
  parseErrors: string[] = [];
  selectedFile: File | null = null;
  submitting = false;
  summary: BoardExamSummary | null = null;
  unmatchedList: any[] = [];
  showModal = false;
  @Output() imported = new EventEmitter<void>();

  constructor(
    private commonApi: CommonapiService,
    private alert: AlertService,
  ) { }

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
    const data = [
      {
        'Enrollment Number': 'ADM001',
        'Board Exam Name': 'CBSE 2024',
        'School ID': 'SCH001',
        S1: 85,
        S2: 90,
        S3: 78,
        S4: 88,
        S5: 92,
        S6: 75,
        S7: 80,
        Total: 588,
      },
      {
        'Enrollment Number': 'ADM002',
        'Board Exam Name': 'CBSE 2024',
        'School ID': 'SCH002',
        S1: 72,
        S2: 68,
        S3: 80,
        S4: 76,
        S5: 85,
        S6: 70,
        S7: 74,
        Total: 525,
      },
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data),
      'Board Exam',
    );
    XLSX.writeFile(wb, 'board_exam_import_sample.xlsx');
  }

  private toNum(v: any): number | null {
    const n = Number(
      String(v ?? '')
        .replace(/,/g, '')
        .trim(),
    );
    return Number.isFinite(n) ? n : null;
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
        const rows: BoardExamRow[] = [];
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
          const boardExamName = String(
            r['Board Exam Name'] || r['boardExamName'] || '',
          ).trim();
          if (!enrollmentNumber && !boardExamName) return;
          if (!enrollmentNumber) {
            errors.push(`Row ${rowNo}: Enrollment Number is empty`);
            return;
          }
          if (!boardExamName) {
            errors.push(
              `Row ${rowNo} (${enrollmentNumber}): Board Exam Name is empty`,
            );
            return;
          }
          const key = `${enrollmentNumber.toLowerCase()}::${boardExamName.toLowerCase()}`;
          if (seen.has(key)) {
            errors.push(
              `Row ${rowNo}: Duplicate entry for ${enrollmentNumber} + ${boardExamName}`,
            );
            return;
          }
          seen.add(key);
          rows.push({
            enrollmentNumber,
            boardExamName,
            schoolId:
              String(r['School ID'] || r['schoolId'] || '').trim() || undefined,
            s1: this.toNum(r['S1'] || r['s1']),
            s2: this.toNum(r['S2'] || r['s2']),
            s3: this.toNum(r['S3'] || r['s3']),
            s4: this.toNum(r['S4'] || r['s4']),
            s5: this.toNum(r['S5'] || r['s5']),
            s6: this.toNum(r['S6'] || r['s6']),
            s7: this.toNum(r['S7'] || r['s7']),
            total: this.toNum(r['Total'] || r['total']),
          });
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
        'board-exam-import',
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
}

