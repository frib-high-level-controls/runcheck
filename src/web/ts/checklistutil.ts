/**
 * Utilities for loading, updating and displaying checklists.
 */

abstract class ChecklistUtil {

  public static render(selector: string, checklistId: string, config?: boolean) {
    $(function() {
      let elem = $(selector).first();
      ChecklistUtil.renderTo(elem, checklistId, config);
    });
  }

  protected static renderConfigTemplate(elem: JQuery<HTMLElement>, checklist: webapi.Checklist) {
    let count = 0;

    elem.off().html(checklistConfigTemplate({
      items: checklist.items,
    }));

    elem.find('.checklist-item-add').click(function() {
      count += 1;

      $(this).parents('tr').before(checklistConfigItemTemplate({
        item: {
          subject: 'Custom' + count,
          required: true,
          mandatory: true,
          custom: true,
        },
      }));
    });

    elem.on('click', '.checklist-item-remove', (evt) => {
      $(evt.target).parents('tr:first').remove();
    });

    elem.on('click', '.checklist-config-cancel', function() {
      ChecklistUtil.renderInputTemplate(elem, checklist);
    });

    elem.find('.checklist-config-save').click(function (event) {
      let items: any[] = [];
      event.preventDefault();
      elem.find('.checklist-item').each(function (i, e) {
        let item = {
        //item._id = $(e).find('.checklist-item-id').val();
          subject: ($(e).find('input.checklist-item-subject').val()
                    || $(e).find('.checklist-item-subject').text()),
          assignee: ($(e).find('input.checklist-item-assignee').val()
                      || $(e).find('.checklist-item-assignee').text()),
          required: ($(e).find('.checklist-item-required:checked').length > 0),
        };
        items.push(item);
      });
      console.log(items);
      $.ajax({
        url: '/checklists/' + checklist.id + '/items/json',
        // url: 'checklist/json',
        type: 'PUT',
        data: JSON.stringify(items),
        contentType: 'application/json;charset=UTF-8',
        dataType: 'json',
        success: function () {
          ChecklistUtil.renderTo(elem, checklist.id);
        },
        error: function (req, status, err) {
          alert(err);
        },
      });
    });

    // for (let idx = 0; idx < checklist.items.length; idx += 1) {
    //   History.prependHistory(checklist.items[idx].__updates);
    // }
    // for (let idx = 0; idx < checklist.data.length; idx += 1) {
    //   History.prependHistory(checklist.data[idx].__updates);
    // }
  };

  protected static renderInputTemplate(elem: JQuery<HTMLElement>, checklist: webapi.Checklist) {
    let inputs: { [key: string]: webapi.ChecklistItemData  } = {};
    let history = {};

    for (let idx = 0; idx < checklist.data.length; idx += 1) {
      let input = checklist.data[idx];
      //input.inputOn = new Date(input.inputOn);
      inputs[input.itemId] = input;
    }

    elem.off().html(checklistInputTemplate({
      items: checklist.items,
      inputs: inputs,
    }));

    for (let item of checklist.items) {
      if (AuthUtil.hasAnyRole([ 'SYS:RUNCHECK' ].concat(item.assignee))) {
        let sel = elem.find(`#${item.id} select`).removeAttr('disabled');
        if (sel.val() === 'YC') {
          elem.find(`#${item.id} input`).removeAttr('disabled');
        }
      }
    }

    elem.find('.checklist-item select').each(function (idx, elm) {
      $(elm).change(function (evt) {
        console.log('CHANGE!');
        elem.find('.checklist-input-save').removeAttr('disabled');
      });
    });

    elem.on('click', '.checklist-item-show-history', function (evt) {
      let btn = $(evt.target).toggleClass('hidden');
      let history = btn.parents('tr:first').next('.checklist-item-history');
      while (history.length) {
        history = history.toggleClass('hidden').next('.checklist-item-history');
      }
      btn.siblings('.checklist-item-hide-history').toggleClass('hidden');
    });

    elem.on('click', '.checklist-item-hide-history', function (evt) {
      let btn = $(evt.target).toggleClass('hidden');
      let history = btn.parents('tr:first').next('.checklist-item-history');
      while (history.length) {
        history = history.toggleClass('hidden').next('.checklist-item-history');
      }
      btn.siblings('.checklist-item-show-history').toggleClass('hidden');
    });



    elem.find('.checklist-input-edit').click(function () {
      ChecklistUtil.renderConfigTemplate(elem, checklist);
    });

    elem.find('.checklist-input-save').click(function (event) {
      let inputs: any[] = [];
      event.preventDefault();

      elem.find('.checklist-item').each(function (i, e) {
        let input = {
          _id: $(e).find('.checklist-item-id').val(),
          value: $(e).find('.checklist-item-value:checked').val(),
          comment: $(e).find('.checklist-item-comment').val(),
        };
        inputs.push(input);
      });

      $.ajax({
        //url: '/checklists/' + checklist.id + '/inputs/json',
        url: 'inputs/json',
        type: 'PUT',
        data: JSON.stringify(inputs),
        contentType: 'application/json;charset=UTF-8',
        dataType: 'json',
        success: function () {
          ChecklistUtil.renderTo(elem, checklist.id);
        },
        error: function (req, status, err) {
          alert(err);
        },
     });
    });

    // for (let idx = 0; idx < checklist.items.length; idx += 1) {
    //   HistoryUtil.prependHistory(checklist.items[idx].history.__updates);
    // }
    // for (let idx = 0; idx < checklist.data.length; idx += 1) {
    //   HistoryUtil.prependHistory(checklist.data[idx].history.updates);
    // }
  }

  protected static renderTo(element: JQuery<HTMLElement>, checklistId: string, config?: boolean) {
    element.off().html('<div class="text-center" style="font-size:24px;"><span class="fa fa-spinner fa-spin"/></div>');
    //$.get('/checklists/' + checklistId + '/json')
    // if (typeof checklist !== 'string') {
    //   if (config) {
    //     renderConfigTemplate(element, checklist);
    //   } else {
    //     renderInputTemplate(element, checklist);
    //   }
    //   return;
    // }
    //$.get(document.location + '/checklist/json')
    $.get('/checklists/' + checklistId)
      .done(function(data: webapi.Data<webapi.Checklist>) {
        if (config) {
          ChecklistUtil.renderConfigTemplate(element, data.data);
        } else {
          ChecklistUtil.renderInputTemplate(element, data.data);
        }
      });
  }
};
