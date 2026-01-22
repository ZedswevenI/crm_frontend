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

  // ✅ NEW: Lists for Dropdowns
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
      subjectName: [safeTrim(x?.subjectName)], // Read-only or auto-populated
      staffId: [safeTrim(x?.staffId), [Validators.required]],
      staffName: [safeTrim(x?.staffName)], // Read-only or auto-populated
    });
  }

  // ✅ NEW: Handle dropdown changes
  onSubjectChange(index: number) {
    const group = this.staffFA.at(index);
    const subjId = group.get('subjectId')?.value;
    const subj = this.subjectsList.find((s) => s.subjectId === subjId);
    if (subj) {
      group.patchValue({ subjectName: subj.subjectName || subj.subjectCode });
    }
  }

  onStaffChange(index: number) {
    const group = this.staffFA.at(index);
    const sId = group.get('staffId')?.value;
    const st = this.staffList.find((s) => s.staffId === sId);
    if (st) {
      group.patchValue({ staffName: st.staffName });
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
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Failed to load batch');
      },
    });
  }

  // ✅ UPDATED: Fetch lists when opening Staff Map
  openOffcanvas(mode: 'edit' | 'staff' | 'assign' | 'shuffle') {
    this.offcanvasMode = mode;

    if (mode === 'staff') {
      // Fetch Subjects
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
            },
          });
      }
      // Fetch Staff
      if (!this.staffList.length) {
        // Using tenant module for staff list as per your context (or wherever 'staff/list' points to)
        this.commonApi
          .fetchData({ entiId: this.entiId }, 'ims/staff', 'list?list=full')
          .subscribe({
            next: (res: any) => {
              this.staffList = res?.data || [];
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
      const ids = Array.from(this.selected);
      if (!ids.length) {
        this.alert.error('Select students from the list first');
        this.closeOffcanvas();
        return;
      }
      this.shuffleToBatchId = '';
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
  }
  removeStaffRow(i: number) {
    this.staffFA.removeAt(i);
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
          this.batchesFull = (res?.data || []).filter(
            (b: any) => safeTrim(b.batchId) !== this.batchId,
          );
        },
      });
  }

  shuffleSelected() {
    const ids = Array.from(this.selected);
    if (!this.shuffleToBatchId) return;

    this.loading = true;
    this.commonApi
      .fetchData(
        {
          entiId: this.entiId,
          userId: this.userId(),
          fromBatchId: this.batchId,
          toBatchId: this.shuffleToBatchId,
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
        'batch/close',
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
}
