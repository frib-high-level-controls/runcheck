/**
 * Support user interaction on Device details view.
 */

// let slot: webapi.Slot;

$(() => {

  let slot: webapi.Slot = (<any> window).slot;

  // Used to populate device selection for installation
  let devices: Array<{ id: string, text: string, disabled?: boolean }> | undefined;


  // function showMessage(msg: string) {
  //   $('#message').append(`
  //     <div class="alert alert-danger">
  //       <button class="close" data-dismiss="alert">x</button>
  //       <span>${msg}</span>
  //     </div>
  //   `);
  // }

  async function installationRender(selector: string, deviceId: string) {
    WebUtil.catchAll(async () => {
      $(selector).html(`
        <div class="text-center" style="font-size:24px;">
          <span class="fa fa-spinner fa-spin"/>
        </div>
      `).removeClass('hidden');

      let pkg: webapi.Pkg<webapi.Device>;
      try {
        pkg = await $.get({
          url: `/devices/${deviceId}`,
          dataType: 'json',
        });
      } catch (xhr) {
        pkg = xhr.responseJSON;
        let message = 'Unknown error retrieving device';
        if (pkg && pkg.error && pkg.error.message) {
          message = pkg.error.message;
        }
        $(selector).html(`
          <div>
            <span class="text-danger">${message}</span>
          </div>
        `).removeClass('hidden');
        return;
      }

      let details = deviceDetailsTemplate({
        device: pkg.data,
        embedded: true,
      });

      $('#install-panel').html(details).removeClass('hidden');
    });
  }

  $('#checklist-assign').click(WebUtil.wrapCatchAll1(async (evt) => {
    evt.preventDefault();
    $('#checklist-assign').addClass('hidden');
    $('#checklist-spin').removeClass('hidden');

    let pkg: webapi.Pkg<string>;
    try {
      pkg = await $.ajax({
        url: `/slots/${slot.id}/checklistId`,
        method: 'PUT',
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

    slot.checklistId = pkg.data;
    $('#checklist-spin').addClass('hidden');
    $('#checklist-panel').removeClass('hidden');
    ChecklistUtil.render('#checklist-panel', slot.checklistId);
  }));


  $('#install').click(WebUtil.wrapCatchAll1(async (evt) => {
    evt.preventDefault();
    $('#install').addClass('hidden');
    $('#install-spin').removeClass('hidden');

    if (!devices) {
      let pkg: webapi.Pkg<webapi.DeviceTableRow[]>;
      try {
        pkg = await $.get({
          url: '/devices',
          data: { deviceType: slot.deviceType },
          dataType: 'json',
        });
      } catch (xhr) {
        pkg = xhr.responseJSON;
        let message = 'Unknown error retrieving devices';
        if (pkg && pkg.error && pkg.error.message) {
          message = pkg.error.message;
        }
        $('#install-form').prepend(`
          <div class="alert alert-danger">
            <button class="close" data-dismiss="alert">x</button>
            <span>${message}</span>
          </div>
        `);
      }

      devices = [];
      if (pkg && Array.isArray(pkg.data)) {
        for (let device of pkg.data) {
          let text = `${device.name} (${device.desc})`;
          if (text.length > 48) {
            text = `${text.substr(0, 48)}...`;
          }
          devices.push({
            id: device.id,
            text: text,
            disabled: Boolean(device.installSlotName),
          });
        }
      }

      $('#install-name').select2({
        data: devices,
      });

      $('#install-date').datepicker({
        todayBtn: true,
        todayHighlight: true,
      }).datepicker('update', new Date());
    }

    $('#install-spin').addClass('hidden');
    $('#install-form').removeClass('hidden');
  }));

  $('#install-save').click(WebUtil.wrapCatchAll1(async (evt) => {
    evt.preventDefault();

    $('install-form').attr('disabled', 'disabled');
    let installDeviceId = $('#install-name').find(':selected').val();
    let installDeviceOn: Date | null = $('#install-date').datepicker('getUTCDate');
 
    let pkg: webapi.Pkg<webapi.SlotInstall>;
    try {
      pkg = await $.ajax({
        url: `/slots/${slot.id}/installation`,
        method: 'PUT',
        dataType: 'json',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(<webapi.Pkg<webapi.SlotInstall>> {
          data: {
            installDeviceId: installDeviceId ? String(installDeviceId) : undefined,
            installDeviceOn: installDeviceOn ? installDeviceOn.toISOString().split('T')[0] : undefined,
          },
        }),
      });
      if (!pkg.data.installDeviceId) {
        throw new Error('Invalid Device ID');
      }
    } catch (xhr) {
      pkg = xhr.responseJSON;
      let message = 'Unknown error installing device';
      if (pkg && pkg.error && pkg.error.message) {
        message = pkg.error.message;
      }
      $('#install-form').prepend(`
        <div class="alert alert-danger">
          <button class="close" data-dismiss="alert">x</button>
          <span>${message}</span>
        </div>
      `).removeAttr('disabled');
      return;
    }

    slot.installDeviceId = pkg.data.installDeviceId;
    slot.installDeviceId = pkg.data.installDeviceOn;
    slot.installDeviceBy = pkg.data.installDeviceBy;
    $('#install-form').addClass('hidden');
    installationRender('#install-panel', pkg.data.installDeviceId);
  }));

  $('#install-cancel').click(WebUtil.wrapCatchAll1(async (evt) => {
    evt.preventDefault();
    $('#install').removeClass('hidden');
    $('#install-form').addClass('hidden');
  }));


  if (slot.installDeviceId) {
    // $('#uninstall').removeClass('hidden');
    installationRender('#install-panel', slot.installDeviceId);
  } else {
    $('#install-panel').html(`
      <div>
        <span>No device installed</span>
      </div>
    `).removeClass('hidden');
    if (slot.canInstall) {
      $('#install').removeClass('hidden').removeAttr('disabled');
    } else {
      $('#install').removeClass('hidden').attr('disabled', 'disabled');
    }
  }

  if (slot.groupId) {
    $('#checklist-panel').removeClass('hidden').html(`
      <div>
        <h4>
          See the associated
          <a href="/groups/slot/${slot.groupId}" target="_blank">Group</a>
        </h4>
      </div>
    `);
  } else if (slot.checklistId) {
    // if (slot.permissions.assign) {
    //   $('#checklist-unassign').removeClass('hidden').removeAttr('disabled');
    // } else {
    //   $('#checklist-unassign').removeClass('hidden').attr('disabled', 'disabled');
    // }
    ChecklistUtil.render('#checklist-panel', slot.checklistId);
  } else {
    $('#checklist-panel').html(`
      <div>
        <span>No checklist assigned</span>
      </div>
    `).removeClass('hidden');
    if (slot.canAssign) {
      $('#checklist-assign').removeClass('hidden').removeAttr('disabled');
    } else {
      $('#checklist-assign').removeClass('hidden').attr('disabled', 'disabled');
    }
  }
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
