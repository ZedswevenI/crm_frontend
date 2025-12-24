import { Injectable } from "@angular/core";
import { CommonapiService } from "../../commonapi/commonapi.service";

@Injectable({
  providedIn: 'root'
})
export class CenterService {

  private module = 'ims/center';

  constructor(private common: CommonapiService) {}

  // LIST
  listCenters(entiId: string) {
    return this.common.fetchData(
      { entiId },
      this.module,
      'list?list=full'
    );
  }

  // CREATE
  createCenter(payload: any) {
    return this.common.fetchData(
      payload,
      this.module,
      'create'
    );
  }

  // UPDATE
  updateCenter(payload: any) {
    return this.common.fetchData(
      payload,
      this.module,
      'edit'
    );
  }

  // DELETE
  deleteCenter(entiId: string, recId: string) {
    return this.common.fetchData(
      { entiId, recId },
      this.module,
      'delete'
    );
  }
}
