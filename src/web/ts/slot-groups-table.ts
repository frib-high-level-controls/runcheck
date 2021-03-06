/*global Table: false, Holder: false*/


$(() => {

  let slotGroupColumns: datatablesutil.ColumnSettings[] = [
    {
      title: 'Name',
      // defaultContent: 'unknown',
      data: <any> null, // 'name',
      render: (row: webapi.GroupTableRow): string => {
        return `<a href="${basePath}/groups/slot/${row.id}" target="_blank">${row.name || 'Unknown'}</a>`;
      },
      searching: true,
    }, {
      title: 'Description',
      // defaultContent: 'unknown',
      data: <any> null, // 'desc',
      render: (row: webapi.GroupTableRow): string => {
        return row.desc || 'Unknown';
      },
      searching: true,
    }, {
      title: 'Checklist',
      // order: true,
      type: 'numeric',
      // autoWidth: false,
      width: '105px',
      data: (row: webapi.GroupTableRow): string => {
        if (row.checklistApproved) {
          return '<div><span class="fa fa-check text-success"/></div>';
        }
        if (row.checklistChecked !== undefined && row.checklistTotal !== undefined) {
          // Subtract one from the total because the primary subject is not included
          return `<div><strong>${row.checklistChecked} / ${row.checklistTotal - 1}</strong></div>`;
        }
        return  '<div>N/A</div>';
      },
    },
      // slotGroup columns end
  ];


  $('#slot-groups-table').DataTable({
    ajax: {
      dataType: 'json',
      dataSrc: 'data',
    },
    dom: '<"row"<"col-sm-8"l><"col-sm-4"B>>rtip',
    buttons: [
      'copy',
      'csv',
      'excel',
    ],
    autoWidth: false,
    processing: true,
    pageLength: 25,
    lengthMenu: [
      [10, 25, 50, 100, -1],
      [10, 25, 50, 100, 'All'],
    ],
    language: {
      loadingRecords: 'Loading Groups...',
    },
    deferRender: true,
    columns: slotGroupColumns,
    order: [
      [0, 'asc'],
    ],
  });
  DataTablesUtil.addFilterHead('#slot-groups-table', slotGroupColumns);
});
