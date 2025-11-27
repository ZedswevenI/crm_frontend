import { TestBed } from '@angular/core/testing';

import { BredcrumpService } from './bredcrump.service';

describe('BredcrumpService', () => {
  let service: BredcrumpService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BredcrumpService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
