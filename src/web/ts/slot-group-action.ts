/**
 * Support user interaction on Slot Group details view.
 */
import Vue from 'vue';
import ChecklistUtil from './checklistutil-shim';
import History from './components/History.vue';
import WebUtil from './webutil-shim';

$(() => {
  type GroupMemberTableRow = webapi.Slot & { selected?: boolean };

  const group: webapi.Group = (window as any).group;

  /**
   * Defines the full view model for this page.
   */
  class GroupMemberTableViewModel {
    public deleteSlotButton = new DeleteSlotButtonViewModel(this);
    public deleteSlotModal = new DeleteSlotModalViewModel(this);
    public selectedRows = ko.observableArray<DataTables.RowMethods>();

    constructor() {
      this.selectedRows.subscribe((rows) => {
        if (rows.length > 0) {
          this.deleteSlotButton.checkToShowButton(rows);
        } else {
          this.deleteSlotButton.disable();
        }
      });
    }
    /**
     * Add a row (in order by index) to the array of selected rows.
     */
    public selectRow(row: DataTables.RowMethods) {
      // Cast required here because 'object' type is used.
      const data = row.data() as GroupMemberTableRow;
      data.selected = true;
      let added = false;
      const rows: DataTables.RowMethods[] = [];
      for (const r of this.selectedRows()) {
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
      const data = row.data() as GroupMemberTableRow;
      data.selected = false;
      let removed = false;
      const rows: DataTables.RowMethods[] = [];
      for (const r of this.selectedRows()) {
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

  class DeleteSlotButtonViewModel {
    public canDelete = ko.observable(false);
    private parent: GroupMemberTableViewModel;

    constructor(parent: GroupMemberTableViewModel) {
      this.parent = parent;
      this.canDelete = ko.observable(false);
    }

    public checkToShowButton(rows: DataTables.RowMethods[]) {
      // Check here for delete authorization
      if (group && group.canManage) {
        this.canDelete(true);
      }
    }

    public deleteSlot() {
      this.parent.deleteSlotModal.show();
    }

    public disable() {
      this.canDelete(false);
    }
  }

  class DeleteSlotModalViewModel {
    public canSubmit = ko.observable(false);
    public canClose = ko.observable(true);
    public isSubmitted = false;
    private parent: GroupMemberTableViewModel;

    constructor(parent: GroupMemberTableViewModel) {
      this.parent = parent;
      this.canSubmit = ko.observable(false);
      this.canClose = ko.observable(true);
    }

    public reset() {
      this.isSubmitted = false;
    }

    public show() {
      this.reset();
      this.canSubmit(true);
      this.canClose(true);
      if (this.parent.selectedRows().length > 1) {
        $('#delete_message').text(`Are you sure you want to remove these ${this.parent.selectedRows().length} slots?`);
      } else {
        $('#delete_message').text(`Are you sure you want to remove this slot?`);
      }
      $('#removeSlotModal').modal({backdrop: 'static', keyboard: false, show: true});
    }

    public close() {
      $('#removeSlotModal').modal('hide');
      if (this.isSubmitted === true) {
        location.reload();
      }
    }

    public async deleteSlot() {
      this.isSubmitted = true;
      this.canSubmit(false);
      for (const row of this.parent.selectedRows()) {
        const data = row.data() as GroupMemberTableRow;
        let pkg: webapi.Pkg<webapi.Slot>;
        try {
          pkg = await $.ajax({
            url: `${basePath}/groups/slot/${ group ? group.id : '' }/members`,
            type: 'DELETE',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify({
              data: { id: data.id },
            }),
          });
        } catch (xhr) {
          pkg = xhr.responseJSON;
          let message = 'Unknown error removing slot';
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
            Slot ${data.name} was removed successfully.
          </div>`);
        // $('#slot-table').DataTable().ajax.reload();
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

  // register event handlers

  $('#checklist-assign').click(WebUtil.wrapCatchAll1(async (evt) => {
    evt.preventDefault();
    $('#checklist-assign').addClass('hidden');
    $('#checklist-spin').removeClass('hidden');

    let pkg: webapi.Pkg<webapi.ChecklistDetails>;
    try {
      pkg = await $.get({
        url: `${basePath}/checklists`,
        contentType: 'application/json',
        data: JSON.stringify({
          data: {
            targetId: group.id,
            targetType: 'GROUP',
          },
        }),
        method: 'POST',
        dataType: 'json',
      });
    } catch (xhr) {
      pkg = xhr.responseJSON;
      let message = 'Unknown error assigning checklist';
      if (pkg && pkg.error && pkg.error.message) {
        message = pkg.error.message;
      }
      $('#checklist-spin').addClass('hidden');
      $('#checklist-assign').removeClass('hidden');
      $('#checklist-panel').prepend(`
        <div class="alert alert-danger">
          <button class="close" data-dismiss="alert">x</button>
          <span>${message}</span>
        </div>
      `).removeClass('hidden');
      return;
    }

    $('#checklist-spin').addClass('hidden');
    $('#checklist-panel').removeClass('hidden');
    ChecklistUtil.render('#checklist-panel', pkg.data);
  }));

  if (group.checklistId) {
    // if (slot.canAssign) {
    //   $('#checklist-unassign').removeClass('hidden').removeAttr('disabled');
    // } else {
    //   $('#checklist-unassign').removeClass('hidden').attr('disabled', 'disabled');
    // }
    ChecklistUtil.render('#checklist-panel', group.checklistId);
  } else {
    $('#checklist-panel').html(`
      <div>
        <span>No checklist assigned</span>
      </div>
    `).removeClass('hidden');
    if (group.canAssign) {
      $('#checklist-assign').removeClass('hidden').removeAttr('disabled');
    } else {
      $('#checklist-assign').removeClass('hidden').attr('disabled', 'disabled');
    }
  }

  const vm = new GroupMemberTableViewModel();
  ko.applyBindings(vm);

  const slotColumns: datatablesutil.ColumnSettings[] = [
    {
      title: '',
      data: null as any,
      render: (row: GroupMemberTableRow): string => {
        return `<input type="checkbox" class="row-select-box" ${row.selected ? 'checked="checked"' : ''}/>`;
      },
      searching: false,
    },  {
      title: 'Order',
      data: null as any,
      render: (row: GroupMemberTableRow): string => {
        const m = row.name.match(/([DN]\d+)/);
        return m ? m[1] : '';
      },
      searching: true,
    }, {
      title: 'Name',
      data: null as any,
      render: (row: GroupMemberTableRow): string => {
        return `<a class="text-monospace text-nowrap" href="${basePath}/slots/${row.name}">${row.name}</a>`;
      },
      searching: true,
    }, {
      title: 'Type',
      data: null as any,
      render: (row: GroupMemberTableRow): string => {
        return row.deviceType || 'Unknown';
      },
      searching: true,
    }, {
      title: 'Area',
      data: null as any, // 'area',
      render: (row: GroupMemberTableRow) => {
        if (forgurl && row.area) {
          return `<a class="text-monospace" href="${forgurl}/groups/${row.area}" target="_blank">${row.area}</a>`;
        } else {
          return `<span class="text-monospace">${row.area || 'Unknown'}</span>`;
        }
      },
      searching: true,
    }, {
      title: 'Level of care',
      data: null as any,
      render: (row: GroupMemberTableRow): string => {
        switch (row.careLevel) {
          case 'LOW': return 'Low';
          case 'MEDIUM': return 'Medium';
          case 'HIGH': return 'High';
          default: return row.careLevel || 'Unknown';
        }
      },
      searching: true,
    }, {
      title: 'DRR',
      data: null as any,
      render: (row: GroupMemberTableRow): string => {
        return row.drr || 'Unknown';
      },
      searching: true,
    }, {
      title: 'ARR',
      data: null as any,
      render: (row: GroupMemberTableRow): string => {
        return row.arr || 'Unknown';
      },
      searching: true,
    },
  ];

  const GroupMemberTable = $('#slot-table').DataTable({
    ajax: {
      url: `${basePath}/groups/slot/${group ? group.id : ''}/members`,
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
      [2, 'asc'],
    ],
  });
  DataTablesUtil.addFilterHead('#slot-table', slotColumns);

  $('#slot-table').on('click', '.row-select-box', WebUtil.wrapCatchAll1((event) => {
    const selectbox = $(event.target);
    if (selectbox.is(':checked')) {
      const tr = selectbox.parents('tr').first();
      tr.addClass('selected active');
      const row = GroupMemberTable.row(tr.get(0));
      vm.selectRow(row);
    } else {
      const tr = selectbox.parents('tr').first();
      tr.removeClass('selected active');
      const row = GroupMemberTable.row(tr.get(0));
      vm.deselectRow(row);
    }
  }));

  const v = new Vue({
    template: `
      <div>
        <history-component :GET_URI = "GET_HISTORY_URI"></history-component>
      </div>
    `,
    data: {
      GET_HISTORY_URI: `${basePath}/groups/slot/${group.id}/history`,
    },
    components: {
      'history-component': History,
    },
  });

  v.$mount('#history');
});
