/**
 * Devices table view
 */

// tslint:disable:no-reference
/// <reference path="../../app/webapi.d.ts" />
/// <reference path="./datatablesutil.d.ts" />

type ColumnSettings = datatablesutil.ColumnSettings;

$(() => {
  const deviceColumns: ColumnSettings[] = [
    {
      title: 'Name',
      data: <any> null,
      render: (row: webapi.DeviceTableRow): string => {
        return `<a href="/devices/${row.name}">${row.name}</a>`;
      },
      searching: true,
    }, {
      title: 'Description',
      data: <any> null,
      render: (row: webapi.DeviceTableRow): string => {
        return String(row.desc ? row.desc : '-');
      },
      searching: true,
    }, {
      title: 'Type',
      data: <any> null,
      render: (row: webapi.DeviceTableRow): string => {
        return String(row.deviceType);
      },
      searching: true,
    }, {
      title: 'Department',
      data: <any> null,
      render: (row: webapi.DeviceTableRow): string => {
        return String(row.dept);
      },
      searching: true,
    }, {
      title: 'Checklist',
      //order: true,
      type: 'numeric',
      //autoWidth: false,
      width: '105px',
      data: (row: webapi.DeviceTableRow): string => {
        // return Table.progressBar(source.checkedValue, source.totalValue);
        return 'N/A';
      },
    },
  ];

  $('#devices-table').DataTable({
    ajax: {
      url: '/devices',
      dataType: 'json',
      dataSrc: 'data',
    },
    dom: '<"row"<"col-sm-8"l><"col-sm-4"B>>rtip',
    // initComplete: function () {
    //   Holder.run({
    //     images: '.user img'
    //   });
    // },
    autoWidth: false,
    processing: true,
    pageLength: 25,
    lengthMenu: [
      [10, 25, 50, 100, -1],
      [10, 25, 50, 100, 'All'],
    ],
    language: {
      loadingRecords: 'Loading Devices...',
    },
    deferRender: true,
    columns: deviceColumns,
    order: [
      [0, 'asc'],
    ],
  });
  DataTablesUtil.addFilterHead('#devices-table', deviceColumns);
  //Table.filterEvent();
  //Table.selectEvent();
});
