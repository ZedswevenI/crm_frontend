import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

declare var bootstrap: any;

const safeTrim = (v: any) =>
  v === undefined || v === null ? '' : String(v).trim();

@Component({
  selector: 'app-batchview',
  standalone: false,
  templateUrl: './batchview.component.html',
  styleUrl: './batchview.component.scss',
})
export class BatchviewComponent implements OnInit {
  loading = false;
  entiId: any;
  private moduleName = 'batch';
  batchId = '';
  batch: any = null;

  activeTab: 'students' | 'faculty' = 'students';
  offcanvasMode: 'none' | 'edit' | 'staff' | 'assign' | 'shuffle' = 'none';
  studentRows: any[] = [];
  selected = new Set<string>();
  editForm!: FormGroup;
  staffForm!: FormGroup;
  eligibleRows: any[] = [];
  eligibleCount = 0;
  eligibleQuery = { page: 1, limit: 20, search: '' };
  eligibleSelected = new Set<string>();
  batchesFull: any[] = [];
  shuffleToBatchId = '';
  editStatusOptions = [
    { label: 'ACTIVE', value: 'ACTIVE' },
    { label: 'DRAFT', value: 'DRAFT' },
    { label: 'CLOSED', value: 'CLOSED' },
    { label: 'INACTIVE', value: 'INACTIVE' },
  ];
  subjectsOptions: any[] = [{ label: '-- Select Subject --', value: '' }];
  staffOptionsAll: any[] = [{ label: '-- Select Faculty --', value: '' }];
  staffOptionsByRow: any[][] = [];
  batchesFullOptions: any[] = [{ label: '-- Select --', value: '' }];
  subjectsList: any[] = [];
  staffList: any[] = [];

  confirmData = {
    title: '',
    message: '',
    btnText: 'Confirm',
    btnClass: 'btn-danger',
    action: () => {},
  };

  @ViewChild('confirmModal') confirmModalRef!: ElementRef;
  private bsModal: any;
  private allBatchesRaw: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
  ) {
    this.entiId = localStorage.getItem('tenantId');
  }

  ngOnInit(): void {
    this.batchId = safeTrim(this.route.snapshot.paramMap.get('batchId'));
    if (!this.batchId) {
      this.alert.error('Batch ID missing');
      this.router.navigate(['/app/batches']);
      return;
    }

    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Batches' },
      { label: 'View' },
    ]);
    this.initForms();
    this.loadBatch();
    this.loadBatchesFullForShuffle();
  }

  initForms() {
    this.editForm = this.fb.group({
      batchId: [this.batchId],
      batchName: ['', [Validators.required]],
      batchCode: ['', [Validators.required]],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      status: ['ACTIVE', [Validators.required]],
      remarks: [''],
    });

    this.staffForm = this.fb.group({
      staffMap: this.fb.array([]),
    });
  }

  private userId() {
    return (
      localStorage.getItem('userId') || localStorage.getItem('userid') || null
    );
  }

  private dateToEpochMs(dateStr: any): number {
    const s = safeTrim(dateStr);
    if (!s) return 0;
    const d = new Date(`${s}T00:00:00`);
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  }

  private epochMsToDateInput(ms: any): string {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return '';
    const d = new Date(n);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  asFormGroup(ctrl: AbstractControl): FormGroup {
    return ctrl as FormGroup;
  }

  get staffFA(): FormArray {
    return this.staffForm.get('staffMap') as FormArray;
  }

  private staffRowGroup(x?: any): FormGroup {
    return this.fb.group({
      subjectId: [safeTrim(x?.subjectId), [Validators.required]],
      subjectName: [safeTrim(x?.subjectName)],
      staffId: [safeTrim(x?.staffId), [Validators.required]],
      staffName: [safeTrim(x?.staffName)],
    });
  }

  onSubjectChange(index: number) {
    const group = this.staffFA.at(index) as FormGroup;
    const subjId = safeTrim(group.get('subjectId')?.value);
    const subj = (this.subjectsList || []).find(
      (s: any) => safeTrim(s?.subjectId) === subjId,
    );
    group.patchValue(
      { subjectName: safeTrim(subj?.subjectName || subj?.subjectCode || '') },
      { emitEvent: false },
    );
    const filtered = (this.staffList || []).filter(
      (st: any) => safeTrim(st?.subject) === subjId,
    );
    this.staffOptionsByRow[index] = [
      { label: '-- Select Faculty --', value: '' },
    ].concat(
      filtered.map((s: any) => ({
        label: `${s?.staffName || '-'} (${s?.staffCode || '-'})`,
        value: safeTrim(s?.staffId || s?._id),
        _raw: s,
      })),
    );
    const curStaffId = safeTrim(group.get('staffId')?.value);
    if (curStaffId) {
      const ok = (this.staffOptionsByRow[index] || []).some(
        (o: any) => safeTrim(o?.value) === curStaffId,
      );
      if (!ok)
        group.patchValue({ staffId: '', staffName: '' }, { emitEvent: false });
    }
  }

  onStaffChange(index: number) {
    const group = this.staffFA.at(index) as FormGroup;
    const sId = safeTrim(group.get('staffId')?.value);
    const st = (this.staffList || []).find(
      (s: any) => safeTrim(s?.staffId || s?._id) === sId,
    );
    if (st) {
      group.patchValue(
        { staffName: safeTrim(st?.staffName) },
        { emitEvent: false },
      );
    } else {
      group.patchValue({ staffName: '' }, { emitEvent: false });
    }
  }

  loadBatch() {
    this.loading = true;
    const payload = {
      entiId: this.entiId,
      batchId: this.batchId,
      includeStudents: true,
    };
    this.commonApi.fetchData(payload, this.moduleName, 'view').subscribe({
      next: (res: any) => {
        this.loading = false;
        this.batch = res?.data || null;
        this.rebuildShuffleTargets();
        this.studentRows = this.batch?.students || [];
        this.selected.clear();
        this.editForm.patchValue({
          batchName: this.batch?.batchName,
          batchCode: this.batch?.batchCode,
          startDate: this.epochMsToDateInput(this.batch?.startDate),
          endDate: this.epochMsToDateInput(this.batch?.endDate),
          status: this.batch?.status || 'ACTIVE',
          remarks: this.batch?.remarks || '',
        });
        this.staffFA.clear();
        const sm = Array.isArray(this.batch?.staffMap)
          ? this.batch.staffMap
          : [];
        sm.forEach((r: any) => this.staffFA.push(this.staffRowGroup(r)));
        const base = this.staffOptionsAll?.length
          ? [...this.staffOptionsAll]
          : [{ label: '-- Select Faculty --', value: '' }];
        this.staffOptionsByRow = Array(this.staffFA.length)
          .fill(null)
          .map(() => [...base]);
        if ((this.staffList || []).length) {
          for (let i = 0; i < this.staffFA.length; i++) {
            const g = this.staffFA.at(i) as FormGroup;
            const sid = safeTrim(g.get('subjectId')?.value);
            if (sid) this.onSubjectChange(i);
          }
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Failed to load batch');
      },
    });
  }

  openOffcanvas(mode: 'edit' | 'staff' | 'assign' | 'shuffle') {
    if (
      this.isClosed() &&
      (mode === 'edit' ||
        mode === 'staff' ||
        mode === 'assign' ||
        mode === 'shuffle')
    ) {
      this.alert.error('Batch is CLOSED. No changes allowed.');
      return;
    }
    this.offcanvasMode = mode;
    if (mode === 'staff') {
      if (!this.subjectsList.length) {
        this.commonApi
          .fetchData(
            { entiId: this.entiId, batchId: this.batchId },
            this.moduleName,
            'subjects',
          )
          .subscribe({
            next: (res: any) => {
              this.subjectsList = res?.data || [];
              this.subjectsOptions = [
                { label: '-- Select Subject --', value: '' },
              ].concat(
                this.subjectsList.map((s: any) => ({
                  label: `${s?.subjectName || '-'} (${s?.subjectCode || '-'})`,
                  value: safeTrim(s?.subjectId || s?._id),
                  _raw: s,
                })),
              );
            },
          });
      }
      if (!this.staffList.length) {
        this.commonApi
          .fetchData({ entiId: this.entiId }, 'ims', 'staff/list?list=full')
          .subscribe({
            next: (res: any) => {
              const all = res?.data || [];
              this.staffList = (all || []).filter(
                (s: any) =>
                  safeTrim(s?.facultyType).toUpperCase() === 'TEACHING',
              );
              this.staffOptionsAll = [
                { label: '-- Select Faculty --', value: '' },
              ].concat(
                this.staffList.map((s: any) => ({
                  label: `${s?.staffName || '-'} (${s?.staffCode || '-'})`,
                  value: safeTrim(s?.staffId || s?._id),
                  _raw: s,
                })),
              );
              this.staffOptionsByRow = Array(this.staffFA.length)
                .fill(null)
                .map(() => [...this.staffOptionsAll]);
            },
          });
      }
    }
    if (mode === 'assign') {
      this.eligibleSelected.clear();
      this.eligibleQuery = { page: 1, limit: 20, search: '' };
      this.loadEligible();
    }
    if (mode === 'shuffle') {
      if (this.isClosed()) {
        this.alert.error('Batch is CLOSED. No changes allowed.');
        this.closeOffcanvas();
        return;
      }
      const ids = Array.from(this.selected);
      if (!ids.length) {
        this.alert.error('Select students from the list first');
        this.closeOffcanvas();
        return;
      }
      this.shuffleToBatchId = '';
      this.rebuildShuffleTargets();
    }
  }

  closeOffcanvas() {
    this.offcanvasMode = 'none';
  }

  toggleSelect(studentId: string, checked: boolean) {
    const sid = safeTrim(studentId);
    if (!sid) return;
    checked ? this.selected.add(sid) : this.selected.delete(sid);
  }

  selectAllCurrent(checked: boolean) {
    if (checked)
      this.studentRows.forEach((s) => this.selected.add(safeTrim(s.studentId)));
    else this.selected.clear();
  }

  saveBatch() {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const v = this.editForm.value;
    const startMs = this.dateToEpochMs(v.startDate);
    const endMs = this.dateToEpochMs(v.endDate);

    if (startMs >= endMs) {
      this.alert.error('End Date must be after Start Date');
      return;
    }
    const payload = {
      entiId: this.entiId,
      userId: this.userId(),
      batchId: this.batchId,
      batchName: safeTrim(v.batchName),
      batchCode: safeTrim(v.batchCode),
      startDate: startMs,
      endDate: endMs,
      status: safeTrim(v.status),
      remarks: safeTrim(v.remarks) || null,
    };
    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, 'update').subscribe({
      next: () => {
        this.loading = false;
        this.alert.success('Batch updated');
        this.closeOffcanvas();
        this.loadBatch();
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Update failed');
      },
    });
  }

  addStaffRow() {
    this.staffFA.push(this.staffRowGroup());
    this.staffOptionsByRow.push([
      ...(this.staffOptionsAll || [
        { label: '-- Select Faculty --', value: '' },
      ]),
    ]);
  }

  removeStaffRow(i: number) {
    this.staffFA.removeAt(i);
    if (i >= 0 && i < this.staffOptionsByRow.length)
      this.staffOptionsByRow.splice(i, 1);
  }

  saveStaffMap() {
    if (this.staffForm.invalid) {
      this.staffForm.markAllAsTouched();
      return;
    }
    const staffMap = this.staffFA.value.map((x: any) => ({
      subjectId: safeTrim(x.subjectId),
      subjectName: safeTrim(x.subjectName) || null,
      staffId: safeTrim(x.staffId),
      staffName: safeTrim(x.staffName) || null,
    }));

    this.loading = true;
    this.commonApi
      .fetchData(
        {
          entiId: this.entiId,
          userId: this.userId(),
          batchId: this.batchId,
          staffMap,
        },
        this.moduleName,
        'staff/save',
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Faculty map saved');
          this.closeOffcanvas();
          this.loadBatch();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Save failed');
        },
      });
  }

  loadEligible() {
    const qp =
      `?page=${this.eligibleQuery.page}&limit=${this.eligibleQuery.limit}` +
      (this.eligibleQuery.search ? `&search=${this.eligibleQuery.search}` : '');
    this.loading = true;
    this.commonApi
      .fetchData(
        { entiId: this.entiId, batchId: this.batchId },
        this.moduleName,
        `students/eligible${qp}`,
      )
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.eligibleRows = res?.data || [];
          this.eligibleCount = res?.count || 0;
        },
        error: () => (this.loading = false),
      });
  }

  toggleEligible(id: string, checked: boolean) {
    const sid = safeTrim(id);
    if (!sid) return;
    checked
      ? this.eligibleSelected.add(sid)
      : this.eligibleSelected.delete(sid);
  }

  assignEligibleSelected() {
    const ids = Array.from(this.eligibleSelected);
    if (!ids.length) return;
    this.loading = true;
    this.commonApi
      .fetchData(
        {
          entiId: this.entiId,
          userId: this.userId(),
          batchId: this.batchId,
          studentIds: ids,
        },
        this.moduleName,
        'students/assign',
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Students assigned');
          this.closeOffcanvas();
          this.loadBatch();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Assign failed');
        },
      });
  }

  loadBatchesFullForShuffle() {
    this.commonApi
      .fetchData({ entiId: this.entiId }, this.moduleName, 'list?list=full')
      .subscribe({
        next: (res: any) => {
          this.allBatchesRaw = res?.data || [];
          this.rebuildShuffleTargets();
        },
        error: () => {
          this.allBatchesRaw = [];
          this.batchesFull = [];
        },
      });
  }

  shuffleSelected() {
    if (this.isClosed()) {
      this.alert.error('Batch is CLOSED. No changes allowed.');
      return;
    }
    const ids = Array.from(this.selected);
    if (!ids.length) {
      this.alert.error('Select students first');
      return;
    }
    const toId = safeTrim(this.shuffleToBatchId);
    if (!toId) {
      this.alert.error('Select target batch');
      return;
    }
    if (toId === safeTrim(this.batchId)) {
      this.alert.error('Target batch cannot be same as current batch');
      return;
    }
    const toBatch = this.getBatchByIdLocal(toId);
    if (!toBatch) {
      this.alert.error('Target batch not found');
      return;
    }
    if (!this.isSameCore(this.batch, toBatch)) {
      this.alert.error(
        'Cannot shuffle to a batch with different Program / Academic Year / Center',
      );
      return;
    }
    this.loading = true;
    this.commonApi
      .fetchData(
        {
          entiId: this.entiId,
          userId: this.userId(),
          fromBatchId: this.batchId,
          toBatchId: toId,
          studentIds: ids,
        },
        this.moduleName,
        'students/shuffle',
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Students shuffled');
          this.closeOffcanvas();
          this.selected.clear();
          this.loadBatch();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Shuffle failed');
        },
      });
  }

  triggerConfirmation(type: 'closeBatch' | 'removeStudents') {
    if (type === 'closeBatch') {
      this.confirmData = {
        title: 'Close Batch?',
        message:
          'This will mark the batch as CLOSED and release all assigned students. This action cannot be undone immediately.',
        btnText: 'Yes, Close Batch',
        btnClass: 'btn-danger',
        action: () => this.executeCloseBatch(),
      };
    } else if (type === 'removeStudents') {
      const count = this.selected.size;
      if (count === 0) {
        this.alert.error('Select students first');
        return;
      }
      this.confirmData = {
        title: 'Remove Students?',
        message: `Are you sure you want to remove ${count} student(s) from this batch? They will be moved to the unassigned pool.`,
        btnText: 'Remove',
        btnClass: 'btn-warning',
        action: () => this.executeRemoveStudents(),
      };
    }
    if (!this.bsModal) {
      this.bsModal = new bootstrap.Modal(this.confirmModalRef.nativeElement);
    }
    this.bsModal.show();
  }

  confirmAction() {
    this.confirmData.action();
    this.bsModal.hide();
  }

  executeCloseBatch() {
    this.loading = true;
    this.commonApi
      .fetchData(
        { entiId: this.entiId, userId: this.userId(), batchId: this.batchId },
        this.moduleName,
        'close',
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Batch closed');
          this.loadBatch();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Close failed');
        },
      });
  }

  executeRemoveStudents() {
    const ids = Array.from(this.selected);
    this.loading = true;
    this.commonApi
      .fetchData(
        { entiId: this.entiId, userId: this.userId(), studentIds: ids },
        this.moduleName,
        'students/remove',
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Students removed');
          this.selected.clear();
          this.loadBatch();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Remove failed');
        },
      });
  }

  back() {
    this.router.navigate(['/app/batches']);
  }

  isClosed(): boolean {
    return safeTrim(this.batch?.status).toUpperCase() === 'CLOSED';
  }

  canEditBatch(): boolean {
    return !this.isClosed();
  }

  canManageStudents(): boolean {
    return !this.isClosed();
  }

  canManageFaculty(): boolean {
    return !this.isClosed();
  }

  private getBatchByIdLocal(batchId: string) {
    const id = safeTrim(batchId);
    if (!id) return null;
    return (
      (this.batchesFull || []).find((b: any) => this.pickBatchId(b) === id) ||
      null
    );
  }

  private isSameCore(a: any, b: any): boolean {
    return (
      safeTrim(a?.programId) === safeTrim(b?.programId) &&
      safeTrim(a?.academicYear) === safeTrim(b?.academicYear) &&
      safeTrim(a?.centerId) === safeTrim(b?.centerId)
    );
  }

  private rebuildShuffleTargets() {
    const cur = this.batch || null;
    const curId = safeTrim(this.batchId);
    const all = Array.isArray(this.allBatchesRaw) ? this.allBatchesRaw : [];
    const list = all.filter((b: any) => {
      const bid = this.pickBatchId(b);
      if (!bid || bid === curId) return false;
      if (!cur) return true;
      const st = safeTrim(b?.status).toUpperCase();
      if (st === 'CLOSED' || st === 'INACTIVE') return false;
      return (
        safeTrim(b?.programId) === safeTrim(cur?.programId) &&
        safeTrim(b?.academicYear) === safeTrim(cur?.academicYear) &&
        safeTrim(b?.centerId) === safeTrim(cur?.centerId)
      );
    });
    this.batchesFull = list;
    this.rebuildShuffleTargetOptions();
  }

  private pickBatchId(b: any): string {
    return safeTrim(b?.batchId || b?._id || '');
  }

  private rebuildShuffleTargetOptions() {
    this.batchesFullOptions = [{ label: '-- Select --', value: '' }].concat(
      (this.batchesFull || []).map((b: any) => ({
        label: `${safeTrim(b?.batchName || '-')} (${safeTrim(b?.batchCode || '-')})`,
        value: this.pickBatchId(b),
        _raw: b,
      })),
    );
  }
}
