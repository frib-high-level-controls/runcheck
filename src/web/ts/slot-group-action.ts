/**
 * Support user interaction on Slot Group details view.
 */

let group: webapi.Group | undefined;

$(() => {
  type GroupMemberTableRow = webapi.GroupMemberTableRow & { selected?: boolean };

  /**
  * Defines the full view model for this page.
  */
  class GroupMemberTableViewModel {
    public deleteSlotButton = new DeleteSlotButtonViewModel(this);
    // public newGroupModal = new NewGroupModalViewModel(this);
    // public existingGroupButton = new ExistingGroupButtonViewModel(this);
    // public existingGroupModal = new ExistingGroupModalViewModel(this);
    public selectedRows = ko.observableArray<DataTables.RowMethods>();

    constructor() {
      this.selectedRows.subscribe((rows) => {
        if (rows.length > 0) {
          this.deleteSlotButton.checkToShowButton(rows);
          //this.existingGroupButton.checkToShowButton(rows);
        }
      })
    }
    /**
     * Add a row (in order by index) to the array of selected rows.
     */
    public selectRow(row: DataTables.RowMethods) {
      // Cast required here because 'object' type is used.
      let data = <GroupMemberTableRow>row.data();
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
      // Cast required here because 'object' type is used.
      let data = <GroupMemberTableRow>row.data();
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

  class DeleteSlotButtonViewModel {
    private parent: GroupMemberTableViewModel;
    public canDelete = ko.observable(false);

    constructor(parent: GroupMemberTableViewModel) {
      this.parent = parent;
      this.canDelete = ko.observable(false);
    }

    public checkToShowButton(rows: DataTables.RowMethods[]) {
      // Check here for delete authorization
      this.canDelete(true);
    }
      
    public deleteSlot() {
      for (let row of this.parent.selectedRows()) {
        let data = <GroupMemberTableRow> row.data();
        $.ajax({
          url: `/groups/${ group? group.id : '' }/removeSlots`,
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({
            passData: { id: data.id }
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
        });
      }
    }
  }

  function showMessage(msg: string) {
    $('#message').append(`
      <div class="alert alert-danger">
        <button class="close" data-dismiss="alert">x</button>
        <span>${msg}</span>
      </div>
    `);
  }

  // ensure the device has been initialized
  if (!group) {
    showMessage('Group not initialized');
    return;
  }

    // const DEPT_LEADER_ROLE = 'GRP:' + device.dept + '#LEADER';

    // const perms = {
    //   assign: false,
    // };

    // if (AuthUtil.hasAnyRole(['SYS:RUNCHECK', DEPT_LEADER_ROLE])) {
    //   perms.assign = true;
    // }
  if (group.checklistId) {
    // TODO: Show 'unassign' button if permitted.
    $('#checklist-panel').removeClass('hidden');
    ChecklistUtil.render('#checklist-panel', group.checklistId);
  }
  // else {
  //   if (perms.assign) {
  //     $('#device-assign-checklist').removeClass('hidden').removeAttr('disabled');
  //   } else {
  //     $('#device-assign-checklist').removeClass('hidden').attr('disabled', 'disabled');
  //   }
  // }

  const vm = new GroupMemberTableViewModel();
  ko.applyBindings(vm);

  const slotColumns: datatablesutil.ColumnSettings[] = [
    {
      title: '',
      data: <any> null,
      render: (row: GroupMemberTableRow): string => {
        return `<input type="checkbox" class="row-select-box" ${row.selected ? 'checked="checked"' : ''}/>`;
      },
      searching: false,
    },{
      title: 'Name',
      data: <any> null,
      render: (row: GroupMemberTableRow): string => {
        return `<a href="/slots/${row.name}">${row.name}</a>`;
      },
      searching: true,
    }, {
      title: 'Type',
      data: <any> null,
      render: (row: GroupMemberTableRow): string => {
        return row.deviceType || 'Unknown';
      },
      searching: true,
    }, {
      title: 'Area',
      data: <any> null, // 'area',
      render: (row: GroupMemberTableRow) => {
        if ((<any> window).forgurl && row.area) {
          return `<a href="${forgurl}/groups/${row.area}" target="_blank">${row.area}</a>`;
        } else {
          return row.area || 'Unknown';
        }
      },
      searching: true,
    }, {
      title: 'Level of care',
      data: <any> null,
      render: (row: GroupMemberTableRow): string => {
        return row.careLevel || 'Unknown';
      },
      searching: true,
    }, {
      title: 'DRR',
      data: <any> null,
      render: (row: GroupMemberTableRow): string => {
        return row.drr || 'Unknown';
      },
      searching: true,
    }, {
      title: 'ARR',
      data: <any> null,
      render: (row: GroupMemberTableRow): string => {
        return row.arr || 'Unknown';
      },
      searching: true,
    },
  ];

  let GroupMemberTable = $('#slot-table').DataTable({
    ajax: {
      url: `/groups/slot/${group ? group.id : ''}/members`,
      dataType: 'json',
      dataSrc: 'data',
    },
    dom: '<"row"<"col-sm-8"l><"col-sm-4"B>>rtip',
    autoWidth: false,
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
      [0, 'asc'],
    ],
  });
  DataTablesUtil.addFilterHead('#slot-table', slotColumns);

  $('#slot-table').on('click', '.row-select-box', WebUtil.wrapCatchAll1((event) => {
    let selectbox = $(event.target);
    if (selectbox.is(':checked')) {
      let tr = selectbox.parents('tr').first();
      tr.addClass('selected active');
      let row = GroupMemberTable.row(tr.get(0));
      vm.selectRow(row);
    } else {
      let tr = selectbox.parents('tr').first();
      tr.removeClass('selected active');
      let row = GroupMemberTable.row(tr.get(0));
      vm.deselectRow(row);
    }
  }));
// var passData;
// $('#remove').click(function (e) {
//   e.preventDefault();
//   if ($('.row-selected').length == 0) {
//     $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Please select at least one slot.</div>');
//     return;
//   }
//   var selectedData = []; // no validation for removing, passData equals selectedData
//   $('.row-selected').each(function() {
//     var href = $(this).closest('tr').children().eq(1).children().attr('href');
//     var name = $(this).closest('tr').children().eq(2).text();
//     selectedData.push({
//       id: href.split('/')[2],
//       name: name
//     });
//   });
//   passData = selectedData;

//   $('#modalLabel').html('Remove Slots form current group?');
//   var footer = '<button id="modal-submit" class="btn btn-primary" data-dismiss="modal">Confirm</button>' +
//     '<button data-dismiss="modal" aria-hidden="true" class="btn" id="modal-cancel">Cancel</button>';
//   $('#modal .modal-footer').html(footer);
//   $('#modal').modal('show');
// });

// $('#modal').on('click','#modal-cancel',function (e) {
//   e.preventDefault();
//   reset();
// });

// $('#modal').on('click','#modal-submit',function (e) {
//   e.preventDefault();
//   var url = window.location.pathname + '/removeSlots';
//   $.ajax({
//     url: url,
//     type: 'Post',
//     contentType: 'application/json',
//     data: JSON.stringify({
//       passData: passData,
//     })
//   }).done(function (data) {
//     if(data.doneMsg.length) {
//       var s = '';
//       for(var i = 0; i < data.doneMsg.length; i++){
//         s =  s + data.doneMsg[i]+ '<br>';
//       }
//       $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>' +  s +'</div>');
//     }
//     if(data.errMsg.length) {
//       var es = '';
//       for(i = 0; i < data.errMsg.length; i++){
//         es =  es + data.errMsg[i]+ '<br>';
//       }
//       $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' +  es +'</div>');
//     }
//   }).fail(function (jqXHR) {
//     $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' +  jqXHR.responseText + '</div>');
//   }).always(function() {
//     $('#spec-slots-table').DataTable().ajax.reload();// reload table
//     reset();
//   });
// });

// function reset() {
//   $('.modal-body').html( '<div class="panel"> ' +
//     '<div class="panel-heading"></div> ' +
//     '</div>' +
//     '<form class="form-inline"> ' +
//     '<label>Please select one slot group:</label> ' +
//     '<select class="form-control"></select> ' +
//     '</form>');
//   passData = null;
// }
});
