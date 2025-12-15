import { Component, OnInit } from '@angular/core';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

@Component({
  selector: 'app-feesreports',
  standalone: false,
  templateUrl: './feesreports.component.html',
  styleUrl: './feesreports.component.scss'
})
export class FeesreportsComponent implements OnInit {
  from = '';
  to = '';
  center: string = 'all';
  centers: string[] = ['Gandhipuram Center', 'Nungambakkam Center'];

  summary = { totalCollected: 0, totalPending: 0, receipts: 0, fullyPaid: 0 };
  modeSummary: Array<{ mode: string; amount: number }> = [];

  rows: any[] = [];

  columns = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'receiptNo', label: 'Receipt', sortable: true },
    { key: 'regNo', label: 'Reg No', sortable: true },
    { key: 'name', label: 'Student', sortable: true },
    { key: 'centerName', label: 'Centre', sortable: true },
    { key: 'mode', label: 'Mode', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true }
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-solid fa-print',
      tooltip: 'Print Receipt',
      color: '#6B7280',
      callback: (row: any) => this.print(row)
    }
  ];

  // dummy data source
  private allRows: any[] = [
    { date: '2025-12-10', receiptNo: 'RCPT-112233', regNo: '9001111012809250093', name: 'NIDHIN K', centerName: 'Gandhipuram Center', mode: 'NEFT', amount: 50000 },
    { date: '2025-12-11', receiptNo: 'RCPT-112244', regNo: 'JEE26-0001', name: 'Rohit Sharma', centerName: 'Gandhipuram Center', mode: 'CASH', amount: 25000 },
    { date: '2025-12-11', receiptNo: 'RCPT-112255', regNo: 'NEET25-0001', name: 'Harish Kumar', centerName: 'Nungambakkam Center', mode: 'CHEQUE', amount: 75000 }
  ];

  constructor(private alert: AlertService, private breadcrumb: BredcrumpService) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Fees' }, { label: 'Fee Reports' }]);
  }

  ngOnInit(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.to = today;
    const d = new Date();
    d.setDate(d.getDate() - 7);
    this.from = d.toISOString().slice(0, 10);

    this.runReport();
  }

  runReport(): void {
    const from = this.from;
    const to = this.to;

    // filter
    this.rows = this.allRows.filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (this.center !== 'all' && r.centerName !== this.center) return false;
      return true;
    });

    // summary
    const totalCollected = this.rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    this.summary.totalCollected = totalCollected;

    // pending + fullyPaid are dummy until you join student totals
    this.summary.totalPending = 0;
    this.summary.receipts = this.rows.length;
    this.summary.fullyPaid = 0;

    // mode wise
    const modeMap: Record<string, number> = {};
    for (const r of this.rows) {
      modeMap[r.mode] = (modeMap[r.mode] || 0) + Number(r.amount || 0);
    }
    this.modeSummary = Object.keys(modeMap).map(k => ({ mode: k, amount: modeMap[k] }));

    this.alert.success('Report generated (dummy).');
  }

  print(row: any): void {
    this.alert.success(`Print ${row.receiptNo} (dummy).`);
  }
}
