import { Injectable } from '@angular/core';
import { CommonapiService } from '../../commonapi/commonapi.service';

@Injectable({
  providedIn: 'root'
})
export class ProgramService {

  private module = 'ims/program';

  constructor(private common: CommonapiService) {}

  // LIST
  listPrograms(entiId: string,pageNo? : number,pageSize? : number) {
    return this.common.fetchData(
      { entiId },
      this.module,
      `list?page=${pageNo}&size=${pageSize}`
    );
  }

  // CREATE
  createProgram(payload: any) {
    return this.common.fetchData(
      payload,
      this.module,
      'create'
    );
  }

  // UPDATE
  updateProgram(payload: any) {
    return this.common.fetchData(
      payload,
      this.module,
      'edit'
    );
  }

  // DELETE
  deleteProgram(entiId: string, recId: string) {
    return this.common.fetchData(
      { entiId, recId },
      this.module,
      'delete'
    );
  }
}
