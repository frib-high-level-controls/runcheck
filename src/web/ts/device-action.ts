/*global deviceDetailsTemplate: false, Typeahead: false*/

/// <reference path="../../app/webapi.d.ts" />

/**
 * render page
 */
// function dataRender() {
//     var idx, roles = { owner:false };
//     if (device) {
//       if (Array.isArray(device.owner)) {
//         for (idx=0; idx<device.owner.length; idx+=1) {
//           if ((session.userid === device.owner[idx]) || session.roles[device.owner[idx]]) {
//             roles.owner = true;
//             break;
//           }
//         }
//       } else if ((session.userid === device.owner) || session.roles[device.owner]) {
//           roles.owner = true;
//       }
//     }

//     if (device.checklist) {
//       $('#device-checklist-panel').removeClass('hidden')
//       ChecklistHelper().render('#device-checklist', device.checklist);
//     }

//     //var role = 'AM';
//     //var status = $('#dStatus').attr('name');
//     disableButton(device.status, roles); // TODO: get the role
//   }


  /**
   * disable buttons by status and role
   * @param status
   * @param role DO: device owner AM: area manger
   */
  // function disableButton(status, roles) {
  //   //role = 'AM'; //TODO: confirm all the roles, and disable buttons by role.

  //   //session.userid

  //   console.log(roles);

  //   if (status === 0) {
  //     if (roles.owner) {
  //       $('#device-assign-checklist').removeClass('hidden').removeAttr('disabled');
  //       $('#device-request-install').removeClass('hidden').removeAttr('disabled');
  //     } else {
  //       $('#device-assign-checklist').removeClass('hidden').attr('disabled', 'disabled');
  //       $('#device-request-install').removeClass('hidden').attr('disabled', 'disabled');
  //     }
  //   }


  //   // $('#preInstall').removeAttr('disabled');
  //   // $('#approve-install').removeAttr('disabled');
  //   // $('#reject-install').removeAttr('disabled');
  //   // $('#install').removeAttr('disabled');
  //   // $('#set-not-installed').removeAttr('disabled');
  //   // if (role === 'AM') {
  //   //   if (status == '0') {
  //   //     $('#approve-install').attr('disabled', 'disabled');
  //   //     $('#reject-install').attr('disabled', 'disabled');
  //   //     $('#install').attr('disabled', 'disabled');
  //   //     $('#set-not-installed').attr('disabled', 'disabled');
  //   //   }
  //   //   if (status == '1') {
  //   //     $('#preInstall').attr('disabled', 'disabled');
  //   //     $('#install').attr('disabled', 'disabled');
  //   //   }
  //   //   if (status == '1.5') {
  //   //     $('#preInstall').attr('disabled', 'disabled');
  //   //     $('#install').attr('disabled', 'disabled');
  //   //   }
  //   //   if (status == '2') {
  //   //     $('#preInstall').attr('disabled', 'disabled');
  //   //     $('#approve-install').attr('disabled', 'disabled');
  //   //     $('#reject-install').attr('disabled', 'disabled');
  //   //   }
  //   //   if (status == '3') {
  //   //     $('#preInstall').attr('disabled', 'disabled');
  //   //     $('#approve-install').attr('disabled', 'disabled');
  //   //     $('#reject-install').attr('disabled', 'disabled');
  //   //     $('#install').attr('disabled', 'disabled');
  //   //   }
  //   // }
  // }


  /**
   * call ajax to change device status
   * @param url
   */
  // function setInstallTo(url, targetId) {
  //   $.ajax({
  //     url: url,
  //     type: 'PUT',
  //     contentType: 'application/json',
  //     data: JSON.stringify({
  //       targetId: targetId
  //     })
  //   }).done(function (data) {
  //     $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Install-to was set to ' + data.serialNo || data.name + '</div>');
  //     $('#device-details').html(deviceDetailsTemplate({device: data}));
  //     $('#prepare-panel input.form-control').val('');
  //     $('#prepare-panel').addClass('hidden');
  //     History.prependHistory(data.__updates);
  //     disableButton(data.status);
  //   }).fail(function (jqXHR) {
  //     $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
  //   });
  // }
  
  // function setNotInstalled() {
  //   var url =  window.location.pathname + '/';
  //   if ($('#dInstallToDevice a').length) {
  //     url += 'install-to-device/' + $('#dInstallToDevice a').prop('href').split('/').pop();
  //   } else if ($('#dInstallToSlot a').length) {
  //     url += 'install-to-slot/' + $('#dInstallToSlot a').prop('href').split('/').pop();
  //   } else {
  //     $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>The device is now not installed. </div>');
  //     return;
  //   }
  
  //   $.ajax({
  //     url: url,
  //     type: 'DELETE'
  //   }).done(function (data) {
  //     $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>The device is set to be not installed.</div>');
  //     $('#device-details').html(deviceDetailsTemplate({device: data}));
  //     $('#prepare-panel').removeClass('hidden');
  //     History.prependHistory(data.__updates);
  //     disableButton(data.status)
  //   }).fail(function (jqXHR) {
  //     $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
  //   });
  // }
  
  // function setStatus(status) {
  //   var url =  window.location.pathname + '/';
  //   if ($('#dInstallToDevice a').length) {
  //     url += 'install-to-device/' + $('#dInstallToDevice a').prop('href').split('/').pop();
  //   } else if ($('#dInstallToSlot a').length) {
  //     url += 'install-to-slot/' + $('#dInstallToSlot a').prop('href').split('/').pop();
  //   } else {
  //     $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>The device is now not installed. </div>');
  //     return;
  //   }
  //   url += '/status';
  
  //   $.ajax({
  //     url: url,
  //     type: 'PUT',
  //     contentType: 'application/json',
  //     data: JSON.stringify({
  //       status: status
  //     })
  //   }).done(function (data) {
  //     $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>The install-to status was set to ' + status + '.</div>');
  //     $('#device-details').html(deviceDetailsTemplate({device: data}));
  //     $('#prepare-panel').removeClass('hidden');
  //     History.prependHistory(data.__updates);
  //     disableButton(data.status)
  //   }).fail(function (jqXHR) {
  //     $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
  //   });
  // }
  




let device: webapi.Device | undefined;

$(() => {

  function assignChecklist() {
    if (!device) {
      return;
    }
    $.ajax({
      url: '/devices/' + device.id + '/checklistId',
      dataType: 'json',
      type: 'PUT',
      //contentType: 'application/json',
      //data: JSON.stringify({})
    }).done(function (data: webapi.Data<string>) {
      $('#device-checklist-panel').removeClass('hidden');
      ChecklistUtil.render('#device-checklist-panel', data.data);
    }).fail(function (err) {
      $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + err.responseText + '</div>');
    });
  };

  if (!device) {
    return;
  }

  if (device.checklistId) {
    $('#device-checklist-panel').removeClass('hidden');
    ChecklistUtil.render('#device-checklist-panel', device.checklistId);
  }

  const dept = 'GRP:' + device.dept + '#LEADER';

  const perm = {
    assign: false,
  };

  if (AuthUtil.hasAnyRole(['SYS:RUNCHECK', dept])) {
    perm.assign = true;
  }

  // function dataRender() {
  //   var idx, roles = { owner:false };
  //   if (device) {
  //     if (Array.isArray(device.owner)) {
  //       for (idx = 0; idx < device.owner.length; idx += 1) {
  //         if ((session.userid === device.owner[idx]) || session.roles[device.owner[idx]]) {
  //           roles.owner = true;
  //           break;
  //         }
  //       }
  //     } else if ((session.userid === device.owner) || session.roles[device.owner]) {
  //         roles.owner = true;
  //     }
  //   }

  //   if (device.checklist) {
  //     $('#device-checklist-panel').removeClass('hidden')
  //     ChecklistHelper().render('#device-checklist', device.checklist);
  //   }

  //   //var role = 'AM';
  //   //var status = $('#dStatus').attr('name');
  //   disableButton(device.status, roles); // TODO: get the role
  // };


  // dataRender();


  if (!device.checklistId) {
    if (perm.assign) {
      $('#device-assign-checklist').removeClass('hidden').removeAttr('disabled');
    } else {
      $('#device-assign-checklist').removeClass('hidden').attr('disabled', 'disabled');
    }
  }

  //  else {
  //   $('#device-assign-checklist').removeClass('hidden').attr('disabled', 'disabled');
  //   $('#device-request-install').removeClass('hidden').attr('disabled', 'disabled');
  // }



  // var selected = null;

    // $('#device-request-slot-install-form input').typeahead({
    //   minLength: 1,
    //   highlight: true,
    //   hint: true
    // }, {
    //   name: 'slotList',
    //   display: 'name',
    //   limit: 20,
    //   source: Typeahead.slotList
    // });

    // $('#device-request-device-install-form input').typeahead({
    //   minLength: 1,
    //   highlight: true,
    //   hint: true
    // }, {
    //   name: 'deviceList',
    //   display: 'serialNo',
    //   limit: 20,
    //   source: Typeahead.deviceList
    // });

    // $('#device-request-slot-install-form').submit(function (ev) {
    //   ev.preventDefault();
    //   console.log('Submit request slot install');
    // });

    // $('#device-request-device-install-form').submit(function (ev) {
    //   ev.preventDefault();
    //   console.log('Submit request device install');
    // });

    // // $('#prepare-panel input').bind('typeahead:select', function (ev, suggestion) {
    // //   selected = suggestion;
    // // });

    // // $('.prepare-install').click(function () {
    // //   if ($(this).text() === 'slot') {
    // //     $('#prepare-title').text('Please type and select a slot name');
    // //     $('.slot').removeClass('hidden');
    // //     $('.device').addClass('hidden');
    // //     selected = null;
    // //   } else {
    // //     $('#prepare-title').text('Please type and select a device number');
    // //     $('.device').removeClass('hidden');
    // //     $('.slot').addClass('hidden');
    // //     selected = null;
    // //   }
    // // });
    // $('#device-request-slot-install').click(function (ev) {
    //     ev.preventDefault();
    //     $('#device-install-panel').removeClass('hidden');
    //     $('#device-request-slot-install-form').removeClass('hidden');
    //     $('#device-request-install').addClass('hidden');
    //     $('#device-request-slot-install-cancel').removeClass('hidden');
    // });

    // $('#device-request-slot-install-cancel').click(function (ev) {
    //   ev.preventDefault();
    //   $('#device-install-panel').addClass('hidden');
    //   $('#device-request-slot-install-form').addClass('hidden');
    //   $('#device-request-install').removeClass('hidden');
    //   $('#device-request-slot-install-cancel').addClass('hidden');
    // });

    // $('#device-request-device-install').click(function (ev) {
    //     ev.preventDefault();
    //     $('#device-install-panel').removeClass('hidden');
    //     $('#device-request-device-install-form').removeClass('hidden');
    //     $('#device-request-install').addClass('hidden');
    //     $('#device-request-device-install-cancel').removeClass('hidden');
    // });

    // $('#device-request-device-install-cancel').click(function (ev) {
    //   ev.preventDefault();
    //   $('#device-install-panel').addClass('hidden');
    //   $('#device-request-device-install-form').addClass('hidden');
    //   $('#device-request-install').removeClass('hidden');
    //   $('#device-request-device-install-cancel').addClass('hidden');
    // });


    // // $('#prepare-panel button[type="submit"]').click(function (e) {
    // //   e.preventDefault();
    // //   if (!selected || !selected._id) {
    // //     $('#prepare-title').text('Must select from suggestions');
    // //     return;
    // //   }
    // //   var id = selected._id;
    // //   var url = window.location.pathname + '/' + 'install-to-' + $(this).val();
    // //   setInstallTo(url, id);
    // // });


  $('#device-assign-checklist').click((evt) => {
    evt.preventDefault();
    $('#device-assign-checklist').addClass('hidden');
    $('#device-checklist-spin').removeClass('hidden');
    assignChecklist();
    //console.log("Assign Checklist")
  });

    // $('#reject-install').click(function (e) {
    //   e.preventDefault();
    //   setStatus(0);
    // });


    // $('#set-not-installed').click(function (e) {
    //   e.preventDefault();
    //   setNotInstalled();
    // });

    // $('#approve-install').click(function (e) {
    //   e.preventDefault();
    //   setStatus(2);
    // });

    // $('#install').click(function (e) {
    //   e.preventDefault();
    //   setStatus(3);
    // });

    // // $('#prepare-panel button[type="reset"]').click(function () {
    // //   $('#prepare-panel .slot,.device').addClass('hidden');
    // //   $('#prepare-title').text('');
    // // });

});