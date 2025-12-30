import { Injectable } from '@angular/core';
import { CommonapiService } from '../../commonapi/commonapi.service';

@Injectable({
  providedIn: 'root'
})
export class InstituteService {

  private module = 'ims';

  constructor(private common: CommonapiService) {}

  viewInstitute(entiId: string) {
    return this.common.fetchData(
      { entiId },
      this.module,
      'view'
    );
  }

  updateInstitute(payload: any) {
    return this.common.fetchData(
      payload,
      this.module,
      'update'
    );
  }
}
