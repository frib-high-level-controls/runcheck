/**
 * Utilities for loading, updating and displaying checklists.
 */

/**
 * Type aliases can not be defined within a class definition,
 * these aliasses will instead be defined within a new namespace.
 */
// tslint:disable:no-namespace
namespace ChecklistUtil {
  type ChecklistUpdateStatus = { updateStatus?: 'NONE' | 'DONE' | 'FAIL', updateMessage?: string };
  export type ChecklistSubjectDetails = webapi.ChecklistSubjectDetails & ChecklistUpdateStatus;

  interface RequestStatus {
    requestStatus?: 'NONE' | 'DONE' | 'FAIL';
    requestMessage?: string;
  }

  export interface UpdateFormHistory {
    value: string;
    comment: string;
    inputAt: Date;
    inputBy: string;
  }

  export interface UpdateFormTableRow extends RequestStatus {
    // name: string;
    // desc: string;
    value: string;  // KnockoutObservable<string>;
    comment: string; // KnockoutObservable<string>;
    status?: webapi.ChecklistStatusDetails;
    history: UpdateFormHistory[];
  }
}

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


  private static EditFormViewModel = class {

    private parent: ChecklistUtil;
    private subjects: ChecklistUtil.ChecklistSubjectDetails[] = [];

    constructor(parent: ChecklistUtil) {
      this.parent = parent;
    }

    public render(noUpdate?: boolean) {
      // copy subjects for use in edit view model
      if (!noUpdate) {
        this.subjects = this.parent.checklist.subjects.slice();
      }
      this.parent.element.off().html(checklistConfigTemplate({
        subjects: this.subjects,
      }));

      this.parent.element.find('.cl-subject-add').click(WebUtil.wrapCatchAll1((event) => {
        // Create a placeholder subject
        let subject: ChecklistUtil.ChecklistSubjectDetails = {
          name: `T${Math.random().toString(16).substring(2, 10).toUpperCase()}`,
          desc: '',
          order: 0,
          final: false,
          primary: false,
          required: true,
          mandatory: true,
          assignees: [],
          canUpdate: true,
        };
        this.subjects.push(subject);

        $(event.target).parents('tr').before(checklistConfigItemTemplate({
          subject: subject,
        }));
      }));

      this.parent.element.on('click', '.cl-subject-remove', WebUtil.wrapCatchAll1((event) => {
        $(event.target).parents('tr:first').addClass('hidden');
      }));

      this.parent.element.on('click', '.cl-edit-cancel', WebUtil.wrapCatchAll1((event) => {
        console.log("CANCEL!!");
        this.parent.updateForm.render();
      }));

      this.parent.element.find('.cl-edit-save').click(WebUtil.wrapCatchAll1(async (event) => {
        console.log("SAVE!!");
        event.preventDefault();

        for (let subject of this.subjects) {
          let e = $(`#${subject.name}`);
          let remove = e.hasClass('hidden');
          let add = subject.name.match(/T\w{8}/);
          console.log("%s, %s, %s", subject.name, add, remove);
          // ignore subjected added then immediately removed
          if (remove && add) {
            // TODO: REMOVE from array!
            console.log('IGNORE: %s', subject.name);
            continue;
          }

          let desc = String($(e).find('input.cl-subject-desc').val()
                              || $(e).find('.cl-subject-desc').text()).trim();

          let assignees = String($(e).find('input.cl-subject-assignee').val()
                                  || $(e).find('.cl-subject-assignee').text()).split(',');
          assignees = assignees.map((a) => a.trim()); // trim whitespace from each item

          let required = ($(e).find('.cl-subject-required:checked').length > 0);

          if (!add && !remove && (subject.desc === desc) && (subject.required === required)
                                   && (subject.assignees.join(',') === assignees.join(','))) {
            console.log("SKIP IT!!");
            subject.updateStatus = 'NONE';
            continue;
          }

          subject.desc = desc;
          subject.required = required;
          subject.assignees = assignees;

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
                    desc: desc,
                    required: required,
                    assignees: assignees,
                  },
                }),
                method: 'POST',
                dataType: 'json',
              });
            } catch (xhr) {
              let message = 'Unknown error updating subject';
              subject.updateStatus = 'FAIL';
              subject.updateMessage = WebUtil.unwrapPkgErrMsg(xhr, message);
              continue;
            }
            // Update the local view model
            for (let idx = 0; idx < this.subjects.length; idx += 1) {
              if (this.subjects[idx].name === subject.name) {
                subject = pkg.data;
                subject.updateStatus = 'DONE';
                subject.updateMessage = 'Success';
                this.subjects[idx] = subject;
              }
            }
            // Upate the parent view model
            this.parent.checklist.subjects.push(subject);

          } else if (remove) {
            // Remove an existing subject
            subject.updateStatus = 'FAIL';
            subject.updateMessage = 'Subject remove not yet supported';

          } else {
            // Update and existing subject
            try {
              pkg = await $.ajax({
                url: `${basePath}/checklists/${this.parent.checklist.id}/subjects/${subject.name}`,
                contentType: 'application/json;charset=UTF-8',
                data: JSON.stringify({
                  data: {
                    desc: desc,
                    required: required,
                    assignees: assignees,
                  },
                }),
                method: 'PUT',
                dataType: 'json',
              });
            } catch (xhr) {
              let message = 'Unknown error updating subject';
              subject.updateStatus = 'FAIL';
              subject.updateMessage = WebUtil.unwrapPkgErrMsg(xhr, message);
              continue;
            }
            // Update the local view model
            for (let idx = 0; idx < this.subjects.length; idx += 1) {
              if (this.subjects[idx].name === subject.name) {
                subject = pkg.data;
                subject.updateStatus = 'DONE';
                subject.updateMessage = 'Success';
                this.subjects[idx] = subject;
              }
            }
            // update the parent view model
            for (let idx = 0; idx < this.parent.checklist.subjects.length; idx += 1) {
              if (this.parent.checklist.subjects[idx].name === subject.name) {
                this.parent.checklist.subjects[idx] = subject;
              }
            }
          }
        }

        this.render(true);
      }));
    }
  };

  private static UpdateFormViewModel = class {
    //private static DEFAULT_STATUS_VALUE = 'N';
    //private static DEFAULT_STATUS_COMMENT = '';

    private parent: ChecklistUtil;

    private rows: { [key: string]: ChecklistUtil.UpdateFormTableRow | undefined } = {};

    constructor(parent: ChecklistUtil) {
      this.parent = parent;
    }

    public render(noUpdate?: boolean) {

      if (!noUpdate) {
        this.rows = {};
        for (let subject of this.parent.checklist.subjects) {
          let row: ChecklistUtil.UpdateFormTableRow | undefined;
          for (let status of this.parent.checklist.statuses) {
            if (subject.name === status.subjectName) {
              row = this.statusToRow(status);
              break;
            }
          }
          if (!row) {
            row = this.statusToRow();
          }
          this.rows[subject.name] = row;
        }
      }

      // render the pre-compiled template
      this.parent.element.off().html(checklistInputTemplate({
        subjects: this.parent.checklist.subjects,
        statuses: this.rows,
        moment: moment,
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
          if (subject.canUpdate) {
            let e = $(`#${subject.name}`);

            let row = this.rows[subject.name];
            if (!row) {
              console.error('Row for subject not found: %s', subject.name);
              continue;
            }

            row.value = String(e.find('.cl-subject-status-value').val());
            row.comment = String(e.find('.cl-subject-status-comment').val());

            if (row.status) {
              if ((row.status.value === row.value) && (row.status.comment === row.comment)) {
                row.requestStatus = 'NONE';
                row.requestMessage = '';
                continue;
              }
            } else if ((row.value === 'N') && (row.comment === '')) {
              row.requestStatus = 'NONE';
              row.requestMessage = '';
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
              row.requestMessage = WebUtil.unwrapPkgErrMsg(xhr, message);
              row.requestStatus = 'FAIL';
              continue;
            }

            for (let idx = 0; idx < this.parent.checklist.statuses.length; idx += 1) {
              if (this.parent.checklist.statuses[idx].subjectName === subject.name) {
                this.parent.checklist.statuses[idx] = pkg.data;
                this.statusToRow(pkg.data, row);
                row.requestMessage = 'Success';
                row.requestStatus = 'DONE';
                break;
              }
            }
          }
        }

        // re-render the template
        this.render(true);
      }));

      // ensure the checklist is visible
      this.parent.element.removeClass('hidden');
    }

    private statusToRow(status?: webapi.ChecklistStatusDetails, row?: ChecklistUtil.UpdateFormTableRow): ChecklistUtil.UpdateFormTableRow {
      // default status values (assume 'N' if no status is defined)
      let value = 'N';
      let comment = '';
      let inputAt: string | undefined;
      let inputBy: string | undefined;

      if (!row) {
        row = {
          value: value,
          comment: comment,
          history: [],
        };
      }
      if (!status) {
        return row;
      }

      let history: ChecklistUtil.UpdateFormHistory[] = [];
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
            inputAt: moment(inputAt).toDate(),
          });
        } else {
          console.error('Checklist status history missing inputAt and/or inputBy paths');
        }
      }

      row.status = status;
      row.value = status.value;
      row.comment = status.comment;
      row.history = history.reverse();
      return row;
    }
  };

  private element: JQuery<HTMLElement>;
  private checklist: webapi.ChecklistDetails;

  private editForm = new ChecklistUtil.EditFormViewModel(this);
  private updateForm = new ChecklistUtil.UpdateFormViewModel(this);

  constructor(element: JQuery<HTMLElement>, checklist: webapi.ChecklistDetails) {
    this.element = element;
    this.checklist = checklist;
  }
};
