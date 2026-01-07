import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, input, ViewChild, ElementRef, HostListener } from '@angular/core';

@Component({
  selector: 'list-table',
  standalone: false,
  templateUrl: './list-table.component.html',
  styleUrl: './list-table.component.scss'
})
export class ListTableComponent {
  @Input() columns: { key: string; label: string; sortable: boolean; date?: boolean; maxWidthPx?: number }[] = [];
  @Input() data: any[] = [];
  @Input() actions: any[] = [];
  @Input() showaction: boolean = true;
  @Input() showfilter: boolean = false;
  @Input() pageSizeOptions = [5, 10, 20, 50];
  @Input() totalRecords: number = 0;
  @Input() loading: boolean = false;
  @Input() showpageoptions: boolean = true;
  @Input() showsearch: boolean = true;
  @Input() autoFitChars = false;
  @Input() baseCharWidth = 8;
  @Input() minChars = 12;
  @Input() hardMaxChars = 30;
  @ViewChild('tableWrap', { static: false }) tableWrap?: ElementRef<HTMLDivElement>;
  private containerWidth = 0;
  @Output() requestData = new EventEmitter<{
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
  }>();
  paginationItems: Array<{ page: number | '...'; isActive?: boolean }> = [];
  @Output() filterClicked = new EventEmitter<void>();
  currentPage = 1;
  pageSize = 5;
  sortKey: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  searchText = '';
  filteredData: any[] = [];
  get totalPages(): number {
    return Math.ceil(this.totalRecords / this.pageSize) || 1;
  }

  constructor() {}

  ngOnInit(): void {
    this.pageSize = this.pageSizeOptions[0];
    if (this.columns) {
      this.columns = this.columns.map((col) => ({
        ...col,
        date: col.date ?? false
      }));
    }
    this.emitRequest();
    this.updatePagination();
  }

  onOpenFilters() {
    this.filterClicked.emit();
  }

  clearSearch(): void {
    this.searchText = '';
    this.onSearch();
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['totalRecords'] || changes['pageSize'] || changes['currentPage']) {
      this.updatePagination();
    }
  }

  onSearch() {
    this.currentPage = 1;
    this.emitRequest();
    this.updatePagination();
  }

  onPageChange(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.emitRequest();
    this.updatePagination();
  }

  onPageSizeChange(size: number) {
    this.pageSize = +size;
    this.currentPage = 1;
    this.emitRequest();
    this.updatePagination();
  }

  onSort(key: string) {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
    this.emitRequest();
    this.updatePagination();
  }

  emitRequest() {
    this.requestData.emit({
      page: this.currentPage,
      pageSize: this.pageSize,
      search: this.searchText,
      sortKey: this.sortKey,
      sortDirection: this.sortDirection
    });
  }

  private updatePagination(): void {
    const total = this.totalPages || 1;
    const current = this.currentPage || 1;
    const pages: Array<number | '...'> = [];
    const push = (p: number | '...') => pages.push(p);
    if (total <= 7) {
      for (let p = 1; p <= total; p++) push(p);
    } else {
      const showLeft = Math.max(2, current - 1);
      const showRight = Math.min(total - 1, current + 1);
      push(1);
      if (showLeft > 2) push('...');
      for (let p = showLeft; p <= showRight; p++) push(p);
      if (showRight < total - 1) push('...');
      push(total);
    }
    this.paginationItems = pages.map((p) => ({
      page: p,
      isActive: p === current
    })) as any;
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

  truncate(value: any, col?: any): string {
    const s = this.stringify(value);
    if (s === '--') return s;
    const max = this.getMaxChars(col);
    return s.length > max ? `${s.slice(0, Math.max(0, max - 1))}…` : s;
  }

  needsTooltip(value: any, col?: any): boolean {
    const s = this.stringify(value);
    if (s === '--') return false;
    return s.length > this.getMaxChars(col);
  }

  private stringify(v: any): string {
    if (v === null || v === undefined) return '--';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  private getMaxChars(col?: any): number {
    if (!this.autoFitChars || !this.containerWidth) return this.hardMaxChars;
    const fixedCols = 1 + (this.showaction ? 1 : 0);
    const numDataCols = Math.max(1, (this.columns?.length || 1) + fixedCols);
    const paddingGuard = 64;
    const perColPx = Math.max(80, Math.floor((this.containerWidth - paddingGuard) / numDataCols));
    const approxChars = Math.floor(perColPx / this.baseCharWidth);
    return Math.max(this.minChars, Math.min(this.hardMaxChars, approxChars));
  }

  expanded: { rowIndex: number; colKey: string; value: string } | null = null;
  private collapseTimer: any = null;
  get fullColSpan(): number {
    return 1 + (this.columns?.length || 0) + (this.showaction ? 1 : 0);
  }

  columnLabel(key: string): string {
    const c = (this.columns || []).find((col) => col.key === key);
    return c?.label || key;
  }

  maybeExpand(rowIndex: number, colKey: string, value: any, col?: any) {
    const text = this.stringify(value);
    if (!this.needsTooltip(text, col)) return;
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer);
      this.collapseTimer = null;
    }
    this.expanded = { rowIndex, colKey, value: text };
  }

  scheduleCollapse(delayMs: number = 180) {
    if (this.collapseTimer) clearTimeout(this.collapseTimer);
    this.collapseTimer = setTimeout(() => {
      this.expanded = null;
      this.collapseTimer = null;
    }, delayMs);
  }

  onExpanderEnter() {
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer);
      this.collapseTimer = null;
    }
  }
  onExpanderLeave() {
    this.scheduleCollapse(120);
  }
}
