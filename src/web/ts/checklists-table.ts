/**
 * Checklists table view
 */


$(WebUtil.wrapCatchAll0(async () => {

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
  //let hasCustomSubjects = false;


  for (let checklist of checklists) {
    for (let subject of checklist.subjects) {
      // if (!subject.checklistId) {  // Is it custom?
        //console.log('Its a standard subject %s', subject.subject);
        if (standardSubjects.indexOf(subject.name) === -1) {
          // TODO: ORDER!
          standardSubjects.push(subject.name);
        }
      // } else {
      //  hasCustomSubjects = true;
      //}
    }
  }


  //let targetType = String((<any> window).checklistTargetType);




  const checklistColumns: ColumnSettings[] = [
    {
      title: '',
      data: <any> null,
      render: (row: webapi.ChecklistTableRow): string => {
        //return `<a href="/devices/${row.id}">${row.name}</a>`;
        return '<input type="checkbox"/>';
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
    // {
    //   title: 'EE',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '<span class="bg-success"><strong>Y</strong></span>';
    //   },
    // },
    // {
    //   title: 'ME',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '<span class="bg-success"><strong>Y</strong></span>';
    //   },
    // },
    // {
    //   title: 'PHYS',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '<span class="bg-success"><strong>Y</strong></span>';
    //   },
    // },
    // {
    //   title: 'CTRLS',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '<span class="bg-success"><strong>Y</strong></span>';
    //   },
    // },
    // {
    //   title: 'ESHQ',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '<span class="bg-success"><strong>Y</strong></span>';
    //   },
    // },
    // {
    //   title: 'DO',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '<span class="bg-danger"><strong>N</strong></span>';
    //   },
    // },
    // {
    //   title: 'AM',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '-';
    //   },
    // },

    // {
    //   title: 'Custom',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return `
    //       <div>Custom1:<span class="bg-success">Y</span></div>
    //       <div>Custom2:<span class="bg-danger">N</span></div>
    //     `;
    //   },
    // },


    // {
    //   title: 'C1',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '-';
    //   },
    // },
    // {
    //   title: 'C2',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '-';
    //   },
    // },

    // {
    //   title: 'C3',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '-';
    //   },
    // },

    // {
    //   title: 'C4',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '-';
    //   },
    // },

    // {
    //   title: 'C5',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '-';
    //   },
    // },

    // {
    //   title: 'C6',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '-';
    //   },
    // },

    // {
    //   title: 'C7',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '-';
    //   },
    // },

    // {
    //   title: 'C8',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '-';
    //   },
    // },

    
    // {
    //   title: 'C9',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '-';
    //   },
    // },

    // {
    //   title: 'C10',
    //   orderable: false,
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return '-';
    //   },
    // },


    // {
    //   title: 'Status',
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //     return `
    //       <span class="bg-success">EE:<strong>Y</strong></span>,
    //       ME:<span class="bg-success"><strong>Y</strong></span>,
    //       CRYO:<span class="text-success"><strong>Y</strong></span>,
    //       PHYS:<span class="text-success" data-toggle="popover" title="Comment" data-content="This is a comment">YC</span>,
    //       CTRLS:<span class="text-success">Y</span>
    //       ESHQ:<span class="text-danger">N</span>
    //       <span class="bg-danger">DO:N</span>        
    //     `;
    //   },
    //   searching: true,
    // },
    
    // {
    //   title: 'Approved',
    //   data: <any> null,
    //   render: (row: webapi.Checklist) => {
    //      return 'No';
    //   },
    // },
    // {
    //   title: 'Type',
    //   data: <any> null,
    //   render: (row: webapi.DeviceTableRow): string => {
    //     return String(row.deviceType);
    //   },
    //   searching: true,
    // }, {
    //   title: 'Department',
    //   data: <any> null,
    //   render: (row: webapi.DeviceTableRow): string => {
    //     return String(row.dept);
    //   },
    //   searching: true,
    // }, {
    //   title: 'Installation Slot',
    //   data: <any> null,
    //   render: (row: webapi.DeviceTableRow): string => {
    //     if (!row.installSlotName) {
    //       return '-';
    //     }
    //     return `<a href="/slots/${row.installSlotName}" target="_blank">${row.installSlotName}</a>`;
    //   },
    //   searching: true,
    // }, {
    //   title: 'Checklist',
    //   //order: true,
    //   type: 'numeric',
    //   //autoWidth: false,
    //   width: '105px',
    //   data: (row: webapi.DeviceTableRow): string => {
    //     // return Table.progressBar(source.checkedValue, source.totalValue);
    //     return 'N/A';
    //   },
    // },
  ];

  console.log(standardSubjects.length);
  for (let subjectName of standardSubjects) {
    checklistColumns.push({
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

  // if (hasCustomSubjects) {
  //   checklistColumns.push({
  //     title: 'Custom',
  //     data: <any> null,
  //     render: (row: webapi.Checklist) => {
  //       let html = '';
  //       for (let subject of row.subjects) {
  //         if (!subject.checklistId) {
  //           for (let status of row.statuses) {
  //             if (status.subjectName === subject.name) {
  //               html += `<div>${subject.name}:
  //                 <span class="${status.value === 'Y' ? 'bg-success' : 'bg-danger'}">
  //                   <strong>${status.value}</strong>
  //                 </span></div>`;
  //               break;
  //             }
  //           }
  //         }
  //       }
  //       if (html === '') {
  //         html = '-';
  //       }
  //       return html;
  //     },
  //     orderable: false,
  //     searchable: false,
  //   });
  // }


  checklistColumns.push({
    title: 'Approved',
    data: <any> null,
    render: (row: webapi.Checklist) => {
       return 'No';
    },
  });


  $('#checklists-table').DataTable({
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
    columns: checklistColumns,
    order: [
      [0, 'asc'],
    ],
  });

  DataTablesUtil.addFilterHead('#checklists-table', checklistColumns);
  //Table.filterEvent();
  //Table.selectEvent();

  $('#checklists-table').removeClass('hidden');
  $('#checklists-message').addClass('hidden');
}));
