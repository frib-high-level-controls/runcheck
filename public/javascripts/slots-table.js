
/*global Table: false, Holder: false*/

// slot columns starts
var detailsColum = {
  title: 'Details',
  data: '_id',
  render: function (data) {
    return '<a href="' + '/slots/' + data + '" target="_blank" data-toggle="tooltip" title="go to the slot details"><i class="fa fa-list-alt fa-2x"></i></a>';
  },
  order: false
};

var nameColumn = {
  title: 'Name',
  defaultContent: 'unknown',
  data: 'name',
  searching: true
};

var ownerColumn = Table.personColumn('Owner', 'owner');

var areaColumn = {
  title: 'Associated area',
  defaultContent: 'unknown',
  data: 'area',
  searching: true
};

var levelColumn = {
  title: 'Level of care',
  defaultContent: 'unknown',
  data: 'level',
  searching: true
};

var deviceTypeColumn = {
  title: 'Device type',
  defaultContent: 'unknown',
  data: 'deviceType',
  searching: true
};

var locationColumn = {
  title: 'Location or coordinates',
  defaultContent: 'unknown',
  data: 'location',
  searching: true
};

var deviceColumn = {
  title: 'Device',
  data: 'device',
  render: function (data) {
    if (!data.id) {
      return 'Not installed';
    }
    return '<a href="' + '/devices/' + data.id + '" target="_blank" data-toggle="tooltip" title="go to the slot serialized device"><i class="fa fa-link fa-2x"></i></a>';
  },
  order: false
};

var statusMap = {0: 'Device not installed',
  1: 'Device installed',
  2: 'DO OK',
  2.5: 'Slot DRR checklist',
  3: 'AM approved',
  4:'DRR approved'
};

var approvelStatusColumn = {
  title: 'Approved status',
  data: 'status',
  render: function (data) {
    return  statusMap[data];
  },
  searching: true
};

var machineModeColumn = {
  title: 'Associated machine mode(s)',
  defaultContent: 'None',
  data: 'machineMode',
  searching: true
};

var checkedProgressColumn = {
  title: 'Readiness Checked progress',
  order: true,
  type: 'numeric',
  autoWidth: false,
  width: '105px',
  data: function (source) {
    return Table.progressBar( source.ReadinessCheckedValue, source.ReadinessTotalValue);
  }
};

var DRRProgressColumn = {
  title: 'DRR progress',
  order: true,
  type: 'numeric',
  autoWidth: false,
  width: '105px',
  data: function (source) {
    return Table.progressBar( source.DRRCheckedValue, source.DRRTotalValue);
  }
};

var ARRProgressColumn = {
  title: 'ARR progress',
  order: true,
  type: 'numeric',
  autoWidth: false,
  width: '105px',
  data: function (source) {
    return Table.progressBar( source.ARRCheckedValue, source.ARRTotalValue);
  }
};
// slot columns end

var slotColumns = [Table.selectColumn, detailsColum, nameColumn, ownerColumn, areaColumn, levelColumn, deviceTypeColumn, locationColumn, deviceColumn, approvelStatusColumn, machineModeColumn, checkedProgressColumn, DRRProgressColumn, ARRProgressColumn];
$(function () {
  $('#slots-table').DataTable({
    ajax: {
      url: './json',
      dataSrc: ''
    },
    initComplete: function () {
      Holder.run({
        images: '.user img'
      });
    },
    autoWidth: true,
    processing: true,
    pageLength: 10,
    lengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      loadingRecords: 'Please wait - loading data from the server ...'
    },
    deferRender: true,
    columns: slotColumns,
    order: [
      [2, 'asc']
    ]
  });
  Table.addFilterFoot('#slots-table', slotColumns);

  $('#spec-slots-table').DataTable({
    ajax: {
      url: window.location.pathname +'/slots',
      dataSrc: ''
    },
    initComplete: function () {
      Holder.run({
        images: '.user img'
      });
    },
    autoWidth: true,
    processing: true,
    pageLength: 10,
    lengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      loadingRecords: 'Please wait - loading data from the server ...'
    },
    deferRender: true,
    columns: slotColumns,
    order: [
      [2, 'asc']
    ]
  });
  Table.addFilterFoot('#spec-slots-table', slotColumns);

  Table.filterEvent();
  Table.selectEvent();
});