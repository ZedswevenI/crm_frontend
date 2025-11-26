import { Component } from '@angular/core';

@Component({
  selector: 'app-inward',
  standalone: false,
  templateUrl: './inward.component.html',
  styleUrl: './inward.component.scss'
})
export class InwardComponent {

    columnsArray = [
    { key: 'name', label: 'Request Name', sortable: false },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'desc', label: 'Description', sortable: false },
    { key: 'priority', label: 'Priority', sortable: true },
    { key: 'id', label: 'Asset ID', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'order', label: 'Work Order', sortable: true },
    { key: 'location', label: 'Location', sortable: false },
    { key: 'creat_at', label: 'Created At', sortable: false },
    { key: 'creat_by', label: 'Created By', sortable: false },
  ];
  dataArray = [
    { name: 'Boiler Leak', status: 'Open', desc: 'Leak happens at Boiler', priority: 'High', id: 'Boiler', 
      category: 'Breakdown', order: '', location: 'Unit 1', creat_at: '05.05.2025', creat_by: 'Requester'  },
   
  ];
  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View',
      color: '#6B7280',
      // hoverColor: '#0066FF',
      callback: (row: any) => this.viewlocation(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      color: '#6B7280',
      // hoverColor: '#0066FF',
      callback: (row: any) => this.viewlocation(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular  fa-trash-can',
      tooltip: 'Delete',
      color: '#6B7280',
      hoverColor: '#D42B2B',
      callback: (row: any) => this.viewlocation(row)
    },
  ]

  viewlocation(row: any){}
}
