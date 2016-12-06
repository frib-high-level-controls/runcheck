

function ChecklistHelper() {

  function renderConfigTemplate(elem, checklist) {
    var count = 0;

    elem.off().html(checklistConfigTemplate({
      items: checklist.items
    }));

    elem.find('.checklist-item-add').click(function () {
      var idx, name = null;
      // ensure random name is unique
      while(!name) {
        name = 'Z' + Math.floor((Math.random()*90000)+10000).toString(16).toUpperCase();
        for (idx=0; idx<checklist.items.length; idx+=1) {
          if (name === checklist.items[idx]) {
            name = null;
            break;
          }
        }
      }

      count += 1;

      $(this).parents('tr').before(checklistConfigItemTemplate({
        item: {
          name: name,
          subject: 'Custom' + count,
          required: true,
          mandatory: true,
          custom: true
        }
      }));
    });

    elem.on('click', '.checklist-item-remove', function () {
      $(this).parents('tr:first').remove();
    });

    elem.on('click', '.checklist-config-cancel', function () {
      renderInputTemplate(elem, checklist);
    });

    elem.find('.checklist-config-save').click(function (event) {
      var item, items = [];
      event.preventDefault();
      elem.find('.checklist-item').each(function (i, e) {
        item = {};
        item._id = $(e).find('.checklist-item-id').val();
        item.subject = $(e).find('input.checklist-item-subject').val() 
                        || $(e).find('.checklist-item-subject').text();
        item.assignee = $(e).find('input.checklist-item-assignee').val() 
                         || $(e).find('.checklist-item-assignee').text();
        item.required = ($(e).find('.checklist-item-required:checked').length > 0);
        items.push(item);
      });
      console.log(items);
      $.ajax({
        url: '/checklists/' + checklist._id + '/items/json',
        type: 'PUT',
        data: JSON.stringify(items),
        contentType: 'application/json;charset=UTF-8',
        dataType: 'json',
        success: function () {
          renderTo(elem, checklist._id);
        },
        error: function (req, status, err) {
          alert(err);
        }
      });
    });
  }

  function renderInputTemplate(elem, checklist) {
    var idx, input, inputs = {}, history = {};

    for (idx=0; idx<checklist.data.length; idx+=1) {
      input = checklist.data[idx];
      input.inputOn = new Date(input.inputOn);

      if (inputs[input.item]) {
        if( input.inputOn > inputs[input.item].inputOn) {
          inputs[input.item] = input;
        }
      } else {
        inputs[input.item] = input;
      }

      if (history[input.item]) {
        history[input.item].push(input);
        history[input.item].sort(function (a, b) { return (a.inputOn < b.inputOn) ? 1 : -1 });
      } else {
        history[input.item] = [ input ];
      }
    }

    elem.off().html(checklistInputTemplate({
      items: checklist.items,
      inputs: inputs,
      history: history
    }));

    elem.on('click', '.checklist-item-show-history', function () {
      var btn = $(this).toggleClass('hidden');
      var history = $(this).parents('tr:first').next('.checklist-item-history');
      while (history.length) {
        history = history.toggleClass('hidden').next('.checklist-item-history');
      }
      btn.siblings('.checklist-item-hide-history').toggleClass('hidden');
    });

    elem.on('click', '.checklist-item-hide-history', function () {
      var btn = $(this).toggleClass('hidden');
      var history = $(this).parents('tr:first').next('.checklist-item-history');
      while (history.length) {
        history = history.toggleClass('hidden').next('.checklist-item-history');
      }
      btn.siblings('.checklist-item-show-history').toggleClass('hidden');
    });


    elem.find('.checklist-input-edit').click(function () {
      renderConfigTemplate(elem, checklist);
    });

    elem.find('.checklist-input-save').click(function (event) {
      var input, inputs = [];
      event.preventDefault();
    
      elem.find('.checklist-item').each(function (i, e) {
        input = {};
        input._id = $(e).find('.checklist-item-id').val();
        input.value = $(e).find('.checklist-item-value:checked').val();
        input.comment = $(e).find('.checklist-item-comment').val();
        inputs.push(input);
      });

      $.ajax({
        url: '/checklists/' + checklist._id + '/inputs/json',
        type: 'PUT',
        data: JSON.stringify(inputs),
        contentType: 'application/json;charset=UTF-8',
        dataType: 'json',
        success: function () {
          renderTo(elem, checklist._id);
        },
        error: function (req, status, err) {
          alert(err);
        }
      });
    });
  }

  function renderTo(element, checklistId, config) {
    element.off().html('<div class="text-center" style="font-size:24px;"><span class="fa fa-spinner fa-spin"/></div>');
    $.get('/checklists/' + checklistId + '/json')
      .done(function (data) {
        if (config) {
          renderConfigTemplate(element, data);
        } else {
          renderInputTemplate(element, data);
        }
      });
  }

  function render(selector, checklistId, config) {
    $(function () {
      var elem = $(selector).first();
      renderTo(elem, checklistId, config);
    });
  }

  return {
    render: render
  };
}
