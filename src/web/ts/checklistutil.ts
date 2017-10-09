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
          ChecklistUtil.renderEditTemplate(element, data.data);
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
      ChecklistUtil.renderEditTemplate(element, data.data);
    } else {
      ChecklistUtil.renderUpdateTemplate(element, data.data);
    }

  }

  protected static renderEditTemplate(parent: JQuery<HTMLElement>, checklist: webapi.Checklist) {
    let count = 0;

    parent.off().html(checklistConfigTemplate({
      subjects: checklist.subjects,
    }));

    parent.find('.cl-subject-add').click(function() {
      count += 1;

      $(this).parents('tr').before(checklistConfigItemTemplate({
        subject: {
          subject: 'Custom' + count,
          required: true,
          mandatory: true,
          custom: true,
          assignee: [],
        },
      }));
    });

    parent.on('click', '.cl-subject-remove', (evt) => {
      $(evt.target).parents('tr:first').remove();
    });

    parent.on('click', '.cl-edit-cancel', () => {
      ChecklistUtil.renderUpdateTemplate(parent, checklist);
    });

    parent.find('.cl-edit-save').click(function (event) {
      let items: any[] = [];
      event.preventDefault();
      parent.find('.cl-subject').each(function (i, e) {
        let item = {
        //item._id = $(e).find('.checklist-item-id').val();
          id: $(e).find('input.cl-subject-id').val(),
          subject: ($(e).find('input.cl-subject-name').val()
                    || $(e).find('.cl-subject-name').text()),
          assignee: [ ($(e).find('input.cl-subject-assignee').val()
                      || $(e).find('.cl-subject-assignee').text()) ],
          required: ($(e).find('.cl-subject-required:checked').length > 0),
        };
        items.push(item);
      });
      console.log(items);
      $.ajax({
        url: '/checklists/' + checklist.id + '/subjects',
        // url: 'checklist/json',
        method: 'PUT',
        data: JSON.stringify({
          data: items,
        }),
        contentType: 'application/json;charset=UTF-8',
        dataType: 'json',
        success: function () {
          ChecklistUtil.renderTo(parent, checklist.id);
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

    if (checklist.editable) {
      parent.find('.cl-update-edit').removeAttr('disabled');
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

    parent.on('click', '.cl-update-edit', (evt) => {
      ChecklistUtil.renderEditTemplate(parent, checklist);
    });

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