/**
 * Checklists table view
 */


$(WebUtil.wrapCatchAll0(async () => {

  // Define the view model





  class UpdateStatusSelectedRow {
    public row: DataTables.RowMethods;
    public name: KnockoutObservable<string>;
    public data: webapi.ChecklistTableRow;
    public status = ko.observable<'NONE' | 'PENDING' | 'DONE' | 'FAIL'>('NONE');

    constructor(row: DataTables.RowMethods) {
      this.row = row;
      // Need to cast from object to actual data type!
      this.data = <webapi.ChecklistTableRow> row.data();
      this.name = ko.observable(this.data.targetName);
      //this.status = ko.observable('NONE');
      console.log("ROW CONST: " + this.data.targetName);
    }

    public async updateStatus() {
      let data = <webapi.ChecklistTableRow> this.row.data();
      console.log('Update Status for Row!!');
      let d;
      try {
        this.status('PENDING');
        d = await $.ajax({
          url: `/checklists/${data.id}/statuses/${statusUpdateVM.updateStatusSubject()}`,
          method: 'PUT',
          dataType: 'json',
          contentType: 'application/json',
          data: JSON.stringify({
            data: {
              value: statusUpdateVM.updateValue(),
              comment: statusUpdateVM.updateComment(),
            },
          }),
        });
      } catch (err) {
        this.status('FAIL');
        console.error(err);
        return;
      }


      this.status('DONE');
      console.log(d);

      for (let idx = 0; idx < data.statuses.length; idx += 1) {
        if (data.statuses[idx].subjectName === d.data.subjectName) {
          data.statuses[idx] = d.data;
          this.row.invalidate();

          console.log($('#checklists-table').find('tr').length);
          console.log($('#checklists-table').find('tr.selected').length);
          console.log($('#checklists-table').find('tr.selected').find('.row-select-box').length);

          $('#checklist-tables').find('tr.selected').find('.row-select-box').prop('checked', true);

          

          break;
        }
      }

      // for (let subject of data.subjects) {
      //   if (subject.name === d.data.subjectName) {

      //   }
      // }

      // this.row.data(d.data);


      console.log('success!');
    }
  }

  class StatusUpdateViewModel {

    public canUpdate: KnockoutObservable<boolean>;

    public requireComment = ko.observable(false);

    public updateComment = ko.observable<string>();

    public updateValue = ko.observable<string>();

    public updateStatusSubject = ko.observable<string>();

    public subjects: KnockoutObservableArray<string>;

    public updateValueOptions = ko.observableArray(['N', 'Y', 'YC']);

    public updateStatusSelectedRows = ko.observableArray<UpdateStatusSelectedRow>();


    //public selected: webapi.ChecklistStatusTableRow[] = [];

    constructor() {
      this.subjects = ko.observableArray();
      this.canUpdate = ko.observable(false);

      this.updateValue.subscribe((v) => {
        this.requireComment(v === 'YC');
      });
    }

    public updateStatus() {
      console.log('UpdateSTATUS!1');
      for (let r of this.updateStatusSelectedRows()) {
      
        r.updateStatus();
      }
      // Open Modal with table, submit each update!
      // for (let row of this.selected) {
      //   await $.ajax({
      //     path: `/checklists/${row.id}/statuses/${this.update}`,
      //     method: 'PUT',
      //   })
      // }
    }
  }

  function isCustomSubject(subject: webapi.ChecklistSubject): boolean {
    return Boolean(subject.name.match(/C\w{8}/));
  }

  const statusUpdateVM = new StatusUpdateViewModel();
  ko.applyBindings(statusUpdateVM);

  $('#checklists-message')
    .html('Loading Checklists...')
    .removeClass('hidden');

  let pkg: webapi.Pkg<webapi.ChecklistTableRow[]>;

  try {
    pkg = await $.ajax({
      dataType: 'json',
    });
  } catch (xhr) {
    return;
  }

  let checklists = pkg.data;

  let standardSubjects: string[] = [];
  let customSubjects: string[] = [];


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


  //let targetType = String((<any> window).checklistTargetType);



  const checklistTableColumns: ColumnSettings[] = [
    {
      title: '',
      data: <any> null,
      render: (row: webapi.ChecklistTableRow): string => {
        //return `<a href="/devices/${row.id}">${row.name}</a>`;
        return '<input type="checkbox" class="row-select-box"/>';
      },
      searching: false,
    }, {
      title: 'Name',
      data: <any> null,
      render: (row: webapi.ChecklistTableRow): string => {
        //return `<a href="/devices/${row.id}">${row.name}</a>`;
        return row.targetName || row.targetId;
      },
      searching: true,
    }, {
      title: 'Description',
      data: <any> null,
      render: (row: webapi.ChecklistTableRow): string => {
        //return String(row.desc ? row.desc : '-');
        return row.targetDesc || '';
      },
      searching: true,
    },
  ];

  for (let subjectName of standardSubjects) {
    checklistTableColumns.push({
      title: subjectName,
      data: <any> null,
      render: (row: webapi.ChecklistTableRow) => {
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
          //console.log('%s =? %s', status.subjectId, subjectName);
          if (status.subjectName === subjectName) {
            statusValue = status.value;
            break;
          }
        }

        return `<span class="${statusValue === 'Y' ? 'bg-success' : 'bg-danger'}">
                  <strong>${statusValue}</strong>
                </span>`;
        //'<span class="bg-success"><strong>Y</strong></span>';
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
                  <span class="${status.value === 'Y' ? 'bg-success' : 'bg-danger'}">
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
    // initComplete: function () {
    //   Holder.run({
    //     images: '.user img'
    //   });
    // },
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
  //Table.filterEvent();
  //Table.selectEvent();

  $('#checklists-table').removeClass('hidden');
  $('#checklists-message').addClass('hidden');



  $('#checklists-table').on('click', '.row-select-box', WebUtil.wrapCatchAll1((event) => {

    $(event.target).parents('tr').first().toggleClass('selected').toggleClass('active');

    let data = checklistTable.rows('.selected');


    console.log(checklistTable.row('.selected'));

    //data.row(1).inva

    let canUpdate = false;
    let subjects: string[] = [];
    let rows: UpdateStatusSelectedRow[] = [];

    


    //for (let idx = 0; idx < data.length; idx += 1) {
    data.every(function (idx) {


      let row = checklistTable.row(idx);
      
      let d = <webapi.ChecklistTableRow & { selected?: boolean }> row.data();

      console.log(d);

      //let row = data.row(idx);

      rows.push(new UpdateStatusSelectedRow(row));

      //let d = <webapi.ChecklistTableRow> row.data();

      console.log('INDEX: %s', idx);
      console.log('NAME: %s', d.targetName);

    //data.each((d: webapi.ChecklistTableRow) => {

      
      for (let subject of d.subjects) {
        // TODO: Check if can Update
        canUpdate = true;
        if (subjects.indexOf(subject.name) === -1) {
          subjects.push(subject.name);
        }
      }
    });

    console.log(rows.length);
    statusUpdateVM.updateStatusSelectedRows(rows);

    statusUpdateVM.canUpdate(canUpdate);
    statusUpdateVM.subjects(subjects);


    // console.log($('#checklists-table').find('tr.selected').length);

    // console.log($('#checklists-table').DataTable().rows('.selected').data().length);

    // console.log(checklistTable.rows('.selected').data().length);

    //$(event.target).parents('tr')

    // let data = table.row($(event.target).parents('tr').get(0)).data();
    // if (Array.isArray(data)) {
    //   console.log(data.length);
    // } else {
    //   console.log('?');
    // }


    console.log('CLICK');
  }));


}));