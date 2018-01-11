/**
 * Support user interaction on Slot Group details view.
 */

let group: webapi.Group | undefined;

$(() => {

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

  const slotColumns: datatablesutil.ColumnSettings[] = [
    {
      title: 'Name',
      data: <any> null,
      render: (row: webapi.Slot): string => {
        return `<a href="/slots/${row.name}">${row.name}</a>`;
      },
      searching: true,
    }, {
      title: 'Type',
      data: <any> null,
      render: (row: webapi.Slot): string => {
        return row.deviceType || 'Unknown';
      },
      searching: true,
    }, {
      title: 'Area',
      data: <any> null, // 'area',
      render: (row: webapi.Slot) => {
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
      render: (row: webapi.Slot): string => {
        return row.careLevel || 'Unknown';
      },
      searching: true,
    }, {
      title: 'DRR',
      data: <any> null,
      render: (row: webapi.Slot): string => {
        return row.drr || 'Unknown';
      },
      searching: true,
    }, {
      title: 'ARR',
      data: <any> null,
      render: (row: webapi.Slot): string => {
        return row.arr || 'Unknown';
      },
      searching: true,
    },
  ];

  $('#slot-table').DataTable({
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

  //add group functions start
  //let passData: webapi.SlotTableRow[];
  let selectedSlot: {id: string | undefined} = {id: undefined};
  let d: webapi.SlotTableRow;
  $('#addGroup').click(WebUtil.wrapCatchAll1(async (evt) => {
    evt.preventDefault();
    let groupName = group ? group.name : '';
    let sLabel = 'Add New Slots to ' + groupName;
    let sError = 'Error: All slots are in other groups.';
    //var sWarning = 'Warning: group conflict! the following slots have been in other groups.';
    let sSuccess = 'Select Slot to Add';
    //let sField = 'Validaton failed: ';
    let pkg: webapi.Pkg<webapi.SlotTableRow[]>;
    let availableSlots: {id: string, name: string}[] = [];
    
    try {
      pkg = await $.ajax({
        url: '/slots',
        type: 'GET',
        dataType: 'json',
        data: { 'GROUPID': group ? group.id : '' },
      });
    } catch (xhr) {
      return;
    }
      
    $('#modalLabel').html(sLabel);
      // panel and footer
    console.log('data[0].id %s data[0].name %s', pkg.data[0].id, pkg.data[0].name);
    let panelClass;
    let panel;
      if (pkg.data.length === 0) {
        panelClass = 'panel-danger';
        panel = '<div class="panel-heading">' + sError + '</div>';
      }else {
        panelClass = 'panel-success';
        panel = '<div class="panel-heading">' + sSuccess + '</div>';
      }
      $('.modal-body .panel').addClass(panelClass);

      let footer = '<button data-dismiss="modal" aria-hidden="true" class="btn" id="modal-cancel">Cancel</button>';
      $('#modal .modal-footer').html(footer);

      let option = '<option>...</option>';
      if (pkg && Array.isArray(pkg.data)) {
        for (d of pkg.data) {
          availableSlots.push({id: d.id, name: d.name});
          option = option + '<option name="' + d.id + '">' + d.name + '</option>';
        }
      }
      console.log('option %s', option);
      
      $('.modal-body select').html(option);
      $('#modal').modal('show');
      $('.modal-body .panel').html(panel);
  /*
    }).fail(function (jqXHR) {
      $('#modal').modal('hide');
      reset();
      $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + sField + jqXHR.responseText + '</div>');
    });
*/

    //   // select option
    //   $.ajax({
    //     url: '/slotGroups/json',
    //     type: 'GET',
    //     dataType: 'json'
    //   }).done(function (data) {
    //     var option = '<option>...</option>';
    //     data.forEach(function (d) {
    //       option = option + '<option name="' + d._id + '">' + d.name + '</option>';
    //     });
    //     $('.modal-body select').html(option);
    //     $('#modal').modal('show');
    //   }).fail(function (jqXHR) {
    //     $('#modal').modal('hide');
    //     reset();
    //     $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button> Get slot groups failed ' + jqXHR.responseText + '</div>');
    //   });
    // });

    // not show submit button until group selected in add group functon
    $('.modal-body').on('change', 'select', function () {
      selectedSlot.id = $('option:selected').attr('name');
      console.log('selectedslot %s',selectedSlot.id);
      if (selectedSlot.id) {
        var footer = '<button id="modal-submit" class="btn btn-primary" data-dismiss="modal">Confirm</button>' +
          '<button data-dismiss="modal" aria-hidden="true" class="btn" id="modal-cancel">Cancel</button>';
        $('#modal .modal-footer').html(footer);
      }
    });

    $('#modal').on('click', '#modal-cancel', function (e) {
      e.preventDefault();
      reset();
    });

    $('#modal').on('click', '#modal-submit', function (e) {
      e.preventDefault();
      $.ajax({
        url: `/groups/${group ? group.id : ''}/addSlots`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          passData: selectedSlot
        })
      }).done(function (data) {
        if (data.doneMsg.length) {
          $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>' + data.doneMsg + '</div>');
        }
        if (data.errMsg.length) {
          $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + data.errorMsg + '</div>');
        }
      }).fail(function (jqXHR) {
        $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
      }).always(function () {
        reset();
      });
    });

    function reset() {
      $('.modal-body').html('<div class="panel"> ' +
        '<div class="panel-heading"></div> ' +
        '</div>' +
        '<form class="form-inline"> ' +
        '<label>Please select one slot group:</label> ' +
        '<select class="form-control"></select> ' +
        '</form>');
      $('.row-selected input').prop('checked', false);
      $('.row-selected').removeClass('row-selected');
      //passData = null;
      selectedSlot.id = undefined;
    }
    // add group functions end
  }));
});
