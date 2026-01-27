import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-feeplanview',
  standalone: false,
  templateUrl: './feeplanview.component.html',
  styleUrl: './feeplanview.component.scss'
})
export class FeeplanviewComponent implements OnInit {
  entiId: any;
  recId: string = '';

  loading = false;
  doc: any = null;

  totalBaseFee = 0;
  totalGST = 0;
  totalFee = 0;

  private moduleName = 'ims/feeplan';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService
  ) {
    this.entiId = localStorage.getItem('tenantId') || localStorage.getItem('tenantid');
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Fee Plans' },
      { label: 'View' }
    ]);
  }

  ngOnInit(): void {
    this.recId = String(this.route.snapshot.paramMap.get('id') || '');
    if (!this.recId) {
      this.alert.error('Invalid fee plan id');
      this.back();
      return;
    }
    this.load();
  }

  back() {
    this.router.navigate(['/app/fees/plans']);
  }

  private fmt2(n: any) {
    const num = Number(n || 0);
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  money(n: any) {
    return `₹${this.fmt2(n)}`;
  }

  load() {
    this.loading = true;
    this.commonApi.fetchData({ entiId: this.entiId, recId: this.recId }, this.moduleName, 'view').subscribe({
      next: (res: any) => {
        this.doc = res?.data || null;

        this.totalBaseFee = Number(this.doc?.totalBaseFee || 0);
        this.totalGST = Number(this.doc?.totalGST || 0);
        this.totalFee = Number(this.doc?.totalFee || 0);

        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Failed to load fee plan');
        this.back();
      }
    });
  }

  badgeClass(status: string) {
    return status === 'Active' ? 'bg-success' : 'bg-secondary';
  }

  feeHeadRowClass(h: any) {
    const key = String(h?.key || '').toUpperCase();
    return key === 'TF' ? 'table-success' : '';
  }

  // instalmentDate: backend now sends number (0 or epoch ms)
  hasInstDate(i: any): boolean {
    const n = Number(i?.instalmentDate || 0);
    return Number.isFinite(n) && n > 0;
  }
}
