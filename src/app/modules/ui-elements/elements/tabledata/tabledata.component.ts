import { Component, Input, OnInit, OnChanges, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';

@Component({
  selector: 'viewtable',
  standalone: false,
  templateUrl: './tabledata.component.html',
  styleUrl: './tabledata.component.scss'
})
export class TabledataComponent implements OnInit, OnChanges, AfterViewInit {
 // Table details
  @Input() columns: { key: string; label: string; sortable: boolean; date?: boolean; maxWidthPx?: number }[] = [];
  @Input() data: any[] = [];
  @Input() actions: any[] = [];
  @Input() showaction: boolean = true;
  @Input() pageSizeOptions = [5, 10, 20, 50];
  @Input() loading: boolean = false;
  @Input() showpageoptions: boolean = true;

  // --- NEW: optional auto-fit for truncation length ---
  @Input() autoFitChars = false;   // set true to estimate chars from container width
  @Input() baseCharWidth = 8;      // approx px/char for your font
  @Input() minChars = 12;          // lower bound when auto-fitting
  @Input() hardMaxChars = 30;      // default truncation length when not auto-fitting

  @ViewChild('tableWrap', { static: false }) tableWrap?: ElementRef<HTMLDivElement>;
  private containerWidth = 0;

  // pagination options
  currentPage = 1;
  pageSize = 10;
  pagedData: any[] = [];
  totalPages = 1;

  // Sorting options
  sortKey: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Search (kept for API symmetry; filtering happens outside in your app)
  searchText = '';
  filteredData: any[] = [];

  constructor() {}

  ngOnInit(): void {
    this.pageSize = this.pageSizeOptions[0];
    this.updatePagedData();
  }

  ngOnChanges(): void {
    this.updatePagedData();
  }

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

    // Estimate chars per cell using available width and number of columns (+ S.NO + optional ACTION)
    const fixedCols = 1 + (this.showaction ? 1 : 0); // S.NO + ACTION
    const totalCols = Math.max(1, (this.columns?.length || 1) + fixedCols);
    const paddingGuard = 64; // account for paddings/scrollbar
    const perColPx = Math.max(80, Math.floor((this.containerWidth - paddingGuard) / totalCols));
    const approxChars = Math.floor(perColPx / this.baseCharWidth);

    return Math.max(this.minChars, Math.min(this.hardMaxChars, approxChars));
  }

  // ---------- Existing logic ----------
  getSortedData(): any[] {
    if (!this.sortKey) return this.data || [];
    return [...(this.data || [])].sort((a, b) => {
      let valueA = a[this.sortKey];
      let valueB = b[this.sortKey];

      if (valueA == null) valueA = '';
      if (valueB == null) valueB = '';

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      if (valueA < valueB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  updatePagedData() {
    // (Optional) local search if you wire 'searchText' here
    this.filteredData = this.data.filter((row) => {
      if (!this.searchText) return true;
      return this.columns.some((col) => {
        const cell = row[col.key];
        return cell && cell.toString().toLowerCase().includes(this.searchText.toLowerCase());
      });
    });

    // Sort
    let dataToDisplay = [...this.filteredData];
    if (this.sortKey) {
      dataToDisplay.sort((a, b) => {
        const v1 = (a[this.sortKey] ?? '').toString().toLowerCase();
        const v2 = (b[this.sortKey] ?? '').toString().toLowerCase();
        if (v1 === v2) return 0;
        if (this.sortDirection === 'asc') return v1 > v2 ? 1 : -1;
        else return v1 < v2 ? 1 : -1;
      });
    }

    // Paginate
    this.totalPages = Math.ceil(dataToDisplay.length / this.pageSize) || 1;
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedData = dataToDisplay.slice(start, start + this.pageSize);
  }

  onPageChange(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagedData();
  }

  onPageSizeChange(size: number) {
    this.pageSize = +size;
    this.currentPage = 1;
    this.updatePagedData();
  }

  onSort(key: string) {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
    this.updatePagedData();
  }

  getCellValue(row: any, key: string): any {
    if (!row || !key) return '--';
    const parts = key.split('.');
    let curr: any = row;

    for (const part of parts) {
      if (curr == null) return '--';

      if (Array.isArray(curr)) {
        const mapped = curr.map((item) => (item != null ? item[part] : undefined)).filter((v) => v !== undefined && v !== null);
        if (mapped.length === 0) return '--';
        curr = mapped;
      } else {
        curr = curr[part];
      }
    }
    let value = curr;
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

