import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-subtopic',
  standalone: false,
  templateUrl: './subtopic.component.html',
  styleUrl: './subtopic.component.scss',
})
export class SubtopicComponent implements OnInit {
  moduleName = 'ims';
  entiId = localStorage.getItem('tenantId');

  form!: FormGroup;

  classOptions = Array.from({ length: 8 }, (_, i) => ({
    label: `${6 + i}`,
    value: 6 + i,
  }));

  subjectOptions: any[] = [];
  topicOptions: any[] = [];

  tableData: any[] = [];
  totalRecords = 0;
  loading = false;

  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  deleteModalVisible = false;
  deleteTarget: any = null;
  deleteMessage = '';

  columns = [
    { key: 'classNo', label: 'Class', sortable: false },
    { key: 'subjectId', label: 'Subject', sortable: false },
    { key: 'topicId', label: 'Topic', sortable: false },
    { key: 'subTopicName', label: 'Sub-Topic', sortable: false },
    { key: 'subTopicCode', label: 'Code', sortable: false },
    { key: 'sortOrder', label: 'Sort', sortable: false },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      callback: (r: any) => this.edit(r),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      callback: (r: any) => this.openDelete(r),
    },
  ];

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private api: CommonapiService,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadSubjects();
    this.fetchTableData({ page: 1, pageSize: 10 });
  }

  initForm() {
    this.form = this.fb.group({
      classNo: [null, Validators.required],
      subjectId: [null, Validators.required],
      topicId: [null, Validators.required],
      subTopicName: ['', Validators.required],
      subTopicCode: [''],
      sortOrder: [0],
    });
  }

  // LOAD SUBJECTS ONCE
  loadSubjects() {
    this.api
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `subject/list?list=full`,
      )
      .subscribe((res: any) => {
        this.subjectOptions = res?.data || [];
      });
  }

  // LOAD TOPICS WHEN SUBJECT SELECTED
  loadTopics() {
    const classNo = this.form.get('classNo')?.value;
    const subjectId = this.form.get('subjectId')?.value;
    if (!classNo || !subjectId) return;

    this.api
      .fetchData(
        { entiId: this.entiId, classNo, subjectId },
        this.moduleName,
        `topic/list?list=full`,
      )
      .subscribe((res: any) => {
        this.topicOptions = res?.data || [];
      });
  }

  // LIST ALL SUBTOPICS (NO FILTERS)
  fetchTableData(e: any) {
    this.loading = true;

    const q = `page=${e.page}&limit=${e.pageSize}`;

    this.api
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `subtopic/list?${q}`,
      )
      .subscribe({
        next: (res: any) => {
          this.tableData = res?.data || [];
          this.totalRecords = res?.count || 0;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.alert.error('Failed to load subtopics');
        },
      });
  }

  // OPEN MODAL
  add() {
    this.formMode = 'create';
    this.form.reset({
      classNo: null,
      subjectId: null,
      topicId: null,
      subTopicName: '',
      subTopicCode: '',
      sortOrder: 0,
    });

    this.topicOptions = [];
    this.showForm = true;
  }

  // EDIT MODAL
  edit(row: any) {
    const x = row._raw || row;

    this.formMode = 'edit';
    this.form.patchValue({
      classNo: x.classNo,
      subjectId: x.subjectId,
      topicId: x.topicId,
      subTopicName: x.subTopicName,
      subTopicCode: x.subTopicCode,
      sortOrder: x.sortOrder,
    });

    // Load topics for modal dropdown
    this.loadTopics();

    this.deleteTarget = x;
    this.showForm = true;
  }

  // SAVE SUBTOPIC
  save() {
    if (this.form.invalid) {
      this.alert.error('Fill required fields');
      return;
    }
    const payload = {
      entiId: this.entiId,
      classNo: this.form.value.classNo,
      subjectId: this.form.value.subjectId,
      topicId: this.form.value.topicId,
      subTopicName: this.form.value.subTopicName,
      subTopicCode: this.form.value.subTopicCode,
      sortOrder: this.form.value.sortOrder,
    };
    this.api.fetchData(payload, this.moduleName, `subtopic/create`).subscribe({
      next: () => {
        this.alert.success(
          this.formMode === 'create'
            ? 'Sub-topic created'
            : 'Sub-topic updated',
        );
        this.showForm = false;
        this.fetchTableData({ page: 1, pageSize: 10 });
      },
      error: (err) => this.alert.error(err?.error?.message || 'Save failed'),
    });
  }

  // DELETE
  openDelete(row: any) {
    const x = row._raw || row;
    this.deleteTarget = x;
    this.deleteMessage = `Delete "${x.subTopicName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    const x = this.deleteTarget;

    const payload = {
      entiId: this.entiId,
      classNo: x.classNo,
      subjectId: x.subjectId,
      topicId: x.topicId,
      subTopicId: x.subTopicId,
    };

    this.api.fetchData(payload, this.moduleName, `subtopic/delete`).subscribe({
      next: () => {
        this.alert.success('Sub-topic deleted');
        this.fetchTableData({ page: 1, pageSize: 10 });
      },
      error: (err) => this.alert.error(err?.error?.message || 'Delete failed'),
    });

    this.deleteTarget = null;
  }

  cancel() {
    this.showForm = false;
  }
}
