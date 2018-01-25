/**
 * Slots table view
 */

// Base URL for FORG service
let forgurl: string | undefined;

$(WebUtil.wrapCatchAll0(async () => {
  console.log('slots-table.ts 1');
  type SlotTableRow = webapi.SlotTableRow & { selected?: boolean };
   /**
   * Defines the full view model for this page.
   */
  class SlotsTableViewModel {
    public newGroupButton = new NewGroupButtonViewModel(this);
    public newGroupModal = new NewGroupModalViewModel(this);
    public selectedRows = ko.observableArray<DataTables.RowMethods>();

    constructor() {
      console.log('slots-table.ts 2');
      this.selectedRows.subscribe((rows) => {
        if (rows.length > 0) {
          console.log('slots-table.ts 3');
          this.newGroupButton.checkToShowButton(rows);
        }
      })
    }
    /**
     * Add a row (in order by index) to the array of selected rows.
     */
    public selectRow(row: DataTables.RowMethods) {
      console.log('slots-table.ts 4');
      // Cast required here because 'object' type is used.
      let data = <SlotTableRow> row.data();
      data.selected = true;
      let added = false;
      let rows: DataTables.RowMethods[] = [];
      for (let r of this.selectedRows()) {
        if (r.index() === row.index()) {
          return;
        }
        if (!added && (r.index() > row.index())) {
          rows.push(row);
          added = true;
        }
        rows.push(r);
      }
      if (added) {
        this.selectedRows(rows);
      } else {
        this.selectedRows.push(row);
      }
      console.log("SELECTED ROWS: %s", this.selectedRows().length);
    }

    /**
     * Remove a row (by index) from the array of selected rows.
     */
    public deselectRow(row: DataTables.RowMethods) {
      console.log('slots-table.ts 5');
      // Cast required here because 'object' type is used.
      let data = <SlotTableRow> row.data();
      data.selected = false;
      let removed = false;
      let rows: DataTables.RowMethods[] = [];
      for (let r of this.selectedRows()) {
        if (r.index() === row.index()) {
          removed = true;
          continue;
        }
        rows.push(r);
      }
      if (removed) {
        this.selectedRows(rows);
      }
      console.log("SELECTED ROWS: %s", this.selectedRows().length);
    }
  }

  class NewGroupButtonViewModel {
    private parent: SlotsTableViewModel;
    public groupOwner: string;
    public canCreate = ko.observable(false);

    constructor(parent: SlotsTableViewModel) {
      //console.log('slots-table.ts 6 parent %s', this.parent ? 'Parent is defined':'Parent undefined');
      this.parent = parent;
      this.canCreate = ko.observable(false);
      console.log('slots-table.ts 6 parent %s', this.parent ? 'Parent is defined':'Parent undefined');
    }

    public checkToShowButton(rows: DataTables.RowMethods[]) {
      console.log('slots-table.ts 7');
      let cancreate: boolean = false;
      if (rows.length > 0) {
        let dataFirstRow = <SlotTableRow>rows[0].data();
        if (rows.length === 1) {
          console.log('slots-table.ts 8');
          if (!dataFirstRow.groupId) {
            console.log('slots-table.ts 9');
            cancreate = true;
          }
        } else {
          console.log('slots-table.ts 10');
          // Check to see if groupid is null, area & safety level is same for each row
          for (let r of rows) {
            let data = <SlotTableRow>r.data();
            if (data.groupId || (data.area !== dataFirstRow.area) || (data.safetyLevel !== dataFirstRow.safetyLevel)) {
              console.log('slots-table.ts 11');
              cancreate = false;
              break;
            } else {
              console.log('slots-table.ts 12');
              cancreate = true;
              continue;
            }
          }
        }
        if (cancreate === false) {
          console.log('slots-table.ts 13');
          this.canCreate(false);
        } else {
          this.canCreate(true);
          this.groupOwner = dataFirstRow.area;
          console.log('slots-table.ts 14 groupowner %s', this.groupOwner);
        }
      }
    }
      
    public createNewGroup() {
      // Open the modal
      console.log('slots-table.ts 15');
      this.parent.newGroupModal.show(this.groupOwner);
    }
  }

  /**
   * Defines the view model for the new group modal dialog.
   */
  class NewGroupModalViewModel {
    public canSubmit = ko.observable(false);
    public canClose = ko.observable(true);

    public name = ko.observable<string>();
    public description = ko.observable<string>();
    public groupOwner = ko.observable<string>();

    private parent: SlotsTableViewModel;

    constructor(parent: SlotsTableViewModel) {
      console.log('slots-table.ts 16');
      this.parent = parent;
      this.canSubmit = ko.observable(false);
      this.canClose = ko.observable(true);
      
      let refreshCanSubmit = () => {
        if (!this.name()) {
          console.log('No name');
          this.canSubmit(false);
        } else if (!this.groupOwner()) {
          console.log('No GO');
          this.canSubmit(false);
        } else {
          console.log('submit enable');
          this.canSubmit(true);
        }
      };

      this.name.subscribe((v) => {
        refreshCanSubmit();
      });
    }

    public close() {
      this.hide();
    }

    public show(groupOwner: string) {
      console.log('slots-table.ts 17');
      this.groupOwner(groupOwner);
      console.log('name %s desc %s', this.name(), this.description());
      
      $('#newGroupModal').modal('show');
    }

    public hide() {
      $('#newGroupModal').modal('hide');
    }

    public async createNewGroupandAddSlot() {
      console.log('slots-table.ts 19');
      console.log('slots-table.ts 20');
      $.ajax({
        url: '/groups/slotGroups/new',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          passData: { name: this.name(), owner: this.groupOwner(), description: this.description(), memberType: 'Slot' }
        })
      }).done(function (data, status, jqXHR) {
        $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Success: ' + jqXHR.responseText + '</div>');
      }).fail(function (jqXHR) {
        $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Failed: ' + jqXHR.responseText + '</div>');
        $('#newGroupModal').modal('hide');
      });
     
      // Add the slots to created group
  
      for (let row of this.parent.selectedRows()) {
        console.log('slots-table.ts 22');
        let data = <SlotTableRow>row.data();
        $.ajax({
          url: `/groups/${this.name()}/addSlots`,
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({
            passData: { id: data.id, name: data.name }
          })
        }).done(function (data) {
          if (data.doneMsg.length) {
            $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>' + data.doneMsg + '</div>');
            location.reload();
          }
          if (data.errMsg.length) {
            $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + data.errorMsg + '</div>');
          }
        }).fail(function (jqXHR) {
          $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
          $('#newGroupModal').modal('hide');
        }).always(function () {
          $('#newGroupModal').modal('hide');
        });
      }
    }
  }
  console.log('slots-table.ts 24');
  const vm = new SlotsTableViewModel();
  ko.applyBindings(vm);
  console.log('slots-table.ts 25');
  const slotColumns: datatablesutil.ColumnSettings[] = [
    {
      title: '',
      data: <any> null,
      render: (row: SlotTableRow): string => {
        return `<input type="checkbox" class="row-select-box" ${row.selected ? 'checked="checked"' : ''}/>`;
      },
      searching: false,
    }, {
      title: 'Name',
      data: <any> null,
      render: (row: SlotTableRow): string => {
        return `<a href="/slots/${row.name}">${row.name}</a>`;
      },
      searching: true,
    }, {
      title: 'Type',
      data: <any> null,
      render: (row: SlotTableRow): string => {
        return row.deviceType || 'Unknown';
      },
      searching: true,
    },
    // var ownerColumn = Table.personColumn('Owner', 'owner');
    {
      title: 'Area',
      data: <any> null, // 'area',
      render: (row: SlotTableRow) => {
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
      render: (row: SlotTableRow): string => {
        return row.careLevel || 'Unknown';
      },
      searching: true,
    }, {
      title: 'DRR',
      data: <any> null,
      render: (row: SlotTableRow): string => {
        return row.drr || 'Unknown';
      },
      searching: true,
    }, {
      title: 'ARR',
      data: <any> null,
      render: (row: SlotTableRow): string => {
        return row.arr || 'Unknown';
      },
      searching: true,
    }, {
      title: 'Installation Device',
      data: <any> null,
      render: (row: SlotTableRow): string => {
        if (!row.installDeviceName) {
          return '-';
        }
        return `<a href="/devices/${row.installDeviceName}" target="_blank">${row.installDeviceName}</a>`;
      },
      searching: true,
    }, {
      title: 'Checklist',
      // order: true,
      type: 'numeric',
      // autoWidth: false,
      width: '105px',
      data: (row: SlotTableRow): string => {
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


  let SlotTable = $('#slots-table').DataTable({
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

  $('#slots-table').on('click', '.row-select-box', WebUtil.wrapCatchAll1((event) => {
    let selectbox = $(event.target);
    if (selectbox.is(':checked')) {
      let tr = selectbox.parents('tr').first();
      tr.addClass('selected active');
      let row = SlotTable.row(tr.get(0));
      vm.selectRow(row);
    } else {
      let tr = selectbox.parents('tr').first();
      tr.removeClass('selected active');
      let row = SlotTable.row(tr.get(0));
      vm.deselectRow(row);
    }
  }));

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
}));
