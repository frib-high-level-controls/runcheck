/**
 * Slots table view
 */
// / <reference path="./datatablesutil.d.ts" />

//type ColumnSettings = datatablesutil.ColumnSettings;

$(() => {
  const slotColumns: ColumnSettings[] = [
    // {
    //   title: 'Details',
    //   data: '_id',
    //   render: function (data) {
    //     return '<a href="' + '/slots/' + data + '" target="_blank" data-toggle="tooltip" title="go to the slot details"><i class="fa fa-list-alt fa-2x"></i></a>';
    //   },
    //   //order: false
    // },
    {
      title: 'Name',
      defaultContent: 'unknown',
      data: 'name',
      searching: true,
    }, {
      title: 'Type',
      defaultContent: 'unknown',
      data: 'deviceType',
      searching: true,
    },
 // var ownerColumn = Table.personColumn('Owner', 'owner');
    {
      title: 'Area',
      defaultContent: 'unknown',
      data: 'area',
      searching: true,
    }, {
      title: 'Level of care',
      defaultContent: 'unknown',
      data: 'loc',
      searching: true,
    }, {
      title: 'DRR',
      defaultContent: 'unknown',
      data: 'drr',
      searching: true,
    }, {
      title: 'ARR',
      defaultContent: 'unknown',
      data: 'arr',
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
    // {
    //   title: 'Location or coordinates',
    //   defaultContent: 'unknown',
    //   data: 'location',
    //   searching: true
    // },
    // {
    //   title: 'Device',
    //   data: 'device',
    //   render: function (data) {
    //     if (!data || !data.id) {
    //       return 'Not installed';
    //     }
    //     return '<a href="' + '/devices/' + data.id + '" target="_blank" data-toggle="tooltip" title="go to the slot serialized device"><i class="fa fa-link fa-2x"></i></a>';
    //   },
    //   //order: false
    // },

  ];

//   var statusMap = {0: 'Device not installed',
//     1: 'Device installed',
//     2: 'DO OK',
//     2.5: 'Slot DRR checklist',
//     3: 'AM approved',
//     4:'DRR approved'
//   };
  
//   var approvelStatusColumn = {
//     title: 'Approved status',
//     data: 'status',
//     render: function (data) {
//       return  statusMap[data];
//     },
//     searching: true
//   };
  
//   var machineModeColumn = {
//     title: 'Associated machine mode(s)',
//     defaultContent: 'None',
//     data: 'machineMode',
//     searching: true
//   };
  
//   var checkedProgressColumn = {
//     title: 'Device checklist',
//     order: true,
//     type: 'numeric',
//     autoWidth: false,
//     width: '105px',
//     data: function (source) {
//       return Table.progressBar( source.ReadinessCheckedValue, source.ReadinessTotalValue);
//     }
//   };
  
//   var DRRProgressColumn = {
//     title: 'DRR checklist',
//     order: true,
//     type: 'numeric',
//     autoWidth: false,
//     width: '105px',
//     data: function (source) {
//       return Table.progressBar( source.DRRCheckedValue, source.DRRTotalValue);
//     }
//   };
  
//   var ARRProgressColumn = {
//     title: 'ARR checklist',
//     order: true,
//     type: 'numeric',
//     autoWidth: false,
//     width: '105px',
//     data: function (source) {
//       return Table.progressBar( source.ARRCheckedValue, source.ARRTotalValue);
//     }
//   };
  // slot columns end
  
//   var slotColumns = [Table.selectColumn, detailsColum, nameColumn, ownerColumn, areaColumn, levelColumn, deviceTypeColumn, locationColumn, deviceColumn, approvelStatusColumn, machineModeColumn, checkedProgressColumn, DRRProgressColumn, ARRProgressColumn];

  $('#slots-table').DataTable({
    ajax: {
      url: '/slots',
      dataType: 'json',
      dataSrc: 'data',
    },
    // initComplete: function () {
    // Holder.run({
    //     images: '.user img'
    // });
    // },
    autoWidth: true,
    processing: true,
    pageLength: 25,
    lengthMenu: [
    [10, 25, 50, 100, -1],
    [10, 25, 50, 100, 'All'],
    ],
    language: {
      loadingRecords: 'Loading Slots...',
    },
    deferRender: true,
    columns: slotColumns,
    order: [
      [2, 'asc']
    ],
  });
  DataTablesUtil.addFilterHead('#slots-table', slotColumns);

    // $('#spec-slots-table').DataTable({
    //   ajax: {
    //     url: window.location.pathname +'/slots',
    //     dataSrc: ''
    //   },
    //   initComplete: function () {
    //     Holder.run({
    //       images: '.user img'
    //     });
    //   },
    //   autoWidth: true,
    //   processing: true,
    //   pageLength: 10,
    //   lengthMenu: [
    //     [10, 50, 100, -1],
    //     [10, 50, 100, 'All']
    //   ],
    //   oLanguage: {
    //     loadingRecords: 'Please wait - loading data from the server ...'
    //   },
    //   deferRender: true,
    //   columns: slotColumns,
    //   order: [
    //     [2, 'asc']
    //   ]
    // });
    // Table.addFilterFoot('#spec-slots-table', slotColumns);

    // Table.filterEvent();
    // Table.selectEvent();
});
