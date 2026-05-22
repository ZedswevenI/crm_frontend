import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AuthService } from '../../../../service/auth/auth.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-phaselist',
  standalone: false,
  templateUrl: './phaselist.component.html',
  styleUrl: './phaselist.component.scss'
})
export class PhaselistComponent implements OnInit {

   tenantId: string = '';
  isProceed = false;
  loading = false;
  selectedPhase: any = null;
  phaseForm!: FormGroup;

  // ── Programs ──
  programs: any[] = [];
  selectedProgram: any = null;

  // ── All classes (full list) ──
  allClasses = [
    { label: '6th', value: 6 },
    { label: '7th', value: 7 },
    { label: '8th', value: 8 },
    { label: '9th', value: 9 },
    { label: '10th', value: 10 },
    { label: '11th', value: 11 },
    { label: '12th', value: 12 },
    { label: '12th Pass', value: 13 },
  ];
  class_options: any[] = [...this.allClasses];
  allSubjects: any[] = [];
  subject_options: any[] = [];
  dataArray: any[] = [];
  totalRecords = 0;
  
  // Changed mapping from Name to Code
  private programCodeToId = new Map<string, string>();

  columnsArray = [
    { key: 'phaseName', label: 'Phase Name', sortable: false },
    { key: 'subjectId.subjectName', label: 'Subject', sortable: false },
    { key: 'topicCount', label: 'No. of Topics', sortable: true },
    { key: 'totalHours', label: 'Total Est. Hours', sortable: false },
    { key: 'sortOrder', label: 'Sort Order', sortable: true },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa fa-eye',
      tooltip: 'View',
      color: '#6B7280',
      hoverColor: '#0066FF',
      callback: (row: any) => this.onView(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-pen-to-square',
      tooltip: 'Edit',
      color: '#6B7280',
      hoverColor: '#0066FF',
      callback: (row: any) => this.onEdit(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-trash',
      tooltip: 'Delete',
      color: '#6B7280',
      hoverColor: '#0066FF',
      callback: (row: any) => this.onDelte(row),
    },
  ];

  // ── Import state ──
  parsing = false;
  importLoading = false;
  importRows: any[] = [];
  importResult: any = null;
  importPreview = {
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    phasesCount: 0,
    clientErrors: [] as string[],
  };
  private subjectNameToId = new Map<string, string>();
  private excelMappedRows: any[] = [];
  previewLimit = 25;
  importPreviewRows: Array<{
    rowNo: number;
    programRaw: string;
    classNoRaw: string;
    subjectRaw: string;
    phaseName: string;
    topicName: string;
    estHoursRaw: string;
    status: 'valid' | 'invalid';
    reason?: string;
  }> = [];
  invalidPreviewReasons: Array<{ rowNo: number; reason: string }> = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private commonApi: CommonapiService,
    private alert: AlertService,
    private breadcrump: BredcrumpService,
    private authService: AuthService,
  ) {
    this.tenantId = localStorage.getItem('tenantId') || '';
    this.breadcrump.set([
      { label: 'Students & Batches' },
      { label: 'Phase Plan', link: '/app/phase' }]);
  }

  ngOnInit(): void {
    this.initForm();
    const role = this.authService.getRole();
    // if (role === 'L4') {
    //   this.loadTeacherMaps();
    // } else {
    //   this.loadPrograms();
    //   this.loadSubjects();
    // }
     this.loadTeacherMaps();
  }

  private loadTeacherMaps(): void {
    const staffId = this.authService.getStaffId();
    this.commonApi.fetchData({ tenantId: this.tenantId, staffId }, 'teacher', 'getstaffmaps').subscribe({
      next: (res: any) => {
        if (res.status && res.data) {
          const data = res.data;
          // Programs from batches
          const programMap = new Map();
          (data.batches || []).forEach((b: any) => {
            if (b.programId) {
              programMap.set(b.programId, {
                programId: b.programId,
                programName: b.programName,
                programCode: b.batchCode.split('-')[0], // fallback
                status: 'Active',
                startingClass: b.classNo,
                endingClass: b.classNo,
                subjects: (b.subjects || []).map((s: any) => s.subjectId)
              });
            }
          });
          this.programs = Array.from(programMap.values()).map(p => ({
            ...p,
            proname: `${p.programCode} - ${p.programName}`
          }));

          // Classes
          this.allClasses = (data.classes || []).map((c: any) => ({
            label: `${c.classNo}${c.classNo > 3 ? 'th' : ''}`,
            value: c.classNo
          }));
          this.class_options = [...this.allClasses];

          // Subjects
          this.allSubjects = (data.subjects || []).map((s: any) => ({
            _id: s.subjectId,
            subjectName: s.subjectName,
            subjectCode: s.subjectCode || ''
          }));
          this.subject_options = [
            { _id: 'ALL', subjectName: 'All' },
            ...this.allSubjects,
          ];
        }
      },
      error: () => this.alert.error('Error loading teacher maps')
    });
  }

  // ====================================================
  // FORM
  // ====================================================

  private initForm(): void {
    this.phaseForm = this.fb.group({
      programId: ['', Validators.required],
      class: [null, Validators.required],
      subject: ['', Validators.required],
    });

    // Program change → filter class & subject
    this.phaseForm.get('programId')?.valueChanges.subscribe((val) => {
      this.onProgramChange(val);
    });
  }

  // ====================================================
  // PROGRAM CHANGE
  // ====================================================

  onProgramChange(programId: string): void {
    this.selectedProgram =
      this.programs.find((p) => p.programId === programId) || null;

    // Reset dependent fields + table
    this.phaseForm.patchValue(
      { class: null, subject: '' },
      { emitEvent: false },
    );
    this.isProceed = false;
    this.dataArray = [];

    if (!this.selectedProgram) {
      this.class_options = [...this.allClasses];
      this.subject_options = [...this.allSubjects];
      return;
    }

    // Filter classes between startingClass → endingClass
    this.class_options = this.allClasses.filter(
      (c) =>
        c.value >= this.selectedProgram.startingClass &&
        c.value <= this.selectedProgram.endingClass,
    );

    // Filter subjects by program's subjects array (_id list)
    const programSubjectIds: string[] = this.selectedProgram.subjects || [];
    this.subject_options = [
      { _id: 'ALL', subjectName: 'All' },
      ...this.allSubjects.filter((s) =>
        programSubjectIds.includes(s._id),
      ),
    ];
  }

  // ====================================================
  // LOADERS
  // ====================================================

  private loadPrograms(): void {
    this.commonApi
      .fetchData({ entiId: this.tenantId }, 'ims/program', 'list?list=full')
      .subscribe({
        next: (res: any) => {
          this.programs = (res?.data || [])
            .filter((p: any) => p.status === 'Active')
            .map((p: any) => ({
              ...p,
              proname: `${p.programCode || p.programCodes} - ${p.programName}`,
            }));
            
          this.programCodeToId.clear();
          this.programs.forEach((p) => {
            const code = String(p.programCode || p.programCodes || '').trim().toLowerCase();
            if (code) {
              this.programCodeToId.set(code, p.programId);
            }
          });
        },
        error: () => this.alert.error('Error loading programs'),
      });
  }

  private loadSubjects(): void {
    this.commonApi
      .fetchData({ entiId: this.tenantId }, 'ims/subject', 'list?list=full')
      .subscribe({
        next: (res: any) => {
          this.allSubjects = res?.data || [];
          this.subject_options = [
            { _id: 'ALL', subjectName: 'All' },
            ...this.allSubjects,
          ];
        },
        error: () => this.alert.error('Error loading subjects'),
      });
  }

  // ====================================================
  // PROCEED / LIST
  // ====================================================

  onProceed(): void {
    if (this.phaseForm.invalid) return;
    const {
      programId,
      class: classNo,
      subject: subjectId,
    } = this.phaseForm.value;
    this.loading = true;
    this.isProceed = false;

    let queryStr = `list?classNo=${classNo}&programId=${programId}`;
    if (subjectId && subjectId !== 'ALL') {
      queryStr += `&subjectId=${subjectId}`;
    }

    this.commonApi
      .fetchData(
        { tenantId: this.tenantId },
        'institue/phase',
        queryStr,
      )
      .subscribe({
        next: (res: any) => {
          const raw: any[] = res?.data || [];
          this.dataArray = raw.map((p: any) => ({
            ...p,
            topicCount: p.topics?.length || 0,
            totalHours:
              p.topics?.reduce(
                (sum: number, t: any) => sum + (t.estHours || 0),
                0,
              ) || 0,
          }));
          this.totalRecords = res?.count || this.dataArray.length;
          this.isProceed = true;
          this.loading = false;
        },
        error: () => {
          this.alert.error('Error loading phase plans');
          this.loading = false;
        },
      });
  }

  // ====================================================
  // ACTIONS
  // ====================================================

  onEdit(row: any) {
    this.router.navigate(['/app/phase/create'], { state: { phase: row } });
  }

  onView(row: any) {
    this.selectedPhase = {
      ...row,
      topics: [...(row.topics || [])].sort((a, b) => a.sortOrder - b.sortOrder),
    };
    const modalEl = document.getElementById('phaseViewModal');
    if (modalEl) new (window as any).bootstrap.Modal(modalEl).show();
  }

  onDelte(row: any) {
    if (!confirm(`Delete "${row.phaseName}"?`)) return;
    this.commonApi
      .fetchData(
        { tenantId: this.tenantId, phaseId: row.phaseId },
        'institue/phase',
        'delete',
      )
      .subscribe({
        next: (res: any) => {
          if (res?.status) {
            this.alert.success('Phase plan deleted');
            this.dataArray = this.dataArray.filter(
              (d) => d.phaseId !== row.phaseId,
            );
            this.totalRecords = this.dataArray.length;
          }
        },
        error: () => this.alert.error('Error deleting phase plan'),
      });
  }

  getTotalHours(): number {
    return (this.selectedPhase?.topics || []).reduce(
      (sum: number, t: any) => sum + (t.estHours || 0),
      0,
    );
  }

  getAvgHours(): string {
    const topics = this.selectedPhase?.topics || [];
    if (!topics.length) return '0';
    return (this.getTotalHours() / topics.length).toFixed(1);
  }

  exportPhase(): void {
    if (!this.selectedPhase) return;
    const phase = this.selectedPhase;
    const subjectName = phase.subjectId?.subjectName || phase.subjectName || '';
    const topics = phase.topics || [];

    const rows = topics.map((t: any, i: number) => ({
      'Phase Name': i === 0 ? phase.phaseName : '',
      'Class': i === 0 ? phase.classNo : '',
      'Subject': i === 0 ? subjectName : '',
      'Status': i === 0 ? phase.status : '',
      'Sort Order (Phase)': i === 0 ? phase.sortOrder : '',
      'Topic Name': t.topicName || '',
      'Est. Hours': t.estHours || 0,
      'Sort Order (Topic)': t.sortOrder || 0,
    }));

    if (!rows.length) {
      rows.push({
        'Phase Name': phase.phaseName,
        'Class': phase.classNo,
        'Subject': subjectName,
        'Status': phase.status,
        'Sort Order (Phase)': phase.sortOrder,
        'Topic Name': '',
        'Est. Hours': 0,
        'Sort Order (Topic)': 0,
      });
    }

    // Add summary row
    rows.push({});
    rows.push({
      'Phase Name': 'Summary',
      'Class': '',
      'Subject': '',
      'Status': '',
      'Sort Order (Phase)': '',
      'Topic Name': `Total Topics: ${topics.length}`,
      'Est. Hours': this.getTotalHours(),
      'Sort Order (Topic)': '',
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Phase Plan');
    XLSX.writeFile(wb, `Phase_${phase.phaseName}_${subjectName}.xlsx`);
  }

  // ====================================================
  // IMPORT MODAL
  // ====================================================

  openImportModal() {
    this.resetImportState();
    if (!this.allSubjects?.length) {
      this.alert.error('Subjects not loaded yet. Please try again.');
      return;
    }
    this.subjectNameToId.clear();
    this.allSubjects.forEach((s: any) => {
      const key = this.normalizeName(s.subjectName);
      if (key) this.subjectNameToId.set(key, s._id);
    });
    const modalEl = document.getElementById('phaseImportModal');
    if (modalEl) new (window as any).bootstrap.Modal(modalEl).show();
  }

  private resetImportState(): void {
    this.importResult = null;
    this.importRows = [];
    this.excelMappedRows = [];
    this.previewLimit = 25;
    this.importPreviewRows = [];
    this.invalidPreviewReasons = [];
    this.importPreview = {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      phasesCount: 0,
      clientErrors: [],
    };
  }

  downloadSampleExcel() {
    const header = [
      'Program Code',
      'Class',
      'Subject',
      'Topics',
      'No of Hrs',
      'Phase',
    ];
    const rows = [
      ['JEE-REG', '6th', 'Mathematics', 'Algebra Basics', 2, 'Phase 1'],
      ['JEE-REG', '6th', 'Mathematics', 'Numbers', 1, 'Phase 1'],
      ['NEET-CR', '6th', 'Mathematics', 'Fractions', 2, 'Phase 2'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PhasePlan');
    XLSX.writeFile(wb, 'Phase_Plan_Import_Format.xlsx');
  }

  onImportFileSelected(event: Event) {
    this.resetImportState();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      this.alert.error('Please upload a valid Excel file (.xlsx/.xls).');
      input.value = '';
      return;
    }
    this.parsing = true;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const sheetRows: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
        });
        const headerRowIndex = this.findHeaderRowIndex(sheetRows);
        if (headerRowIndex === -1) {
          this.alert.error('Invalid template. Header row not found.');
          this.parsing = false;
          return;
        }
        const headers = sheetRows[headerRowIndex].map((h) =>
          String(h || '').trim(),
        );
        const dataRows = sheetRows
          .slice(headerRowIndex + 1)
          .filter((r) => r.some((cell) => String(cell || '').trim() !== ''));
        this.excelMappedRows = this.mapExcelRows(headers, dataRows);
        this.validateAndPrepareImport();
      } catch {
        this.alert.error('Failed to read Excel. Please check the file format.');
        this.parsing = false;
      } finally {
        input.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private findHeaderRowIndex(rows: any[][]): number {
    // Note: ensure this matches the downloaded sample format!
    const required = ['Program Code', 'Class', 'Subject', 'Topics', 'No of Hrs', 'Phase'];
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const r = rows[i].map((x) =>
        String(x || '')
          .trim()
          .toLowerCase(),
      );
      if (required.every((k) => r.includes(k.toLowerCase()))) return i;
    }
    return -1;
  }

  private mapExcelRows(headers: string[], rows: any[][]) {
    const idx = new Map<string, number>();
    headers.forEach((h, i) => idx.set(String(h).trim().toLowerCase(), i));
    const get = (row: any[], name: string) => {
      const i = idx.get(name.toLowerCase());
      return i === undefined ? '' : row[i];
    };
    return rows.map(r => ({
      programRaw:  String(get(r, 'Program Code') || '').trim(), 
      classNoRaw:  String(get(r, 'Class')      || '').trim(),
      subjectRaw:  String(get(r, 'Subject')    || '').trim(),
      phaseName:   String(get(r, 'Phase')      || '').trim(),
      topicName:   String(get(r, 'Topics')     || '').trim(),
      estHoursRaw: String(get(r, 'No of Hrs')  || '').trim(),
    }));
  }

  private validateAndPrepareImport() {
    const errors: string[] = [];
    const phaseSet = new Set<string>();
    this.importPreviewRows = [];
    this.invalidPreviewReasons = [];
    this.importRows = [];

    // Tracks auto-incrementing sort order per phase group
    const phaseTopicCounters = new Map<string, number>();

    let validCount = 0;

    this.excelMappedRows.forEach((r, idx) => {
      const rowNo = idx + 1;
      const basePreview = {
        rowNo, 
        programRaw: r.programRaw,
        classNoRaw: r.classNoRaw, 
        subjectRaw: r.subjectRaw,
        phaseName: String(r.phaseName || '').trim(),
        topicName: String(r.topicName || '').trim(),
        estHoursRaw: String(r.estHoursRaw || '').trim()
      };

      const codeLookup = String(r.programRaw || '').toLowerCase();
      const programId = this.programCodeToId.get(codeLookup);
      
      if (!programId) {
        const reason = `Program Code not found "${r.programRaw}"`;
        errors.push(`Row ${rowNo}: ${reason}`);
        this.importPreviewRows.push({ ...basePreview, status: 'invalid', reason });
        return;
      }

      const classNo = this.parseClassNo(r.classNoRaw);
      if (!classNo) {
        const reason = `Invalid Class "${r.classNoRaw}"`;
        errors.push(`Row ${rowNo}: ${reason}`);
        this.importPreviewRows.push({ ...basePreview, status: 'invalid', reason });
        return;
      }

      const subjectId = this.resolveSubjectId(r.subjectRaw);
      if (!subjectId) {
        const reason = `Subject not found "${r.subjectRaw}"`;
        errors.push(`Row ${rowNo}: ${reason}`);
        this.importPreviewRows.push({ ...basePreview, status: 'invalid', reason });
        return;
      }

      const { phaseName, topicName } = basePreview;
      if (!phaseName || !topicName) {
        const reason = `Phase / Topic cannot be empty`;
        errors.push(`Row ${rowNo}: ${reason}`);
        this.importPreviewRows.push({ ...basePreview, status: 'invalid', reason });
        return;
      }

      let estHours: number | null = null;
      if (basePreview.estHoursRaw) {
        const parsed = Number(basePreview.estHoursRaw);
        if (Number.isFinite(parsed) && parsed > 0) estHours = parsed;
      }

      // Auto-assign Sort Order
      const phaseKey = `${programId}_${classNo}_${subjectId}_${phaseName.toLowerCase()}`;
      let currentSortOrder = phaseTopicCounters.get(phaseKey) || 0;
      currentSortOrder++;
      phaseTopicCounters.set(phaseKey, currentSortOrder);
      phaseSet.add(phaseName.toLowerCase());

      this.importRows.push({
        programId,
        classNo,
        subjectId,
        phaseName,
        phaseSortOrder: 1, 
        topicName,
        estHours,
        topicSortOrder: currentSortOrder 
      });

      this.importPreviewRows.push({ ...basePreview, status: 'valid' });
      validCount++;
    });

    this.importPreview.totalRows = this.excelMappedRows.length;
    this.importPreview.phasesCount = phaseSet.size;
    this.importPreview.clientErrors = errors;
    this.importPreview.validRows = validCount;
    this.importPreview.invalidRows = this.excelMappedRows.length - validCount;
    
    this.parsing = false;

    if (!this.importRows.length) {
      this.alert.error('No valid rows found. Fix Excel and try again.');
    }
  }

  private resolveSubjectId(subjectRaw: string): string | null {
    const s = String(subjectRaw || '').trim();
    if (!s) return null;
    if (/^[a-fA-F0-9]{24}$/.test(s)) return s;
    return this.subjectNameToId.get(this.normalizeName(s)) || null;
  }

  private parseClassNo(classRaw: string): number | null {
    const v = String(classRaw || '')
      .trim()
      .toLowerCase();
    if (!v) return null;
    if (v.includes('pass')) return 13;
    const n = Number(v.replace(/[^0-9]/g, ''));
    return Number.isFinite(n) && n >= 1 ? n : null;
  }

  private normalizeName(v: string): string {
    return String(v || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  submitImport() {
    if (this.importLoading || this.parsing) return;
    if (!this.importRows.length) {
      this.alert.error('Please upload a valid Excel file first.');
      return;
    }
    const payload = {
      tenantId: this.tenantId,
      userId: localStorage.getItem('userid') || '',
      rows: this.importRows,
    };
    this.importLoading = true;
    this.commonApi
      .fetchData(payload, 'institue/phase', 'bulkupload')
      .subscribe({
        next: (res: any) => {
          this.importLoading = false;
          if (!res?.status) {
            this.alert.error(res?.message || 'Import failed');
            return;
          }
          this.importResult = { message: res?.message, ...res?.data };
          this.alert.success(res?.message || 'Import completed');
          if (this.isProceed) this.onProceed();
        },
        error: (e) => {
          this.importLoading = false;
          this.alert.error(
            e?.error?.message || 'Import failed. Please try again.',
          );
        },
      });
  }

  get hasPreviewInvalidReasons(): boolean {
    return this.invalidPreviewReasons.length > 0;
  }
}
