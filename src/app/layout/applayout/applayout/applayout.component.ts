import { Component, OnInit } from '@angular/core';
import { PermissionService } from '../../../shared/permission.service';

@Component({
  selector: 'app-applayout',
  standalone: false,
  templateUrl: './applayout.component.html',
  styleUrl: './applayout.component.scss'
})
export class ApplayoutComponent implements OnInit {
  constructor(private permissionService: PermissionService) {}

  ngOnInit(): void {
    // Fire-and-forget: covers routes with no PermissionGuard (e.g. dashboard)
    // so the sidebar/header still have permissions to filter by. Routes that
    // ARE guarded already resolved this via PermissionGuard.ensureLoaded()
    // before this component was even created, so this just hits the
    // already-loaded short-circuit in that case.
    this.permissionService.init();
  }
}
