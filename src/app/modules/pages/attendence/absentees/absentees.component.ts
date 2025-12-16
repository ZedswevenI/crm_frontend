import { Component, OnInit } from '@angular/core';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

type NotifyFlag = 'notified' | 'pending';

interface AbsenteeRow {
  id: number;
  classId: number;
  classLabel: string;

  batchId: number;
  batchName: string;

  date: string; // yyyy-mm-dd
  subjectName: string;
  facultyName: string;

  studentId: number;
  regNo: string;
  name: string;
  phone: string;

  parentName: string;
  parentPhone: string;

  notified: NotifyFlag;
}

@Component({
  selector: 'app-absentees',
  standalone: false,
  templateUrl: './absentees.component.html',
  styleUrl: './absentees.component.scss'
})
export class AbsenteesComponent implements OnInit {
  search = '';

  filterDate = ''; // default today later
  filterBatchId: number | 'all' = 'all';
  filterClassId: number | 'all' = 'all';
  filterNotified: NotifyFlag | 'all' = 'all';

  batches = [{ id: 1, name: 'JEE 2026 - Phase 1' }, { id: 2, name: 'NEET 2025 - Regular' }];

  classOptions: Array<{ id: number; label: string }> = [{ id: 11, label: '16-Dec • Physics • Sivakumar (17:00-18:30)' }, { id: 12, label: '16-Dec • Maths • Vignesh (18:30-20:00)' }, { id: 21, label: '17-Dec • Chemistry • Priya (17:00-18:30)' }];

  // dummy list (replace with API: /attendance/absentees?date=&batchId=&classId=)
  data: AbsenteeRow[] = [
    {
      id: 1,
      classId: 11,
      classLabel: '16-Dec • Physics • Sivakumar (17:00-18:30)',
      batchId: 1,
      batchName: 'JEE 2026 - Phase 1',
      date: '2025-12-16',
      subjectName: 'Physics',
      facultyName: 'Sivakumar',
      studentId: 101,
      regNo: 'JEE26-0001',
      name: 'Rohit Sharma',
      phone: '9000010001',
      parentName: 'Mr. Sharma',
      parentPhone: '9000099999',
      notified: 'pending'
    },
    {
      id: 2,
      classId: 21,
      classLabel: '17-Dec • Chemistry • Priya (17:00-18:30)',
      batchId: 2,
      batchName: 'NEET 2025 - Regular',
      date: '2025-12-17',
      subjectName: 'Chemistry',
      facultyName: 'Priya',
      studentId: 201,
      regNo: 'NEET25-0001',
      name: 'Harish Kumar',
      phone: '9000020001',
      parentName: 'Mr. Kumar',
      parentPhone: '9000088888',
      notified: 'notified'
    }
  ];

  filtered: AbsenteeRow[] = [];

  // list-table needs sortable
  columns = [
    { key: 'date', label: 'Date', sortable: true, date: true },
    { key: 'batchName', label: 'Batch', sortable: true },
    { key: 'classLabel', label: 'Class', sortable: false, maxWidthPx: 260 },
    { key: 'regNo', label: 'Reg No', sortable: true },
    { key: 'name', label: 'Student', sortable: true },
    { key: 'parentPhone', label: 'Parent Phone', sortable: false },
    { key: 'notified', label: 'Notified', sortable: true }
  ];

  selectedIds = new Set<number>();

  actions = [
    {
      type: 'checkbox',
      tooltip: 'Select',
      callback: (row: AbsenteeRow, checked: boolean) => this.toggleSelect(row.id, checked)
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-bullhorn',
      tooltip: 'Notify Parent',
      color: '#2563EB',
      callback: (row: AbsenteeRow) => this.openNotifySingle(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-circle-check',
      tooltip: 'Mark Notified',
      color: '#16A34A',
      callback: (row: AbsenteeRow) => this.markNotified(row.id)
    }
  ];

  // notify modal
  showNotify = false;
  notifyMode: 'single' | 'bulk' = 'single';
  notifyRecipients: AbsenteeRow[] = [];
  sending = false;

  channel: 'SMS' | 'WHATSAPP' | 'EMAIL' = 'SMS';
  message = '';
  templatePreview = `Dear Parent, your child is absent today. Please contact the institute.`;

  constructor(private alert: AlertService, private breadcrumb: BredcrumpService) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Attendance' }, { label: 'Absentees' }]);
  }

  ngOnInit(): void {
    // default date = today (local) if empty
    if (!this.filterDate) {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      this.filterDate = `${yyyy}-${mm}-${dd}`;
    }
    this.applyFilter();
  }

  reload(): void {
    this.applyFilter();
    this.alert.success('Refreshed (dummy).');
  }

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();

    this.filtered = this.data.filter((x: AbsenteeRow) => {
      if (this.filterDate && x.date !== this.filterDate) return false;
      if (this.filterBatchId !== 'all' && x.batchId !== Number(this.filterBatchId)) return false;
      if (this.filterClassId !== 'all' && x.classId !== Number(this.filterClassId)) return false;
      if (this.filterNotified !== 'all' && x.notified !== this.filterNotified) return false;

      if (q) {
        const hay = `${x.regNo} ${x.name} ${x.phone} ${x.parentPhone} ${x.batchName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // clear selection if filtered out
    const visible = new Set(this.filtered.map(x => x.id));
    this.selectedIds.forEach(id => {
      if (!visible.has(id)) this.selectedIds.delete(id);
    });
  }

  toggleSelect(id: number, checked: boolean): void {
    if (checked) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
  }

  openNotifySingle(row: AbsenteeRow): void {
    this.notifyMode = 'single';
    this.notifyRecipients = [row];
    this.prepareMessage();
    this.openNotify();
  }

  openNotifyBulk(): void {
    this.notifyMode = 'bulk';
    const set = this.selectedIds;
    this.notifyRecipients = this.filtered.filter(x => set.has(x.id));
    this.prepareMessage();
    this.openNotify();
  }

  private openNotify(): void {
    this.showNotify = true;
    document.body.classList.add('modal-open');
  }

  closeNotify(): void {
    this.showNotify = false;
    this.notifyRecipients = [];
    document.body.classList.remove('modal-open');
  }

  private prepareMessage(): void {
    // simple default template
    const sample = this.notifyRecipients[0];
    if (!sample) {
      this.message = this.templatePreview;
      return;
    }
    this.message = `Dear Parent, your child ${sample.name} (${sample.regNo}) was absent on ${sample.date}. ` + `Please contact the institute.`;
  }

  sendNotify(): void {
    if (!this.notifyRecipients.length) return;

    this.sending = true;

    // TODO: call notification API (SMS/WhatsApp)
    setTimeout(() => {
      const ids = new Set(this.notifyRecipients.map(r => r.id));
      this.data = this.data.map((x: AbsenteeRow) => (ids.has(x.id) ? { ...x, notified: 'notified' } : x));

      this.applyFilter();
      this.sending = false;
      this.alert.success('Notification sent (dummy).');
      this.closeNotify();
      this.selectedIds.clear();
    }, 350);
  }

  markNotified(id: number): void {
    this.data = this.data.map((x: AbsenteeRow) => (x.id === id ? { ...x, notified: 'notified' } : x));
    this.applyFilter();
    this.alert.success('Marked as notified');
  }
}
