/**
 * Support user interaction on Device details view.
 */
import Vue from 'vue';

// For now JQuery is included globally,
// in the future it may need to be imported.
// import * as $ from 'jquery';

import ChecklistUtil from './checklistutil-shim';
import History from './components/History.vue';
import WebUtil from './webutil-shim';
$(() => {

  const device: webapi.Device = (window as any).device;

  function installationRender(selector: string, slotId: string) {
    WebUtil.catchAll(async () => {
      $(selector).html(`
        <div class="text-center" style="font-size:24px;">
          <span class="fa fa-spinner fa-spin"/>
        </div>
      `).removeClass('hidden');

      let pkg: webapi.Pkg<webapi.Slot>;
      try {
        pkg = await $.get({
          url: `${basePath}/slots/${slotId}`,
          dataType: 'json',
        });
      } catch (xhr) {
        pkg = xhr.responseJSON;
        let message = 'Unknown error retrieving Slot';
        if (pkg && pkg.error && pkg.error.message) {
          message = pkg.error.message;
        }
        $(selector).html(`
          <div>
            <span class="text-danger">${message}</span>
          </div>
        `).removeClass('hidden');
        return;
      }

      const details = slotDetailsTemplate({
        slot: pkg.data,
        embedded: true,
      });

      $(selector).html(details).removeClass('hidden');
    });
  }


  // register event handlers

  $('#checklist-assign').click(WebUtil.wrapCatchAll1(async (evt) => {
      evt.preventDefault();
      $('#checklist-assign').addClass('hidden');
      $('#checklist-spin').removeClass('hidden');

      let pkg: webapi.Pkg<webapi.ChecklistDetails>;
      try {
        pkg = await $.get({
          url: `${basePath}/checklists`,
          contentType: 'application/json',
          data: JSON.stringify({
            data: {
              targetId: device.id,
              targetType: 'DEVICE',
            },
          }),
          method: 'POST',
          dataType: 'json',
        });
      } catch (xhr) {
        pkg = xhr.responseJSON;
        let message = 'Unknown error assigning checklist';
        if (pkg && pkg.error && pkg.error.message) {
          message = pkg.error.message;
        }
        $('#checklist-spin').addClass('hidden');
        $('#checklist-assign').removeClass('hidden');
        $('#checklist-panel').prepend(`
          <div class="alert alert-danger">
            <button class="close" data-dismiss="alert">x</button>
            <span>${message}</span>
          </div>
        `).removeClass('hidden');
        return;
      }

      $('#checklist-spin').addClass('hidden');
      $('#checklist-panel').removeClass('hidden');
      ChecklistUtil.render('#checklist-panel', pkg.data);
  }));

  if (device.installSlotId) {
    installationRender('#install-panel', device.installSlotId);
  } else {
    $('#install-panel').html(`
      <div>
        <span>Device not installed</span>
      </div>
    `).removeClass('hidden');
  }

  if (device.checklistId) {
    // if (slot.permissions.assign) {
    //   $('#checklist-unassign').removeClass('hidden').removeAttr('disabled');
    // } else {
    //   $('#checklist-unassign').removeClass('hidden').attr('disabled', 'disabled');
    // }
    ChecklistUtil.render('#checklist-panel', device.checklistId);
  } else {
    $('#checklist-panel').html(`
      <div>
        <span>No checklist assigned</span>
      </div>
    `).removeClass('hidden');
    if (device.canAssign) {
      $('#checklist-assign').removeClass('hidden').removeAttr('disabled');
    } else {
      $('#checklist-assign').removeClass('hidden').attr('disabled', 'disabled');
    }
  }

  const vm = new Vue({
    template: `
      <div>
        <history-component :GET_URI = "GET_HISTORY_URI"></history-component>
      </div>
    `,
    data: {
      GET_HISTORY_URI: `${basePath}/devices/${device.id}/history`,
    },
    components: {
      'history-component': History,
    },
  });

  vm.$mount('#history');
});
