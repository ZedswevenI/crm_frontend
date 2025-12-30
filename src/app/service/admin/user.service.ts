import { Injectable } from '@angular/core';
import { CommonapiService } from '../commonapi/commonapi.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private module = 'ims/user';

  constructor(private common: CommonapiService) {}

  listUsers(entiId: string) {
    return this.common.fetchData(
      { entiId },
      this.module,
      'list?list=full'
    );
  }

  createUser(payload: any) {
    return this.common.fetchData(
      payload,
      this.module,
      'create'
    );
  }

  updateUser(payload: any) {
    return this.common.fetchData(
      payload,
      this.module,
      'edit'
    );
  }

  deleteUser(entiId: string, recId: string) {
    return this.common.fetchData(
      { entiId, recId },
      this.module,
      'delete'
    );
  }
}
