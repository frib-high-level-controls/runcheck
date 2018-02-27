/**
 * Slots table view
 */

// Base URL for FORG service
let forgurl: string | undefined;

$(WebUtil.wrapCatchAll0(async () => {
  type SlotTableRow = webapi.SlotTableRow & { selected?: boolean };

  /**
   * Defines the full view model for this page.
   */
  class SlotsTableViewModel {
    public newGroupButton = new NewGroupButtonViewModel(this);
    public newGroupModal = new NewGroupModalViewModel(this);
    public existingGroupButton = new ExistingGroupButtonViewModel(this);
    public existingGroupModal = new ExistingGroupModalViewModel(this);
    public selectedRows = ko.observableArray<DataTables.RowMethods>();

    constructor() {
      this.selectedRows.subscribe((rows) => {
        if (rows.length > 0) {
          this.newGroupButton.checkToShowButton(rows);
          this.existingGroupButton.checkToShowButton(rows);
        } else {
          this.newGroupButton.disable();
          this.existingGroupButton.disable();
        }
      });
    }
    /**
     * Add a row (in order by index) to the array of selected rows.
     */
    public selectRow(row: DataTables.RowMethods) {
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
      // console.log("SELECTED ROWS: %s", this.selectedRows().length);
    }

    /**
     * Remove a row (by index) from the array of selected rows.
     */
    public deselectRow(row: DataTables.RowMethods) {
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
      // console.log("SELECTED ROWS: %s", this.selectedRows().length);
    }
  }

  class NewGroupButtonViewModel {
    public groupOwner: string;
    public safetyLevel: string;
    public canCreate = ko.observable(false);
    private parent: SlotsTableViewModel;

    constructor(parent: SlotsTableViewModel) {
      this.parent = parent;
      this.canCreate = ko.observable(false);
    }

    public checkToShowButton(rows: DataTables.RowMethods[]) {
      let cancreate: boolean = false;
      if (rows.length > 0) {
        let dataFirstRow = <SlotTableRow> rows[0].data();
        if (rows.length === 1) {
          if (!dataFirstRow.groupId) {
            cancreate = true;
          }
        } else {
          // Check to see if groupid is null, area & safety level is same for each row
          for (let r of rows) {
            let data = <SlotTableRow> r.data();
            if (data.groupId || (data.area !== dataFirstRow.area) || (data.safetyLevel !== dataFirstRow.safetyLevel)) {
              cancreate = false;
              break;
            } else {
              cancreate = true;
              continue;
            }
          }
        }
        if (dataFirstRow.canGroup === false) {
          cancreate = false;
        }
        if (cancreate === false) {
          this.canCreate(false);
        } else {
          this.canCreate(true);
          this.groupOwner = dataFirstRow.area;
          this.safetyLevel = dataFirstRow.safetyLevel;
        }
      }
    }

    public createNewGroup() {
      // Open the modal
      this.parent.newGroupModal.show(this.groupOwner, this.safetyLevel);
    }

    public disable() {
      this.canCreate(false);
    }
  }

  /**
   * Defines the view model for the new group modal dialog.
   */
  class NewGroupModalViewModel {
    public canSubmit = ko.observable(false);
    public canClose = ko.observable(true);
    public isSubmitted = false;

    public name = ko.observable<string>();
    public description = ko.observable<string>();
    public groupOwner = ko.observable<string>();
    public safetyLevel = ko.observable<string>();

    private parent: SlotsTableViewModel;

    constructor(parent: SlotsTableViewModel) {
      this.parent = parent;
      this.canSubmit = ko.observable(false);
      this.canClose = ko.observable(true);

      let refreshCanSubmit = () => {
        if (!this.name()) {
          this.canSubmit(false);
        } else if (!this.groupOwner()) {
          this.canSubmit(false);
        } else {
          this.canSubmit(true);
        }
      };

      this.name.subscribe((v) => {
        refreshCanSubmit();
      });
    }

    public close() {
      this.hide();
      // $('#slots-table').DataTable().ajax.reload();
      if (this.isSubmitted === true) {
        location.reload();
      }
    }

    public reset() {
      this.groupOwner('');
      this.safetyLevel('');
      this.name('');
      this.description('');
      this.canSubmit(false);
      this.canClose(true);
      this.isSubmitted = false;
    }

    public show(groupOwner: string, safetyLevel: string) {
      this.reset();
      this.groupOwner(groupOwner);
      this.safetyLevel(safetyLevel);
      $('#newGroupModal').modal({backdrop: 'static', keyboard: false, show: true});
    }

    public hide() {
      $('#newGroupModal').modal('hide');
    }

    public async createNewGroupandAddSlot() {
      let pkg: webapi.Pkg<webapi.Group>;
      this.isSubmitted = true;
      this.canSubmit(false);
      try {
        pkg = await $.ajax({
          url: '/groups/slot',
          type: 'POST',
          dataType: 'json',
          contentType: 'application/json',
          data: JSON.stringify({
            data: {
              name: this.name(),
              owner: this.groupOwner(),
              desc: this.description(),
              safetyLevel: this.safetyLevel(),
            },
          }),
        });
      } catch (xhr) {
        pkg = xhr.responseJSON;
        let message = 'Unknown error creating new group';
        if (pkg && pkg.error && pkg.error.message) {
          message = pkg.error.message;
        }
        $('#message').prepend(`
          <div class="alert alert-danger">
            <button class="close" data-dismiss="alert">x</button>
            <span>${message}</span>
          </div>
        `).removeAttr('disabled');
        return;
      }
      if (!pkg.data || !pkg.data.id) {
        $('#message').prepend(`
          <div class="alert alert-danger">
            <button class="close" data-dismiss="alert">x</button>
            Group creation failed. Missing ID.
          </div>`);
        return;
      }
      $('#message').prepend(`
        <div class="alert alert-success">
          <button class="close" data-dismiss="alert">x</button>
          Slot Group <a href="/groups/slot/${pkg.data.id}" target="_blank">${pkg.data.name}</a> created successfully.
        </div>`);

      // Add the slots to created group

      for (let row of this.parent.selectedRows()) {
        let data = <SlotTableRow> row.data();
        let slotpkg: webapi.Pkg<webapi.Slot>;
        try {
          slotpkg = await $.ajax({
            url: `/groups/slot/${pkg.data.id}/members`,
            type: 'POST',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify({
              data: { id: data.id },
            }),
          });
        } catch (xhr) {
          slotpkg = xhr.responseJSON;
          let message = 'Unknown error creating new group';
          if (slotpkg && slotpkg.error && slotpkg.error.message) {
            message = slotpkg.error.message;
          }
          $('#message').prepend(`
            <div class="alert alert-danger">
              <button class="close" data-dismiss="alert">x</button>
              <span>${message}</span>
            </div>
          `).removeAttr('disabled');
          $('#newGroupModal').modal('hide');
          return;
        }
        $('#message').append(`
          <div class="alert alert-success">
            <button class="close" data-dismiss="alert">x</button>
            Slot ${data.name} added to group ${pkg.data.name} succesfully.
          </div>`);
      }
    }
  }

  class ExistingGroupButtonViewModel {
    public canAdd = ko.observable(false);
    public pkg: webapi.Pkg<webapi.GroupTableRow[]>;
    private parent: SlotsTableViewModel;

    constructor(parent: SlotsTableViewModel) {
      this.parent = parent;
      this.canAdd = ko.observable(false);
    }

    public async checkToShowButton(rows: DataTables.RowMethods[]) {
      let canadd: boolean = false;

      if (rows.length > 0) {
        let dataFirstRow = <SlotTableRow> rows[0].data();
        if (rows.length === 1) {
          if (!dataFirstRow.groupId) {
            canadd = true;
          }
        } else {
          // Check to see if groupid is null, area & safety level is same for each row
          for (let r of rows) {
            let data = <SlotTableRow> r.data();
            if (data.groupId || (data.area !== dataFirstRow.area) || (data.safetyLevel !== dataFirstRow.safetyLevel)) {
              canadd = false;
              break;
            } else {
              canadd = true;
              continue;
            }
          }
        }
        if (dataFirstRow.canGroup === false) {
          canadd = false;
        }
        if (canadd === true) {
          try {
            this.pkg = await $.ajax({
              url: '/groups/slot',
              type: 'GET',
              dataType: 'json',
              data: {
                OWNER: dataFirstRow.area,
                SAFETYLEVEL: dataFirstRow.safetyLevel,
              },
            });
          } catch (err) {
            $('#message').prepend(`
              <div class="alert alert-danger">
                <button class="close" data-dismiss="alert">x</button>
                Failed to get Groups ${err.responseText}
              </div>`);
          }
        }
        if ((canadd === false) || (this.pkg.data.length === 0)) {
          this.canAdd(false);
        } else {
          this.canAdd(true);
        }
      }
    }

    public addToExistingGroup() {
      // Open the modal
      this.parent.existingGroupModal.show(this.pkg.data);
    }

    public disable() {
      this.canAdd(false);
    }
  }

  /**
   * Defines the view model for the new group modal dialog.
   */
  class ExistingGroupModalViewModel {
    public canSubmit = ko.observable(false);
    public canClose = ko.observable(true);
    public groupOptions = ko.observableArray<string>();
    public selectedGroup = ko.observable<string>();
    public groupOptionsObject: Array<{name: string, id: string}> = [];
    public isSubmitted = false;

    private parent: SlotsTableViewModel;

    constructor(parent: SlotsTableViewModel) {
      this.parent = parent;
      this.groupOptionsObject = [];
      this.canSubmit = ko.observable(false);
      this.canClose = ko.observable(true);

      let refreshCanSubmit = () => {
        if (!this.selectedGroup()) {
          this.canSubmit(false);
        } else {
          this.canSubmit(true);
        }
      };

      this.selectedGroup.subscribe((v) => {
        refreshCanSubmit();
      });
    }

    public close() {
      this.hide();
      // $('#slots-table').DataTable().ajax.reload();
      if (this.isSubmitted === true) {
        location.reload();
      }
    }

    public reset() {
      this.selectedGroup('');
      this.groupOptions([]);
      this.groupOptionsObject = [];
      this.canSubmit(false);
      this.canClose(true);
      this.isSubmitted = false;
    }

    public show(groups: webapi.GroupTableRow[]) {
      this.reset();
      for (let group of groups) {
        let option = group.name;
        this.groupOptions.push(option);
        this.groupOptionsObject.push({name: option, id: group.id});
      }
      $('#existingGroupModal').modal({backdrop: 'static', keyboard: false, show: true});
    }

    public hide() {
      $('#existingGroupModal').modal('hide');
    }

    public async addToExistingGroup() {
      this.isSubmitted = true;
      this.canSubmit(false);
      // Add the slots to group
      for (let row of this.parent.selectedRows()) {
        let data = <SlotTableRow> row.data();
        let selectedGroupId: string = '';
        for (let g of this.groupOptionsObject) {
          if (g.name === this.selectedGroup()) {
            selectedGroupId = g.id;
            break;
          }
        }

        let pkg: webapi.Pkg<webapi.Slot>;
        try {
          pkg = await $.ajax({
            url: `/groups/slot/${selectedGroupId}/members`,
            type: 'POST',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify({
              data: { id: data.id },
            }),
          });
        } catch (xhr) {
          pkg = xhr.responseJSON;
          let message = 'Unknown error adding slot';
          if (pkg && pkg.error && pkg.error.message) {
            message = pkg.error.message;
          }
          $('#message2').prepend(`
            <div class="alert alert-danger">
              <button class="close" data-dismiss="alert">x</button>
              <span>${message}</span>
            </div>
          `).removeAttr('disabled');
          return;
        }
        $('#message2').append(`
          <div class="alert alert-success">
            <button class="close" data-dismiss="alert">x</button>
            Slot ${data.name} added successfully to group ${this.selectedGroup()}
          </div>`);
      }
    }
  }

  const vm = new SlotsTableViewModel();
  ko.applyBindings(vm);
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
      [2, 'asc'],
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
