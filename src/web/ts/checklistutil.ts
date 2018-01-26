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
  export type ChecklistStatusDetails = webapi.ChecklistStatusDetails & ChecklistUpdateStatus;
  export type ChecklistSubjectDetails = webapi.ChecklistSubjectDetails & ChecklistUpdateStatus;
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
        this.parent.updateForm.render();
      }));

      this.parent.element.find('.cl-edit-save').click(WebUtil.wrapCatchAll1(async (event) => {
        event.preventDefault();

        for (let subject of this.subjects) {
          let e = $(`#${subject.name}`);
          let remove = e.hasClass('hidden');
          let add = subject.name.match(/T\w{8}/);

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
    private parent: ChecklistUtil;
    
    
    private statuses: { [key: string]: ChecklistUtil.ChecklistStatusDetails | undefined } = {};

    constructor(parent: ChecklistUtil) {
      this.parent = parent;
    }

    public render(noUpdate?: boolean) {

      if (!noUpdate) {
        this.statuses = {};
        for (let status of this.parent.checklist.statuses) {
          this.statuses[status.subjectName] = status;
        }
      }

      // render the pre-compiled template
      this.parent.element.off().html(checklistInputTemplate({
        subjects: this.parent.checklist.subjects,
        statuses: this.statuses,
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
            // Should the comment be cleared?
            value.parents('.cl-subject').find('.cl-subject-status-comment').attr('disabled', 'disabled');
          }
          this.parent.element.find('.cl-update-save').removeAttr('disabled');
        });
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

      this.parent.element.on('click', '.cl-update-edit', WebUtil.wrapCatchAll1((evt) => {
        this.parent.editForm.render();
      }));

      this.parent.element.find('.cl-update-save').click(WebUtil.wrapCatchAll1(async (event) => {
        event.preventDefault();

        for (let subject of this.parent.checklist.subjects) {
          if (subject.canUpdate) {
            let e = $(`#${subject.name}`);
            let status = this.statuses[subject.name];
            let value = e.find('.cl-subject-status-value').val();
            let comment = e.find('.cl-subject-status-comment').val();
            if (status && (status.value === value) && (status.comment === comment)) {
              status.updateStatus = 'NONE';
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
                    value: value,
                    comment: comment,
                  },
                }),
                method: 'PUT',
                dataType: 'json',
              });
            } catch (xhr) {
              pkg = xhr.responseJSON;
              let message = 'Unknown error updating checklist status';
              //if (pkg && pkg.error && pkg.error.message) {
              //  message = pkg.error.message;
              //}
              message = WebUtil.unwrapPkgErrMsg(xhr, message);
              if (status) {
                status.updateStatus = 'FAIL';
                status.updateMessage = message;
                status.value = String(value);
                status.comment = String(comment);
              } else {
                // Create a placeholder status
                // to contain the error message
                status = {
                  updateStatus: 'FAIL',
                  updateMessage: message,
                  value: String(value),
                  comment: String(comment),
                  subjectName: subject.name,
                  history: {
                    updates: [],
                    updatedBy: 'UNKNOWN',
                    updatedAt: new Date().toISOString(),
                  },
                  inputBy: 'UNKNOWN',
                  inputAt: new Date().toISOString(),
                };
                this.statuses[status.subjectName] = status;
              }
              continue;
            }

            status = pkg.data;
            status.updateStatus = 'DONE';
            this.statuses[status.subjectName] = status;
          }
        }

        // re-render the template
        this.render(true);
      }));

      // ensure the checklist is visible
      this.parent.element.removeClass('hidden');
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
