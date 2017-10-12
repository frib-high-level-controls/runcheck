/**
 * Support user interaction on Device details view.
 */

let slot: webapi.Slot;

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
  if (!slot) {
    showMessage('Device not initialized');
    return;
  }

  if (slot.checklistId) {
    // TODO: Show 'unassign' button if permitted.
    $('#checklist-panel').removeClass('hidden');
    ChecklistUtil.render('#checklist-panel', slot.checklistId);
  }

  // else {
  //   if (perms.assign) {
  //     $('#device-assign-checklist').removeClass('hidden').removeAttr('disabled');
  //   } else {
  //     $('#device-assign-checklist').removeClass('hidden').attr('disabled', 'disabled');
  //   }
  // }

});

// add group functions start
// var passData;
// var selectGroupId;
// $('#addGroup').click(function (e) {
//   e.preventDefault();
//   var sLabel = 'Add slots to slot group';
//   var sError = 'Error: group conflict! All slots have been in other groups.';
//   var sWarning = 'Warning: group conflict! the following slots have been in other groups.';
//   var sSuccess = 'Success: All slots can be added.';
//   var sField = 'Validaton failed: ';
//   if ($('.row-selected').length == 0) {
//     $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Please select at least one slot.</div>');
//     return;
//   }
//   var slotIds = [];
//   $('.row-selected').each(function() {
//     var href = $(this).closest('tr').children().eq(1).children().attr('href');
//     slotIds.push(href.split('/')[2]);
//   });

//   $.ajax({
//     url: '/slotGroups/validateAdd',
//     type: 'POST',
//     contentType: 'application/json',
//     dataType: 'json',
//     data: JSON.stringify({
//       slotIds: slotIds
//     })
//   }).done(function (data) {
//     $('#modalLabel').html(sLabel);
//     // panel and footer
//     passData = data.passData;
//     var panelClass;
//     var panel;
//     var heading;
//     var body = '';
//     if(data.passData.length === 0) {
//       panelClass = 'panel-danger';
//       heading = '<div class="panel-heading">' + sError + '</div>';
//     }else if(data.conflictDataName.length > 0) {
//       panelClass = 'panel-warning';
//       heading = '<div class="panel-heading">' + sWarning + '</div>';
//     }else {
//       panelClass = 'panel-success';
//       heading = '<div class="panel-heading">' + sSuccess + '</div>';
//     }
//     data.conflictDataName.forEach(function(x){
//       body = body + '<div class="panel-body">' + x.slot + ' in ' + x.conflictGroup + ' group.</div>'
//     });
//     panel = heading + body;
//     var footer = '<button data-dismiss="modal" aria-hidden="true" class="btn" id="modal-cancel">Cancel</button>';
//     $('.modal-body .panel').addClass(panelClass);
//     $('.modal-body .panel').html(panel);
//     $('#modal .modal-footer').html(footer);
//   }).fail(function (jqXHR) {
//     $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + sField + jqXHR.responseText +  '</div>');
//   });

//   // select option
//   $.ajax({
//     url: '/slotGroups/json',
//     type: 'GET',
//     dataType: 'json'
//   }).done(function (data) {
//     var option = '<option>...</option>';
//     data.forEach(function(d) {
//       option = option + '<option name="' +d._id + '">' + d.name + '</option>';
//     });
//     $('.modal-body select').html(option);
//     $('#modal').modal('show');
//   }).fail(function (jqXHR) {
//     $('#modal').modal('hide');
//     reset();
//     $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button> Get slot groups failed ' + jqXHR.responseText +  '</div>');
//   });
// });

// // not show submit button until group selected in add group functon
// $('.modal-body').on('change', 'select', function() {
//   selectGroupId = $('option:selected').attr('name');
//   if (passData.length !== 0) {
//     var footer = '<button id="modal-submit" class="btn btn-primary" data-dismiss="modal">Confirm</button>' +
//       '<button data-dismiss="modal" aria-hidden="true" class="btn" id="modal-cancel">Cancel</button>';
//     $('#modal .modal-footer').html(footer);
//   }
// });

// $('#modal').on('click','#modal-cancel',function (e) {
//   e.preventDefault();
//   reset();
// });

// $('#modal').on('click','#modal-submit',function (e) {
//   e.preventDefault();
//   $.ajax({
//     url: '/slotGroups/' + selectGroupId + '/addSlots',
//     type: 'POST',
//     contentType: 'application/json',
//     data: JSON.stringify({
//       passData: passData
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
//     $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
//   }).always(function () {
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
//   $('.row-selected input').prop('checked', false);
//   $('.row-selected').removeClass('row-selected');
//   passData = null;
//   selectGroupId = null;
// }
// // add group functions end
