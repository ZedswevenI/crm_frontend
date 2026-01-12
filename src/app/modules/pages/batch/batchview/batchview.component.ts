import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AbstractControl } from '@angular/forms';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

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
  studentRows: any[] = [];
  selected = new Set<string>();
  showEdit = false;
  editForm!: FormGroup;
  showStaff = false;
  staffForm!: FormGroup;
  showAssign = false;
  eligibleRows: any[] = [];
  eligibleCount = 0;
  eligibleQuery = { page: 1, limit: 20, search: '' };
  eligibleSelected = new Set<string>();
  showShuffle = false;
  shuffleToBatchId = '';
  batchesFull: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService
  ) {
    this.entiId = localStorage.getItem('tenantId');
  }

  ngOnInit(): void {
    this.batchId = safeTrim(this.route.snapshot.paramMap.get('batchId'));
    if (!this.batchId) {
      this.alert.error('batchId missing');
      this.router.navigate(['/ims/batch']);
      return;
    }
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Batches' },
      { label: 'View' },
    ]);
    this.editForm = this.fb.group({
      batchId: [this.batchId, [Validators.required]],
      batchName: ['', [Validators.required]],
      batchCode: ['', [Validators.required]],
      startDate: [null, [Validators.required]],
      endDate: [null, [Validators.required]],
      status: ['ACTIVE', [Validators.required]],
      remarks: [''],
    });
    this.staffForm = this.fb.group({
      staffMap: this.fb.array([]),
    });
    this.loadBatch();
    this.loadBatchesFullForShuffle();
  }

  asFormGroup(ctrl: AbstractControl): FormGroup {
    return ctrl as FormGroup;
  }

  private buildQueryParams(params: Record<string, any>) {
    const keys = Object.keys(params || {}).filter(
      (k) => params[k] !== undefined && params[k] !== null && params[k] !== ''
    );
    if (!keys.length) return '';
    const qs = keys
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`
      )
      .join('&');
    return `?${qs}`;
  }

  private userId() {
    return (
      localStorage.getItem('userId') || localStorage.getItem('userid') || null
    );
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

  loadBatch() {
    const payload = {
      entiId: this.entiId,
      batchId: this.batchId,
      includeStudents: true,
    };

    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, 'view').subscribe({
      next: (res: any) => {
        this.loading = false;
        this.batch = res?.data || null;
        this.studentRows = this.batch?.students || [];
        this.selected.clear();

        this.editForm.patchValue({
          batchName: this.batch?.batchName || '',
          batchCode: this.batch?.batchCode || '',
          startDate: this.batch?.startDate || null,
          endDate: this.batch?.endDate || null,
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

  back() {
    this.router.navigate(['/app/batches']);
  }

  toggleSelect(studentId: string, checked: boolean) {
    const sid = safeTrim(studentId);
    if (!sid) return;
    if (checked) this.selected.add(sid);
    else this.selected.delete(sid);
  }

  selectAllCurrent(checked: boolean) {
    if (checked)
      (this.studentRows || []).forEach((s) =>
        this.selected.add(safeTrim(s.studentId))
      );
    else this.selected.clear();
  }

  openEdit() {
    this.showEdit = true;
    this.showStaff = false;
    this.showAssign = false;
    this.showShuffle = false;
  }

  openStaff() {
    this.showStaff = true;
    this.showEdit = false;
    this.showAssign = false;
    this.showShuffle = false;
  }

  openAssign() {
    this.showAssign = true;
    this.showEdit = false;
    this.showStaff = false;
    this.showShuffle = false;
    this.eligibleSelected.clear();
    this.eligibleQuery = { page: 1, limit: 20, search: '' };
    this.loadEligible();
  }

  openShuffle() {
    const ids = Array.from(this.selected);
    if (!ids.length) {
      this.alert.error('Select students to shuffle');
      return;
    }
    this.showShuffle = true;
    this.showEdit = false;
    this.showStaff = false;
    this.showAssign = false;
    this.shuffleToBatchId = '';
  }

  cancelEdit() {
    this.showEdit = false;
  }

  saveBatch() {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.alert.error('Please fill required fields');
      return;
    }
    const v = this.editForm.value || {};
    const payload: any = {
      entiId: this.entiId,
      userId: this.userId(),
      batchId: this.batchId,
      batchName: safeTrim(v.batchName),
      batchCode: safeTrim(v.batchCode),
      startDate: Number(v.startDate),
      endDate: Number(v.endDate),
      status: safeTrim(v.status),
      remarks: safeTrim(v.remarks) || null,
    };
    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, 'update').subscribe({
      next: () => {
        this.loading = false;
        this.alert.success('Batch updated successfully');
        this.showEdit = false;
        this.loadBatch();
        this.loadBatchesFullForShuffle();
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Update failed');
      },
    });
  }

  closeBatch() {
    if (!confirm('Close this batch? This will release all students.')) return;
    const payload = {
      entiId: this.entiId,
      userId: this.userId(),
      batchId: this.batchId,
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'batch/close')
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Batch closed and students released');
          this.loadBatch();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Close failed');
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
      this.alert.error('Fill required subjectId and staffId');
      return;
    }
    const staffMap = (this.staffFA.value || []).map((x: any) => ({
      subjectId: safeTrim(x.subjectId),
      subjectName: safeTrim(x.subjectName) || null,
      staffId: safeTrim(x.staffId),
      staffName: safeTrim(x.staffName) || null,
    }));
    const payload = {
      entiId: this.entiId,
      userId: this.userId(),
      batchId: this.batchId,
      staffMap,
    };
    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, 'staff/save').subscribe({
      next: () => {
        this.loading = false;
        this.alert.success('Faculty mapping saved');
        this.showStaff = false;
        this.loadBatch();
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Save failed');
      },
    });
  }

  loadEligible() {
    const qp = this.buildQueryParams({
      page: this.eligibleQuery.page,
      limit: this.eligibleQuery.limit,
      ...(safeTrim(this.eligibleQuery.search)
        ? { search: safeTrim(this.eligibleQuery.search) }
        : {}),
    });
    const payload = {
      entiId: this.entiId,
      batchId: this.batchId,
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, `students/eligible${qp}`)
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.eligibleRows = res?.data || [];
          this.eligibleCount = Number(res?.count || 0);
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(
            err?.error?.message || 'Failed to load eligible students'
          );
        },
      });
  }

  toggleEligible(id: string, checked: boolean) {
    const sid = safeTrim(id);
    if (!sid) return;
    if (checked) this.eligibleSelected.add(sid);
    else this.eligibleSelected.delete(sid);
  }

  assignEligibleSelected() {
    const ids = Array.from(this.eligibleSelected);
    if (!ids.length) {
      this.alert.error('Select at least one student');
      return;
    }
    const payload = {
      entiId: this.entiId,
      userId: this.userId(),
      batchId: this.batchId,
      studentIds: ids,
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'students/assign')
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Students assigned successfully');
          this.showAssign = false;
          this.loadBatch();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Assign failed');
        },
      });
  }

  removeSelected() {
    const ids = Array.from(this.selected);
    if (!ids.length) {
      this.alert.error('Select students first');
      return;
    }
    if (!confirm(`Remove ${ids.length} students from this batch?`)) return;
    this.removeStudents(ids);
  }

  removeStudents(ids: string[]) {
    const clean = (ids || []).map(safeTrim).filter(Boolean);
    if (!clean.length) return;
    const payload = {
      entiId: this.entiId,
      userId: this.userId(),
      studentIds: clean,
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'students/remove')
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Students removed from batch');
          this.loadBatch();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Remove failed');
        },
      });
  }

  // ---------------- Shuffle selected ----------------
  shuffleSelected() {
    const ids = Array.from(this.selected);
    if (!ids.length) {
      this.alert.error('Select students first');
      return;
    }
    const toBatchId = safeTrim(this.shuffleToBatchId);
    if (!toBatchId) {
      this.alert.error('Select target batch');
      return;
    }
    if (toBatchId === this.batchId) {
      this.alert.error('Target batch cannot be same');
      return;
    }
    const payload = {
      entiId: this.entiId,
      userId: this.userId(),
      fromBatchId: this.batchId,
      toBatchId,
      studentIds: ids,
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'students/shuffle')
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Students shuffled successfully');
          this.showShuffle = false;
          this.loadBatch();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Shuffle failed');
        },
      });
  }

  loadBatchesFullForShuffle() {
    const qp = this.buildQueryParams({ list: 'full' });
    const payload = { entiId: this.entiId };
    this.commonApi.fetchData(payload, this.moduleName, `list${qp}`).subscribe({
      next: (res: any) => {
        const all = res?.data || [];
        this.batchesFull = all.filter(
          (b: any) => safeTrim(b?.batchId) !== this.batchId
        );
      },
      error: () => {},
    });
  }
}
