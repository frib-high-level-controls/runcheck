/**
 * Utilities for loading, updating and displaying checklists.
 */

abstract class ChecklistRequestStatus {
  public requestStatus?: 'NONE' | 'DONE' | 'FAIL';
  public requestStatusMsg?: string;
};

class ChecklistEditFormTableRow extends ChecklistRequestStatus {

  public name: string;
  public desc: string; // KnockoutObservable<string>;
  public primary: boolean;
  public required: boolean; // KnockoutObservable<boolean>;
  public mandatory: boolean;
  public assignees: string[]; // KnockoutObservableArray<string>;
  public subject?: webapi.ChecklistSubjectDetails;

  constructor(subject?: webapi.ChecklistSubjectDetails) {
    super();
    this.name = `C${Math.random().toString(16).substring(2, 10).toUpperCase()}`;
    this.desc = ''; // ko.observable('');
    this.primary = false;
    this.required = false; // ko.observable(false);
    this.mandatory = true;
    this.assignees = []; // ko.observableArray<string>();
    if (subject) {
      this.updateFrom(subject);
    }
  };

  public updateFrom(subject: webapi.ChecklistSubjectDetails) {
    this.name = subject.name;
    this.desc = subject.desc;
    this.primary = subject.primary;
    this.required = subject.required;
    this.mandatory = subject.mandatory;
    this.assignees = subject.assignees.slice();
    this.subject = subject;
  };

  public isCustom(): boolean {
    return Boolean(this.name.match(/C\w{8}/));
  };

  public isAddition(): boolean {
    return Boolean(!this.subject);
  }
};


class ChecklistEditFormViewModel {

  private parent: ChecklistUtil;
  private rows: ChecklistEditFormTableRow[];

  constructor(parent: ChecklistUtil) {
    this.parent = parent;
  }

  public render(noUpdate?: boolean) {
    // copy subjects for use in edit view model
    if (!noUpdate) {
      this.rows = [];
      for (let subject of this.parent.checklist.subjects) {
        this.rows.push(new ChecklistEditFormTableRow(subject));
      }
    }
    this.parent.element.off().html(checklistConfigTemplate({
      rows: this.rows,
    }));

    this.parent.element.find('.cl-subject-add').click(WebUtil.wrapCatchAll1((event) => {
      let row = new ChecklistEditFormTableRow();
      this.rows.push(row);

      $(event.target).parents('tr').before(checklistConfigItemTemplate({
        row: row,
      }));
    }));

    this.parent.element.on('click', '.cl-subject-remove', WebUtil.wrapCatchAll1((event) => {
      $(event.target).parents('tr:first').addClass('hidden');
    }));

    this.parent.element.on('click', '.cl-edit-cancel', WebUtil.wrapCatchAll1((event) => {
      event.preventDefault();
      this.parent.updateForm.render();
    }));

    this.parent.element.find('.cl-edit-save').click(WebUtil.wrapCatchAll1(async (event) => {
      event.preventDefault();

      for (let ridx = 0; ridx < this.rows.length; ridx += 1) {
        let row = this.rows[ridx];
        let e = $(`#${row.name}`);

        let add = row.isAddition();
        let remove = e.hasClass('hidden');
        // ignore subjects added then removed before saving
        if (remove && add) {
          this.rows.splice(ridx, 1);
          continue;
        }

        row.desc = String($(e).find('input.cl-subject-desc').val()
                            || $(e).find('.cl-subject-desc').text()).trim();

        row.assignees = String($(e).find('input.cl-subject-assignee').val()
                                || $(e).find('.cl-subject-assignee').text()).split(',');
        row.assignees = row.assignees.map((a) => a.trim()); // trim whitespace from each item

        row.required = ($(e).find('.cl-subject-required:checked').length > 0);

        // if (row.subject) {
        //   console.log("%s ?== %s", row.desc, row.subject.desc);
        //   console.log("%s ?== %s", row.required, row.subject.required);
        //   console.log("%s ?== %s", row.assignees.join(','), row.subject.assignees.join(','));
        // }

        if (!add && !remove && row.subject
            && (row.desc === row.subject.desc)
            && (row.required === row.subject.required)
            && (row.assignees.join(',') === row.subject.assignees.join(','))) {
          row.requestStatus = 'NONE'; // clear the previous status
          row.requestStatusMsg = '';
          continue;
        }

        e.find('.cl.subject-update-status').addClass('fa fa-spinner fa-spin');

        let pkg: webapi.Pkg<webapi.ChecklistSubjectDetails>;
        if (add) {
          // Create a new subject for the checklist
          try {
            pkg = await $.ajax({
              url: `${basePath}/checklists/${this.parent.checklist.id}/subjects`,
              contentType: 'application/json;charset=UTF-8',
              data: JSON.stringify({
                data: {
                  desc: row.desc,
                  required: row.required,
                  assignees: row.assignees,
                },
              }),
              method: 'POST',
              dataType: 'json',
            });
          } catch (xhr) {
            let message = 'Unknown error updating subject';
            row.requestStatus = 'FAIL';
            row.requestStatusMsg = WebUtil.unwrapPkgErrMsg(xhr, message);
            continue;
          }

          // upate the parent view model
          this.parent.checklist.subjects.push(pkg.data);
          // re-sort the the subject list (in-place)
          this.parent.checklist.subjects.sort((a, b) => {
            return (a.order === b.order) ? 0 : (a.order < b.order) ? -1 : 1;
          });
          // update the local view model
          row.updateFrom(pkg.data);
          row.requestStatus = 'DONE';
          row.requestStatusMsg = 'Success';

        } else if (remove) {
          // Remove an existing subject
          row.requestStatus = 'FAIL';
          row.requestStatusMsg = 'Subject remove not yet supported';

        } else {
          // Update and existing subject
          try {
            pkg = await $.ajax({
              url: `${basePath}/checklists/${this.parent.checklist.id}/subjects/${row.name}`,
              contentType: 'application/json;charset=UTF-8',
              data: JSON.stringify({
                data: {
                  desc: row.desc,
                  required: row.required,
                  assignees: row.assignees,
                },
              }),
              method: 'PUT',
              dataType: 'json',
            });
          } catch (xhr) {
            let message = 'Unknown error updating subject';
            row.requestStatus = 'FAIL';
            row.requestStatusMsg = WebUtil.unwrapPkgErrMsg(xhr, message);
            continue;
          }

          for (let idx = 0; idx < this.parent.checklist.subjects.length; idx += 1) {
            if (this.parent.checklist.subjects[idx].name === pkg.data.name) {
              // update the parent view model
              this.parent.checklist.subjects[idx] = pkg.data;
              // update the local view model
              row.updateFrom(pkg.data);
              row.requestStatus = 'DONE';
              row.requestStatusMsg = 'Success';
            }
          }
        }
      }

      this.render(true);
    }));
  }
};


class ChecklistUpdateFormHistory {
  public value: string;
  public comment: string;
  public inputAt: moment.Moment;
  public inputBy: string;
}

class ChecklistUpdateFormTableRow extends ChecklistRequestStatus {
  private static DEFAULT_STATUS_VALUE = 'N';
  private static DEFAULT_STATUS_COMMENT = '';

  // name: string;
  // desc: string;
  public value: string;  // KnockoutObservable<string>;
  public comment: string; // KnockoutObservable<string>;
  public status?: webapi.ChecklistStatusDetails;
  public history: ChecklistUpdateFormHistory[];

  constructor(status?: webapi.ChecklistStatusDetails) {
    super();
    this.value = ChecklistUpdateFormTableRow.DEFAULT_STATUS_VALUE;
    this.comment = ChecklistUpdateFormTableRow.DEFAULT_STATUS_COMMENT;
    this.history = [];
    if (status) {
      this.updateFrom(status);
    }
  }

  public updateFrom(status: webapi.ChecklistStatusDetails) {
    let value = ChecklistUpdateFormTableRow.DEFAULT_STATUS_VALUE;
    let comment = ChecklistUpdateFormTableRow.DEFAULT_STATUS_COMMENT;
    let inputAt: string | undefined;
    let inputBy: string | undefined;

    let history: ChecklistUpdateFormHistory[] = [];
    for (let update of status.history.updates) {
      for (let path of update.paths) {
        if (path.name === 'value') {
          value = String(path.value);
        } else if (path.name === 'comment') {
          comment = String(path.value);
        } else if (path.name === 'inputBy') {
          inputBy = String(path.value);
        } else if (path.name === 'inputAt') {
          inputAt = String(path.value);
        }
      }
      if (inputBy && inputAt) {
        history.push({
          value: value,
          comment: comment,
          inputBy: inputBy,
          inputAt: moment(inputAt),
        });
      } else {
        console.error('Checklist status history missing inputAt and/or inputBy paths');
      }
    }

    this.status = status;
    this.value = status.value;
    this.comment = status.comment;
    this.history = history.reverse();
  }
};

class ChecklistUpdateFormViewModel {
  private parent: ChecklistUtil;

  private rows: { [key: string]: ChecklistUpdateFormTableRow | undefined } = {};

  constructor(parent: ChecklistUtil) {
    this.parent = parent;
  }

  public render(noUpdate?: boolean) {

    if (!noUpdate) {
      this.rows = {};
      for (let subject of this.parent.checklist.subjects) {
        let row: ChecklistUpdateFormTableRow | undefined;
        for (let status of this.parent.checklist.statuses) {
          if (subject.name === status.subjectName) {
            row = new ChecklistUpdateFormTableRow(status);
            break;
          }
        }
        if (!row) {
          row = new ChecklistUpdateFormTableRow();
        }
        this.rows[subject.name] = row;
      }
    }

    // render the pre-compiled template
    this.parent.element.off().html(checklistInputTemplate({
      subjects: this.parent.checklist.subjects,
      statuses: this.rows,
    }));

    // enable checklist controls as permitted
    for (let subject of this.parent.checklist.subjects) {
      if (subject.canUpdate) {
        let sel = this.parent.element.find(`#${subject.name} select`).removeAttr('disabled');
        if (sel.val() === 'YC') {
          this.parent.element.find(`#${subject.name} input`).removeAttr('disabled');
        }
      }
    }

    if (this.parent.checklist.canEdit) {
      this.parent.element.find('.cl-update-edit').removeAttr('disabled');
    }

    this.parent.element.find('.cl-subject-status-value').each((idx, elem) => {
      $(elem).change((evt) => {
        let value = $(evt.target);
        if (value.val() === 'YC') {
          value.parents('.cl-subject').find('.cl-subject-status-comment').removeAttr('disabled');
        } else {
          value.parents('.cl-subject').find('.cl-subject-status-comment').attr('disabled', 'disabled');
          value.parents('.cl-subject').find('.cl-subject-status-comment').val(''); // clear the comment
        }
        this.parent.element.find('.cl-update-save').removeAttr('disabled');
      });
    });

    this.parent.element.find('.cl-subject-status-comment').each((idx, elem) => {
      $(elem).keypress(WebUtil.wrapCatchAll1((evt) => {
        this.parent.element.find('.cl-update-save').removeAttr('disabled');
      }));
    });

    this.parent.element.on('click', '.cl-subject-show-history', WebUtil.wrapCatchAll1((event) => {
      let btn = $(event.target).toggleClass('hidden');
      let history = btn.parents('tr:first').next('.cl-subject-history');
      while (history.length) {
        history = history.toggleClass('hidden').next('.cl-subject-history');
      }
      btn.siblings('.cl-subject-hide-history').toggleClass('hidden');
    }));

    this.parent.element.on('click', '.cl-subject-hide-history', WebUtil.wrapCatchAll1((event) => {
      let btn = $(event.target).toggleClass('hidden');
      let history = btn.parents('tr:first').next('.cl-subject-history');
      while (history.length) {
        history = history.toggleClass('hidden').next('.cl-subject-history');
      }
      btn.siblings('.cl-subject-show-history').toggleClass('hidden');
    }));

    this.parent.element.on('click', '.cl-update-edit', WebUtil.wrapCatchAll1((event) => {
      this.parent.editForm.render();
    }));

    this.parent.element.find('.cl-update-save').click(WebUtil.wrapCatchAll1(async (event) => {
      event.preventDefault();

      for (let subject of this.parent.checklist.subjects) {
        if (subject.canUpdate && (subject.mandatory || subject.required)) {
          let e = $(`#${subject.name}`);

          let row = this.rows[subject.name];
          if (!row) {
            console.error('Row for subject not found: %s', subject.name);
            continue;
          }

          row.value = String(e.find('.cl-subject-status-value').val());
          row.comment = String(e.find('.cl-subject-status-comment').val());

          // if (row.status) {
          //   console.log('%s ?== %s', row.status.value, row.value);
          //   console.log('%s ?== %s', row.status.comment, row.comment);
          // }

          if (row.status) {
            if ((row.status.value === row.value) && (row.status.comment === row.comment)) {
              row.requestStatus = 'NONE';
              row.requestStatusMsg = '';
              continue;
            }
          } else if ((row.value === 'N') && (row.comment === '')) {
            row.requestStatus = 'NONE';
            row.requestStatusMsg = '';
            continue;
          }

          e.find('.cl.subject-update-status').addClass('fa fa-spinner fa-spin');

          let pkg: webapi.Pkg<webapi.ChecklistStatusDetails>;
          try {
            pkg = await $.ajax({
              url: `${basePath}/checklists/${this.parent.checklist.id}/statuses/${subject.name}`,
              contentType: 'application/json;charset=UTF-8',
              data: JSON.stringify({
                data: {
                  value: row.value,
                  comment: row.comment,
                },
              }),
              method: 'PUT',
              dataType: 'json',
            });
          } catch (xhr) {
            pkg = xhr.responseJSON;
            let message = 'Unknown error updating checklist status';
            row.requestStatusMsg = WebUtil.unwrapPkgErrMsg(xhr, message);
            row.requestStatus = 'FAIL';
            continue;
          }

          let found = false;
          for (let idx = 0; idx < this.parent.checklist.statuses.length; idx += 1) {
            if (this.parent.checklist.statuses[idx].subjectName === pkg.data.subjectName) {
              // replace existing status
              this.parent.checklist.statuses[idx] = pkg.data;
              row.updateFrom(pkg.data);
              row.requestStatus = 'DONE';
              row.requestStatusMsg = 'Success';
              found = true;
              break;
            }
          }
          if (!found) {
            // add new status
            this.parent.checklist.statuses.push(pkg.data);
            row.updateFrom(pkg.data);
            row.requestStatus = 'DONE';
            row.requestStatusMsg = 'Success';
          }
        }
      }

      // re-render the template
      this.render(true);
    }));

    // ensure the checklist is visible
    this.parent.element.removeClass('hidden');
  }
};



// This class has been partially refactored to support future use of KnockoutJS.
// At that time consider renaming to ChecklistViewModel.
class ChecklistUtil {

  public static render(selector: string, checklist: webapi.ChecklistDetails | string, edit?: boolean) {
    WebUtil.catchAll(async () => {
      let element = $(selector).first();
      if (element.length === 0) {
        throw new Error(`Checklist element not found with selector: ${selector}`);
      }

      // the checklist ID is provided
      if (typeof checklist === 'string') {
        element.off().html(`
          <div class="text-center" style="font-size:24px;">
            <span class="fa fa-spinner fa-spin"/>
          </div>
        `).removeClass('hidden');

        try {
          checklist = await ChecklistUtil.getChecklist(checklist);
        } catch (err) {
          element.off().html(`
            <div class="alert alert-danger">
              <span>${err.message}</span>
            </div>
          `).removeClass('hidden');
          return;
        }
      }

      let checklistViewModel = new ChecklistUtil(element, checklist);
      if (edit) {
        checklistViewModel.editForm.render();
      } else {
        checklistViewModel.updateForm.render();
      }
    });
  }


  protected static async getChecklist(id: string): Promise<webapi.ChecklistDetails> {
    let pkg: webapi.Pkg<webapi.ChecklistDetails>;
    try {
      pkg = await $.ajax({
        url: `${basePath}/checklists/${id}`,
        method: 'GET',
        dataType: 'json',
      });
    } catch (xhr) {
      let message = 'Unknown error retrieving checklist';
      throw new Error(WebUtil.unwrapPkgErrMsg(xhr, message));
    }

    return pkg.data;
  }


  public element: JQuery<HTMLElement>;
  public checklist: webapi.ChecklistDetails;

  public editForm = new ChecklistEditFormViewModel(this);
  public updateForm = new ChecklistUpdateFormViewModel(this);

  constructor(element: JQuery<HTMLElement>, checklist: webapi.ChecklistDetails) {
    this.element = element;
    this.checklist = checklist;
  }
};
