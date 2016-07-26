
/*global Table: false*/

// device columns starts
var selectColumn = {
  title: '',
  defaultContent: '<label class="checkbox"><input type="checkbox" class="select-row"></label>',
  oderDataType: 'dom-checkbox',
  order: ['desc', 'asc']
};

var serialNoColumn = {
  title: 'serial No',
  defaultContent: 'unknown',
  data: 'serialNo',
  searching: true
};

var nameColumn = {
  title: 'Name',
  defaultContent: 'unknown',
  data: 'name',
  searching: true
};

var typeColumn = {
  title: 'Type',
  defaultContent: 'unknown',
  data: 'type',
  searching: true
};

var departmentColumn = {
  title: 'Department',
  defaultContent: 'unknown',
  data: 'department',
  searching: true
};

var ownerColumn = Table.personColumn('Owner', 'owner');

var detailsColum = {
  title: 'Details',
  data: 'details',
  render: function (data) {
    return '<a href="' + '/details/' + data + '/" target="_blank" data-toggle="tooltip" title="go to the device details"><i class="fa fa-gear fa-lg"></i></a>';
  },
  order: false
};

var checklistColumn = {
  title: 'Checklist',
  data: 'checklist',
  render: function (data) {
    return '<a href="' + '/checklist/' + data + '/" target="_blank" data-toggle="tooltip" title="go to the checklist"><i class="fa fa fa-list fa-lg"></i></a>';
  },
  order: false
};

var checkedProgressColumn = {
  title: 'Checked progress',
  order: true,
  type: 'numeric',
  autoWidth: false,
  width: '105px',
  data: function (source) {
    return Table.progressBar( source.checkedValue, source.totalValue);
  }
};
// device columns end


$(function () {
  var deviceColumns = [selectColumn, serialNoColumn, nameColumn, typeColumn, departmentColumn, ownerColumn, detailsColum, checklistColumn, checkedProgressColumn ];
  $('#device-table').DataTable({
    ajax: {
      url: '/devices/json'
    },
    initComplete: function () {
      /*Holder.run({
        images: 'img.user'
      });*/
      console.log('initComplete ...');
    },
    autoWidth: false,
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
    columns: deviceColumns,
    order: [
      [2, 'asc']
    ]
  });
  Table.addFilterFoot('#device-table', deviceColumns);
  Table.filterEvent();
  Table.selectEvent();
});