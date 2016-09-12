var statusMap = {0: 'Device not installed',
  1: 'Device installed',
  2: 'DO OK',
  2.5: 'Slot DRR checklist',
  3: 'AM approved',
  4:'DRR approved'
};

function setStatus(status) {
  var url =  window.location.pathname + '/device/';
  var deviceHref =  $('#device a').attr('href');
  if(!deviceHref){
    $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>No device installed.</div>');
  }
  var toid = deviceHref.split('/').pop();
  url += toid + '/status';
  $.ajax({
    url: url,
    type: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({
      status: status
    })
  }).done(function (data) {
    $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>The slot status was set to ' + status + '.</div>');
    $('#status').text(statusMap[data.status]);
    History.prependHistory(data.__updates);
  }).fail(function (jqXHR) {
    $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
  });
}

$(function () {
  $('#list-slot').click(function () {
    if($(this).text() === 'collapse') {
      $('#slot-detail').hide();
      $(this).removeClass(' fa-chevron-up');
      $(this).addClass(' fa-chevron-down');
      $(this).attr('title', 'show more details');
      $(this).text('more');
    }else {
      $('#slot-detail').show();
      $(this).removeClass('fa-chevron-down');
      $(this).addClass('fa-chevron-up');
      $(this).attr('title', 'hide details');
      $(this).text('collapse');
    }
  });

  $('#slot-detail').hide();

  $('#DO-approve').click(function(e){
    e.preventDefault();
    setStatus(2);
  });

  $('#AM-approve').click(function(e){
    e.preventDefault();
    setStatus(3);
  });

  $('#DRR-approve').click(function(e){
    e.preventDefault();
    setStatus(4);
  });
});