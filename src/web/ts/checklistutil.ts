/**
 * Utilities for loading, updating and displaying checklists.
 */

abstract class ChecklistUtil {

  public static render(selector: string, checklistId: string, config?: boolean) {
    //$(function() {
    let elem = $(selector).first();
    // TODO: Catch ERROR!
    ChecklistUtil.renderTo(elem, checklistId, config);
    //});
  }

  protected static showMessage(msg: string) {
    $('#cl-message').append(`
      <div class="alert alert-danger">
        <button class="close" data-dismiss="alert">x</button>
        <span>${msg}</span>
      </div>
    `);
  }

  protected static async renderTo(element: JQuery<HTMLElement>, checklistId: string, config?: boolean) {
    // show spinner to the user while checklist loads
    element.off().html(`
      <div class="text-center" style="font-size:24px;">
        <span class="fa fa-spinner fa-spin"/>
      </div>
    `);

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
          ChecklistUtil.renderUpdateTemplate(element, data.data);
        }
      });

    let data: webapi.Data<webapi.Checklist>;
    try {
      data = await $.get('/checklists/' + checklistId);
    } catch (err) {
      //TODO?
      return;
    }

    if (config) {
      ChecklistUtil.renderConfigTemplate(element, data.data);
    } else {
      ChecklistUtil.renderUpdateTemplate(element, data.data);
    }

  }

  protected static renderConfigTemplate(elem: JQuery<HTMLElement>, checklist: webapi.Checklist) {
    let count = 0;

    elem.off().html(checklistConfigTemplate({
      items: checklist.subjects,
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

    elem.on('click', '.checklist-config-cancel', () => {
      ChecklistUtil.renderUpdateTemplate(elem, checklist);
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


  // Render the view for updating Checklist status.
  protected static renderUpdateTemplate(parent: JQuery<HTMLElement>, checklist: webapi.Checklist) {
    //let history = {};

    let statuses: { [key: string]: webapi.ChecklistStatus  } = {};
    for (let status of checklist.statuses) {
      statuses[status.subjectId] = status;
    }

    // render the pre-compiled template
    parent.off().html(checklistInputTemplate({
      subjects: checklist.subjects,
      statuses: statuses,
      moment: moment,
    }));

    // enable controls as permitted
    for (let subject of checklist.subjects) {
      if (AuthUtil.hasAnyRole([ 'SYS:RUNCHECK' ].concat(subject.assignee))) {
        let sel = parent.find(`#${subject.id} select`).removeAttr('disabled');
        if (sel.val() === 'YC') {
          parent.find(`#${subject.id} input`).removeAttr('disabled');
        }
      }
    }

    parent.find('.cl-subject-status-value').each((idx, elem) => {
      $(elem).change((evt) => {
        let value = $(evt.target);
        if (value.val() === 'YC') {
          value.parents('.cl-subject').find('.cl-subject-status-comment').removeAttr('disabled');
        } else {
          // Should the comment be cleared?
          value.parents('.cl-subject').find('.cl-subject-status-comment').attr('disabled', 'disabled');
        }
        parent.find('.cl-update-save').removeAttr('disabled');
      });
    });

    parent.on('click', '.cl-subject-show-history', (evt) => {
      let btn = $(evt.target).toggleClass('hidden');
      let history = btn.parents('tr:first').next('.cl-subject-history');
      while (history.length) {
        history = history.toggleClass('hidden').next('.cl-subject-history');
      }
      btn.siblings('.cl-subject-hide-history').toggleClass('hidden');
    });

    parent.on('click', '.cl-subject-hide-history', (evt) => {
      let btn = $(evt.target).toggleClass('hidden');
      let history = btn.parents('tr:first').next('.cl-subject-history');
      while (history.length) {
        history = history.toggleClass('hidden').next('.cl-subject-history');
      }
      btn.siblings('.cl-subject-show-history').toggleClass('hidden');
    });

    // elem.find('.checklist-input-edit').click(function () {
    //   ChecklistUtil.renderConfigTemplate(elem, checklist);
    // });

    parent.find('.cl-update-save').click(async (event) => {
      event.preventDefault();
      (async () => {
        let updates: any[] = [];

        for (let subject of checklist.subjects) {
          if (AuthUtil.hasAnyRole([ 'SYS:RUNCHECK' ].concat(subject.assignee))) {
            let e = $(`#${subject.id}`);
            if (e) {
              updates.push({
                value: $(e).find('.cl-subject-status-value').val(),
                comment: $(e).find('.cl-subject-status-comment').val(),
                subjectId: subject.id,
              });
            }
          }
        }

        let data: webapi.Data<webapi.ChecklistStatus[]>;
        try {
          data = await $.ajax({
            url: `/checklists/${checklist.id}/statuses`,
            method: 'PUT',
            dataType: 'json',
            data: JSON.stringify({
              data: updates,
            }),
            contentType: 'application/json;charset=UTF-8',
          });
        } catch (err) {
          if (err.response.error && err.response.message) {
            ChecklistUtil.showMessage(err.response.message);
          }
          throw err;
        }

        checklist.statuses = data.data;
        ChecklistUtil.renderUpdateTemplate(parent, checklist);

        // for (let idx = 0; idx < checklist.items.length; idx += 1) {
        //   HistoryUtil.prependHistory(checklist.items[idx].history.__updates);
        // }
        // for (let idx = 0; idx < checklist.data.length; idx += 1) {
        //   HistoryUtil.prependHistory(checklist.data[idx].history.updates);
        // }
      })().catch(console.log);
    });
  }
};
