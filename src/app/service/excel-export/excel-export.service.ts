import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export interface ExportColumn {
  key: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class ExcelExportService {
  private getByPath(obj: any, path: string): any {
    if (obj === null || obj === undefined) return undefined;
    return path
      .split('.')
      .reduce((acc, part) => (acc === null || acc === undefined ? undefined : acc[part]), obj);
  }

  private formatValue(value: any): any {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.length ? JSON.stringify(value) : '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  /**
   * Flattens each row via dotted-path column keys (e.g. "student.name")
   * and writes an .xlsx file — never CSV.
   */
  exportRows(rows: any[], columns: ExportColumn[], fileName: string): void {
    const excelRows = (rows || []).map((row) => {
      const out: Record<string, any> = {};
      columns.forEach((col) => {
        out[col.label] = this.formatValue(this.getByPath(row, col.key));
      });
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Export');
    const finalName = fileName.toLowerCase().endsWith('.xlsx')
      ? fileName
      : `${fileName}.xlsx`;
    XLSX.writeFile(wb, finalName);
  }
}
