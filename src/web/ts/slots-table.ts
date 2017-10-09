/**
 * Slots table view
 */

// Base URL for FORG service
let forgurl: string | undefined;

$(() => {
  const slotColumns: datatablesutil.ColumnSettings[] = [
    {
      title: 'Name',
      data: <any> null,
      render: (row: webapi.SlotTableRow): string => {
        return `<a href="/slots/${row.name}">${row.name}</a>`;
      },
      searching: true,
    }, {
      title: 'Type',
      data: <any> null,
      render: (row: webapi.SlotTableRow): string => {
        return row.deviceType || 'Unknown';
      },
      searching: true,
    },
    // var ownerColumn = Table.personColumn('Owner', 'owner');
    {
      title: 'Area',
      data: <any> null, // 'area',
      render: (row: webapi.SlotTableRow) => {
        if (forgurl && row.area) {
          return `<a href="${forgurl}/groups/${row.area}" target="_blank">${row.area}</a>`;
        } else {
          return row.area || 'Unknown';
        }
      },
      searching: true,
    }, {
      title: 'Level of care',
      data: <any> null,
      render: (row: webapi.SlotTableRow): string => {
        return row.careLevel || 'Unknown';
      },
      searching: true,
    }, {
      title: 'DRR',
      data: <any> null,
      render: (row: webapi.SlotTableRow): string => {
        return row.drr || 'Unknown';
      },
      searching: true,
    }, {
      title: 'ARR',
      data: <any> null,
      render: (row: webapi.SlotTableRow): string => {
        return row.arr || 'Unknown';
      },
      searching: true,
    }, {
      title: 'Checklist',
      // order: true,
      type: 'numeric',
      // autoWidth: false,
      width: '105px',
      data: (row: webapi.SlotTableRow): string => {
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


  $('#slots-table').DataTable({
    ajax: {
      url: '/slots',
      dataType: 'json',
      dataSrc: 'data',
    },
    dom: '<"row"<"col-sm-8"l><"col-sm-4"B>>rtip',
    // initComplete: function () {
    //   Holder.run({
    //       images: '.user img'
    //   });
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
