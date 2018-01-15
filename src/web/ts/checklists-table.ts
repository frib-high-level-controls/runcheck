/**
 * Checklists table view
 */

$(WebUtil.wrapCatchAll0(async () => {

  type ChecklistTableRow = webapi.ChecklistTableRow & { selected?: boolean };

  type ChecklistSubjectOption = { name: string, desc: string, count: number };

  // Define the view model

  /**
   * Defines the full view model for this page.
   */
  class ChecklistsTableViewModel {
    public updateStatusForm = new UpdateStatusFormViewModel(this);
    public updateStatusModal = new UpdateStatusModalViewModel(this);
    public selectedRows = ko.observableArray<DataTables.RowMethods>();

    constructor() {
      this.selectedRows.subscribe((rows) => {
        // Find the set of subjects that are common to the selected checklists.
        let subjectOptions: ChecklistSubjectOption[] = [];
        for (let r of rows) {
          // Cast required because 'object' type is used.
          let data = <ChecklistTableRow> r.data();

          for (let subject of data.subjects) {
            // TODO: Check if can Update
            // canUpdate = true;
            let found = false;
            for (let opt of subjectOptions) {
              if (subject.name === opt.name) {
                opt.count += 1;
                found = true;
                break;
              }
            }

            if (!found) {
              subjectOptions.push({
                name: subject.name,
                desc: subject.desc,
                count: 1,
              });
            }
          }
        }

        let commonSubjectOptions: ChecklistSubjectOption[] = [];
        for (let option of subjectOptions) {
          if (option.count === rows.length) {
            commonSubjectOptions.push(option);
          }
        }
        this.updateStatusForm.subjectOptions(commonSubjectOptions);
      });
    }

    /**
     * Add a row (in order by index) to the array of selected rows.
     */
    public selectRow(row: DataTables.RowMethods) {
      // Cast required here because 'object' type is used.
      let data = <ChecklistTableRow> row.data();
      data.selected = true;
      let found = false;
      let rows: DataTables.RowMethods[] = [];
      for (let r of this.selectedRows()) {
        if (r.index() === row.index()) {
          found = true;
          break;
        }
        if (r.index() > row.index()) {
          rows.push(row);
        }
        rows.push(r);
      }
      if (!found) {
        if (rows.length === this.selectedRows().length) {
          this.selectedRows.push(row);
        } else {
          this.selectedRows(rows);
        }
      }
      // console.log("SELECTED ROWS: %s", this.selectedRows().length);
    }

    /**
     * Remove a row (by index) from the array of selected rows.
     */
    public deselectRow(row: DataTables.RowMethods) {
      // Cast required here because 'object' type is used.
      let data = <ChecklistTableRow> row.data();
      data.selected = false;
      let found = false;
      let rows: DataTables.RowMethods[] = [];
      for (let r of this.selectedRows()) {
        if (r.index() === row.index()) {
          found = true;
          continue;
        }
        rows.push(r);
      }
      if (found) {
        this.selectedRows(rows);
      }
      // console.log("SELECTED ROWS: %s", this.selectedRows().length);
    }
  }

  /**
   * Defines the view model for the update status form.
   */
  class UpdateStatusFormViewModel {
    public value = ko.observable<string>();
    public comment = ko.observable<string>();
    public subject = ko.observable<string>();

    public valueOptions = ko.observableArray(['N', 'Y', 'YC']);
    public subjectOptions = ko.observableArray<ChecklistSubjectOption>();

    public canUpdate = ko.observable(false);
    public requireComment = ko.observable(false);

    private parent: ChecklistsTableViewModel;

    constructor(parent: ChecklistsTableViewModel) {
      this.parent = parent;

      let refreshCanUpdate = () => {
        if (!this.subject()) {
          this.canUpdate(false);
        } else if (!this.value()) {
          this.canUpdate(false);
        } else if (this.requireComment() && !this.comment()) {
          this.canUpdate(false);
        } else {
          this.canUpdate(true);
        }
      };

      this.value.subscribe((v) => {
        this.requireComment(v === 'YC');
        refreshCanUpdate();
      });
      this.comment.subscribe(refreshCanUpdate);
      this.subject.subscribe(refreshCanUpdate);
    }

    public update() {
      let subject: ChecklistSubjectOption | undefined;
      for (let option of this.subjectOptions()) {
        if (option.name === this.subject()) {
          subject = option;
        }
      }
      if (subject) {
        this.parent.updateStatusModal.show(this.value(), this.comment(), subject);
      } else {
        console.error('Subject option not found: %s', this.subject());
      }
    }
  }

  /**
   * Defines the view model for the update status modal dialog.
   */
  class UpdateStatusModalViewModel {
    public canUpdate = ko.observable(true);
    public canClose = ko.observable(true);

    public value = ko.observable<string>();
    public comment = ko.observable<string>();
    public subject = ko.observable<ChecklistSubjectOption>({ name: '', desc: '', count: 0});

    public rows = ko.observableArray<UpdateStatusModalRowViewModel>();

    private parent: ChecklistsTableViewModel;

    constructor(parent: ChecklistsTableViewModel) {
      this.parent = parent;
    }

    public update() {
      WebUtil.catchAll(async () => {
        this.canUpdate(false);
        this.canClose(false);
        for (let r of this.rows()) {
          await r.update();
        }
        this.canClose(true);
      });
    }

    public close() {
      this.hide();
    }

    public show(value: string, comment: string, subject: ChecklistSubjectOption) {
      this.value(value);
      this.comment(comment);
      this.subject(subject);

      let rows: UpdateStatusModalRowViewModel[] = [];
      for (let row of this.parent.selectedRows()) {
        rows.push(new UpdateStatusModalRowViewModel(this, row));
      }
      this.rows(rows);

      this.canUpdate(true);
      this.canClose(true);

      $('#updateStatusModal').modal('show');
    }

    public hide() {
      $('#updateStatusModal').modal('hide');
    }
  }

  /**
   * Defines the view model for a row in the update status model dialog.
   */
  class UpdateStatusModalRowViewModel {
    public row: DataTables.RowMethods;
    public data: webapi.ChecklistTableRow;
    public status = ko.observable<'NONE' | 'WAIT' | 'DONE' | 'FAIL'>('NONE');
    public message = ko.observable<string>('');

    private parent: UpdateStatusModalViewModel;

    constructor(parent: UpdateStatusModalViewModel, row: DataTables.RowMethods) {
      this.parent = parent;
      this.row = row;
      // Need to cast because 'object' type is used.
      this.data = <webapi.ChecklistTableRow> row.data();
    }

    public async update() {
      let pkg: webapi.Pkg<webapi.ChecklistStatusDetails>;
      try {
        this.status('WAIT');
        pkg = await $.ajax({
          url: `/checklists/${this.data.id}/statuses/${this.parent.subject().name}`,
          method: 'PUT',
          dataType: 'json',
          contentType: 'application/json',
          data: JSON.stringify({
            data: {
              value: this.parent.value(),
              comment: this.parent.comment(),
            },
          }),
        });
      } catch (xhr) {
        pkg = xhr.responseJSON;
        let message = `Unknown error updating checklist status`;
        if (pkg && pkg.error && pkg.error.message) {
          message = pkg.error.message;
        }
        this.message(message);
        this.status('FAIL');
        return;
      }

      // Update the local checklist status data
      for (let idx = 0; idx < this.data.statuses.length; idx += 1) {
        if (this.data.statuses[idx].subjectName === pkg.data.subjectName) {
          this.data.statuses[idx] = pkg.data;
          this.row.invalidate();
          break;
        }
      }

      this.message('Success');
      this.status('DONE');
    }
  }

  function isCustomSubject(subject: webapi.ChecklistSubject): boolean {
    return Boolean(subject.name.match(/C\w{8}/));
  }

  const vm = new ChecklistsTableViewModel();
  ko.applyBindings(vm);

  $('#checklists-message')
    .html(`<div class="alert alert-info">
        <span>Loading Checklists...</span>
      </div>
    `)
    .removeClass('hidden');

  let pkg: webapi.Pkg<webapi.ChecklistTableRow[]>;

  try {
    pkg = await $.ajax({
      dataType: 'json',
    });
  } catch (xhr) {
    pkg = xhr.responseJSON;
    let message = 'Unknown error loading checklists';
    if (pkg && pkg.error && pkg.error.message) {
      message = pkg.error.message;
    }
    $('#checklists-message')
      .html(`<div class="alert alert-danger">
        <span>Error Loading Checklists: ${message}</span>
      </div>
    `).removeClass('hidden');
    return;
  }

  let checklists = pkg.data;

  let customSubjects: string[] = [];
  let standardSubjects: string[] = [];

  for (let checklist of checklists) {
    for (let subject of checklist.subjects) {
      if (!isCustomSubject(subject)) {
        if (standardSubjects.indexOf(subject.name) === -1) {
          // TODO: Do these need to be sorted!
          standardSubjects.push(subject.name);
        }
      } else {
        if (customSubjects.indexOf(subject.name) === -1) {
          customSubjects.push(subject.name);
        }
      }
    }
  }

  const checklistTableColumns: ColumnSettings[] = [
    {
      title: '',
      data: <any> null,
      render: (row: ChecklistTableRow): string => {
        return `<input type="checkbox" class="row-select-box" ${row.selected ? 'checked="checked"' : ''}/>`;
      },
      searching: false,
    }, {
      title: 'Name',
      data: <any> null,
      render: (row: ChecklistTableRow): string => {
        switch (row.targetType.toUpperCase()) {
        case 'SLOT':
          return `<a href="/slots/${row.targetId}" target="_blank">${row.targetName}</a>`;
        case 'DEVICE':
          return `<a href="/devices/${row.targetId}" target="_blank">${row.targetName}</a>`;
        case 'GROUP':
          return `<a href="/groups/slot/${row.targetId}" target="_blank">${row.targetName}</a>`;
        default:
          return String(row.targetName || row.targetId);
        }
      },
      searching: true,
    }, {
      title: 'Description',
      data: <any> null,
      render: (row: ChecklistTableRow): string => {
        return String(row.targetDesc || '');
      },
      searching: true,
    },
  ];

  for (let subjectName of standardSubjects) {
    checklistTableColumns.push({
      title: subjectName,
      data: <any> null,
      render: (row: ChecklistTableRow) => {
        let found = false;
        for (let subject of row.subjects) {
          if (subject.name === subjectName) {
            if (!subject.mandatory && !subject.required) {
              return 'N/A';
            }
            found = true;
            break;
          }
        }
        if (!found) {
          return '-';
        }
        let statusValue = 'N';
        for (let status of row.statuses) {
          if (status.subjectName === subjectName) {
            statusValue = status.value;
            break;
          }
        }
        return `<span class="${statusValue === 'N' ? 'bg-danger' : 'bg-success'}">
                  <strong>${statusValue}</strong>
                </span>`;
      },
      orderable: false,
      searchable: false,
    });
  }

  if (customSubjects.length > 0) {
    checklistTableColumns.push({
      title: 'Custom',
      data: <any> null,
      render: (row: webapi.ChecklistTableRow) => {
        let html = '';
        for (let subject of row.subjects) {
          if (isCustomSubject(subject)) {
            for (let status of row.statuses) {
              if (status.subjectName === subject.name) {
                html += `<div>${subject.name}:
                  <span class="${status.value === 'N' ? 'bg-danger' : 'bg-success'}">
                    <strong>${status.value}</strong>
                  </span></div>`;
                break;
              }
            }
          }
        }
        if (html === '') {
          html = '-';
        }
        return html;
      },
      orderable: false,
      searchable: false,
    });
  }

  checklistTableColumns.push({
    title: 'Approved',
    data: <any> null,
    render: (row: webapi.Checklist) => {
       return 'No';
    },
  });

  let checklistTable = $('#checklists-table').DataTable({
    data: checklists,
    // ajax: {
    //   url: '/checklists',
    //   data: { type: targetType },
    //   dataType: 'json',
    //   dataSrc: 'data',
    // },
    dom: '<"row"<"col-sm-8"l><"col-sm-4"B>>rtip',
    autoWidth: false,
    processing: true,
    pageLength: 25,
    lengthMenu: [
      [10, 25, 50, 100, -1],
      [10, 25, 50, 100, 'All'],
    ],
    language: {
      loadingRecords: 'Loading Checklists...',
    },
    deferRender: true,
    columns: checklistTableColumns,
    order: [
      [0, 'asc'],
    ],
  });

  DataTablesUtil.addFilterHead('#checklists-table', checklistTableColumns);

  $('#checklists-table').removeClass('hidden');

  $('#checklists-message').addClass('hidden');

  $('#checklists-table').on('click', '.row-select-box', WebUtil.wrapCatchAll1((event) => {
    let selectbox = $(event.target);
    if (selectbox.is(':checked')) {
      let tr = selectbox.parents('tr').first();
      tr.addClass('selected active');
      let row = checklistTable.row(tr.get(0));
      vm.selectRow(row);
    } else {
      let tr = selectbox.parents('tr').first();
      tr.removeClass('selected active');
      let row = checklistTable.row(tr.get(0));
      vm.deselectRow(row);
    }
  }));

}));
