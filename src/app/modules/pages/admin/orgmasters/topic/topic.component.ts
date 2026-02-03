import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-topic',
  standalone: false,
  templateUrl: './topic.component.html',
  styleUrl: './topic.component.scss',
})
export class TopicComponent implements OnInit {
  private moduleName = 'ims';
  entiId: any;

  form!: FormGroup;

  subjectOptions: any[] = [];
  subjectById = new Map<string, any>();

  classOptions = Array.from({ length: 8 }, (_, i) => 6 + i).map((n) => ({
    label: String(n),
    value: n,
  }));

  loading = false;
  totalRecords = 0;
  tableData: any[] = [];

  showForm = false;
  formMode: 'create' | 'edit' = 'create';

  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  columns = [
    { key: 'classNo', label: 'Class', sortable: true },
    { key: 'subjectName', label: 'Subject', sortable: true },
    { key: 'topicName', label: 'Topic', sortable: true },
    { key: 'topicCode', label: 'Code', sortable: false },
    { key: 'sortOrder', label: 'Sort', sortable: true },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      callback: (r: any) => this.edit(r),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      callback: (r: any) => this.openDelete(r),
    },
  ];

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Topics' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadSubjects();
  }

  // ---------------- FORM ---------------------
  private initForm() {
    this.form = this.fb.group({
      classNo: [null, Validators.required],
      subjectId: [null, Validators.required],
      topicName: ['', Validators.required],
      topicCode: [''],
      sortOrder: [0],
    });
  }

  // ---------------- SUBJECT LIST ---------------------
  private loadSubjects() {
    this.commonApi
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `subject/list?list=full`,
      )
      .subscribe({
        next: (res: any) => {
          const rows = res?.data || [];

          this.subjectOptions = rows.map((s: any) => ({
            label: s.subjectName,
            value: s._id,
          }));

          for (const s of rows) this.subjectById.set(String(s._id), s);
        },
        error: () => {
          this.subjectOptions = [];
          this.subjectById.clear();
        },
      });
  }

  // ---------------- LISTING ---------------------
  fetchTableData(params: { page: number; pageSize: number; search?: string }) {
    this.loading = true;

    const qs =
      `page=${params.page}&limit=${params.pageSize}` +
      (params.search ? '&search=' + encodeURIComponent(params.search) : '');

    this.commonApi
      .fetchData({ entiId: this.entiId }, this.moduleName, `topic/list?${qs}`)
      .subscribe({
        next: (res: any) => {
          const rows = res?.data || [];

          this.tableData = rows.map((x: any) => ({
            recId: x._id,
            topicId: x.topicId,
            classNo: x.classNo,
            subjectId: x.subjectId,
            subjectName:
              this.subjectById.get(String(x.subjectId))?.subjectName || '-',
            topicName: x.topicName,
            topicCode: x.topicCode || '-',
            sortOrder: x.sortOrder,
            _raw: x,
          }));

          this.totalRecords = res?.count || 0;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.alert.error('Failed to load topics');
        },
      });
  }

  // ---------------- ADD ---------------------
  add() {
    this.formMode = 'create';

    this.form.reset({
      classNo: null,
      subjectId: null,
      topicName: '',
      topicCode: '',
      sortOrder: 0,
    });

    this.showForm = true;
    this.deleteTarget = null;
  }

  // ---------------- EDIT ---------------------
  edit(row: any) {
    const x = row?._raw || row;

    this.formMode = 'edit';

    this.form.patchValue({
      classNo: x.classNo,
      subjectId: x.subjectId,
      topicName: x.topicName,
      topicCode: x.topicCode,
      sortOrder: x.sortOrder,
    });

    this.deleteTarget = x;
    this.showForm = true;
  }

  // ---------------- SAVE ---------------------
  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alert.error('Please fill required fields');
      return;
    }

    const payload = {
      ...this.form.value,
      entiId: this.entiId,
    };

    this.commonApi
      .fetchData(payload, this.moduleName, 'topic/create')
      .subscribe({
        next: () => {
          this.alert.success(
            this.formMode === 'create' ? 'Topic created' : 'Topic updated',
          );
          this.showForm = false;
          this.fetchTableData({ page: 1, pageSize: 10 });
        },
        error: (err) => this.alert.error(err?.error?.message || 'Save failed'),
      });
  }

  // ---------------- DELETE ---------------------
  openDelete(row: any) {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete "${row.topicName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    const payload = {
      entiId: this.entiId,
      classNo: this.deleteTarget.classNo,
      subjectId: this.deleteTarget.subjectId,
      topicId: this.deleteTarget.topicId,
    };

    this.commonApi
      .fetchData(payload, this.moduleName, 'topic/delete')
      .subscribe({
        next: () => {
          this.alert.success('Topic deleted');
          this.fetchTableData({ page: 1, pageSize: 10 });
        },
        error: (err) =>
          this.alert.error(err?.error?.message || 'Delete failed'),
      });

    this.deleteTarget = null;
  }

  cancel() {
    this.showForm = false;
  }
}
