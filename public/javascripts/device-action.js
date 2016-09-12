/*global deviceDetailsTemplate: false, Typeahead: false*/

/**
 * render page
 */
function dataRender() {
  // $('#prepare-panel .slot,.device').hide();
  var role = 'AM';
  var status = $('#dStatus').attr('name');
  disableButton(status, role); // TODO: get the role
}


/**
 * disable buttons by status and role
 * @param status
 * @param role DO: device owner AM: area manger
 */
function disableButton(status, role) {
  role = 'AM';//TODO: confirm all the roles, and disable buttons by role.
  $('#preInstall').removeAttr('disabled');
  $('#approve-install').removeAttr('disabled');
  $('#reject-install').removeAttr('disabled');
  $('#install').removeAttr('disabled');
  $('#set-spare').removeAttr('disabled');
  if (role === 'AM') {
    if (status == '0') {
      $('#approve-install').attr('disabled', 'disabled');
      $('#reject-install').attr('disabled', 'disabled');
      $('#install').attr('disabled', 'disabled');
      $('#set-spare').attr('disabled', 'disabled');
    }
    if (status == '1') {
      $('#preInstall').attr('disabled', 'disabled');
      $('#install').attr('disabled', 'disabled');
    }
    if (status == '1.5') {
      $('#preInstall').attr('disabled', 'disabled');
      $('#install').attr('disabled', 'disabled');
    }
    if (status == '2') {
      $('#preInstall').attr('disabled', 'disabled');
      $('#approve-install').attr('disabled', 'disabled');
      $('#reject-install').attr('disabled', 'disabled');
    }
    if (status == '3') {
      $('#preInstall').attr('disabled', 'disabled');
      $('#approve-install').attr('disabled', 'disabled');
      $('#reject-install').attr('disabled', 'disabled');
      $('#install').attr('disabled', 'disabled');
    }
  }
}


/**
 * call ajax to change device status
 * @param url
 */
function setInstallTo(url, targetId) {
  $.ajax({
    url: url,
    type: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({
      targetId: targetId
    })
  }).done(function (data) {
    $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Install-to was set to ' + data.serialNo || data.name + '</div>');
    $('#device-details').html(deviceDetailsTemplate({device: data}));
    $('#prepare-panel input.form-control').val('');
    $('#prepare-panel').addClass('hidden');
    History.prependHistory(data.__updates);
    disableButton(data.status);
  }).fail(function (jqXHR) {
    $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
  });
}

function setSpare() {
  var url =  window.location.pathname + '/';
  if ($('#dInstallToDevice a').length) {
    url += 'install-to-device/' + $('#dInstallToDevice a').prop('href').split('/').pop();
  } else if ($('#dInstallToSlot a').length) {
    url += 'install-to-slot/' + $('#dInstallToSlot a').prop('href').split('/').pop();
  } else {
    $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>The device is now spare. </div>');
    return;
  }

  $.ajax({
    url: url,
    type: 'DELETE'
  }).done(function (data) {
    $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>The device is set to be spare.</div>');
    $('#device-details').html(deviceDetailsTemplate({device: data}));
    $('#prepare-panel').removeClass('hidden');
    History.prependHistory(data.__updates);
    disableButton(data.status)
  }).fail(function (jqXHR) {
    $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
  });
}

function setStatus(status) {
  var url =  window.location.pathname + '/';
  if ($('#dInstallToDevice a').length) {
    url += 'install-to-device/' + $('#dInstallToDevice a').prop('href').split('/').pop();
  } else if ($('#dInstallToSlot a').length) {
    url += 'install-to-slot/' + $('#dInstallToSlot a').prop('href').split('/').pop();
  } else {
    $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>The device is now spare. </div>');
    return;
  }
  url += '/status';

  $.ajax({
    url: url,
    type: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({
      status: status
    })
  }).done(function (data) {
    $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>The install-to status was set to ' + status + '.</div>');
    $('#device-details').html(deviceDetailsTemplate({device: data}));
    $('#prepare-panel').removeClass('hidden');
    History.prependHistory(data.__updates);
    disableButton(data.status)
  }).fail(function (jqXHR) {
    $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
  });
}


$(function () {

  dataRender();
  var selected = null;

  $('.slot input').typeahead({
    minLength: 1,
    highlight: true,
    hint: true
  }, {
    name: 'slotList',
    display: 'name',
    limit: 20,
    source: Typeahead.slotList
  });

  $('.device input').typeahead({
    minLength: 1,
    highlight: true,
    hint: true
  }, {
    name: 'deviceList',
    display: 'serialNo',
    limit: 20,
    source: Typeahead.deviceList
  });

  $('#prepare-panel input').bind('typeahead:select', function (ev, suggestion) {
    selected = suggestion;
  });

  $('.prepare-install').click(function () {
    if ($(this).text() === 'slot') {
      $('#prepare-title').text('Please type and select a slot name');
      $('.slot').removeClass('hidden');
      $('.device').addClass('hidden');
      selected = null;
    } else {
      $('#prepare-title').text('Please type and select a device number');
      $('.device').removeClass('hidden');
      $('.slot').addClass('hidden');
      selected = null;
    }
  });


  $('#prepare-panel button[type="submit"]').click(function (e) {
    e.preventDefault();
    if (!selected._id) {
      $('#prepare-title').text('Must select from suggestions');
      return;
    }
    var id = selected._id;
    var url = window.location.pathname + '/' + 'install-to-' + $(this).val();
    setInstallTo(url, id);
  });

  $('#reject-install').click(function (e) {
    e.preventDefault();
    setStatus(0);
  });


  $('#set-spare').click(function (e) {
    e.preventDefault();
    setSpare();
  });

  $('#approve-install').click(function (e) {
    e.preventDefault();
    setStatus(2);
  });


  $('#install').click(function (e) {
    e.preventDefault();
    setStatus(3);
  });


  $('#prepare-panel button[type="reset"]').click(function () {
    $('#prepare-panel .slot,.device').addClass('hidden');
    $('#prepare-title').text('');
  });

});
