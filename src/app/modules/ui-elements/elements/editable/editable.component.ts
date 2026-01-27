import {
  Component, Input, Output, EventEmitter, OnInit, ElementRef, ViewChild, AfterViewInit, HostListener
} from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';

@Component({
  selector: 'editable',
  standalone: false,
  templateUrl: './editable.component.html',
  styleUrl: './editable.component.scss'
})
export class EditableComponent implements OnInit, AfterViewInit {
  @Input() formFields: any[] = [];
  @Input() columns: { key: string; label: string; maxWidthPx?: number }[] = [];
  @Input() data: any[] = [];
  @Input() form!: FormGroup;
  @Input() rowsno!: { icon: string; color?: string; hoverColor?: string; tooltip?: string; callback: () => void };
  @Input() formaction: {
    icon: string;
    color?: string;
    tooltip?: string;
    hoverColor: string;
    callback: () => void;
    disabled?: () => boolean;
  }[] = [];

  @Input() actions: any;
  @Output() rowAction = new EventEmitter<{ action: any; row: any }>();
  @Output() formSubmit = new EventEmitter<any>();

  /** Optional auto-fit for truncation length */
  @Input() autoFitChars = false;   // set to true to auto-size truncation
  @Input() baseCharWidth = 8;      // approx px/char for your font
  @Input() minChars = 12;          // lower bound when auto-fitting
  @Input() hardMaxChars = 30;      // default truncation length when not auto-fitting

  @ViewChild('tableWrap', { static: false }) tableWrap?: ElementRef<HTMLDivElement>;
  private containerWidth = 0;

  constructor(private fb: FormBuilder) {}

  ngOnInit() {}

  ngAfterViewInit(): void {
    this.measureContainer();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.measureContainer();
  }

  private measureContainer() {
    if (!this.tableWrap) return;
    const w = this.tableWrap.nativeElement.clientWidth || 0;
    if (w && w !== this.containerWidth) {
      this.containerWidth = w;
    }
  }

  // ---------- Tooltip + truncation helpers ----------
  truncate(value: any): string {
    const s = this.stringify(value);
    if (s === '--') return s;
    const max = this.getMaxChars();
    return s.length > max ? `${s.slice(0, Math.max(0, max - 1))}…` : s;
  }

  needsTooltip(value: any): boolean {
    const s = this.stringify(value);
    if (s === '--') return false;
    return s.length > this.getMaxChars();
  }

  private stringify(v: any): string {
    if (v === null || v === undefined) return '--';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try { return JSON.stringify(v); } catch { return String(v); }
  }

  private getMaxChars(): number {
    if (!this.autoFitChars || !this.containerWidth) return this.hardMaxChars;

    // Estimate chars per cell using available width and number of columns (+ S.NO + ACTION)
    const fixedCols = 2; // S.NO + ACTION
    const totalCols = Math.max(1, (this.columns?.length || 1) + fixedCols);
    const paddingGuard = 64; // account for paddings/scrollbar
    const perColPx = Math.max(80, Math.floor((this.containerWidth - paddingGuard) / totalCols));
    const approxChars = Math.floor(perColPx / this.baseCharWidth);

    return Math.max(this.minChars, Math.min(this.hardMaxChars, approxChars));
  }

  // ---------- Existing logic ----------
  onselect(_e: any, _t23: any, _arg2: FormGroup<any>) {
    // No-op placeholder (kept to match your API surface)
  }

  getCellValue(row: any, key: string): any {
    if (!row || !key) return '';

    if (key.includes('.')) {
      const [parentKey, childKey] = key.split('.');
      const parentValue = row[parentKey];

      if (Array.isArray(parentValue)) {
        const arr = parentValue.map((obj: any) => obj?.[childKey]).filter(Boolean);
        return arr.length ? arr.join(', ') : '--';
      }
      if (typeof parentValue === 'object' && parentValue !== null) {
        return parentValue[childKey] ?? '--';
      }
      return '--';
    }

    let value = row[key];
    if (Array.isArray(value)) {
      if (value.length === 0) return '--';
      if (typeof value[0] === 'string' || typeof value[0] === 'number' || typeof value[0] === 'boolean') {
        return value.join(', ');
      }
      return value.length;
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return value ?? '--';
  }
}
