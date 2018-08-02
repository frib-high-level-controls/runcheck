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

  const slot: webapi.Slot = (window as any).slot;

  // Used to populate device selection for installation
  let devices: Array<{ id: string, text: string, disabled?: boolean }> | undefined;

  async function installationRender(selector: string, deviceId: string) {
    WebUtil.catchAll(async () => {
      $(selector).html(`
        <div class="text-center" style="font-size:24px;">
          <span class="fa fa-spinner fa-spin"/>
        </div>
      `).removeClass('hidden');

      let pkg: webapi.Pkg<webapi.Device>;
      try {
        pkg = await $.get({
          url: `${basePath}/devices/${deviceId}`,
          dataType: 'json',
        });
      } catch (xhr) {
        pkg = xhr.responseJSON;
        let message = 'Unknown error retrieving device';
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

      const details = deviceDetailsTemplate({
        device: pkg.data,
        embedded: true,
      });

      $('#install-panel').html(details).removeClass('hidden');
    });
  }

  $('#checklist-assign').click(WebUtil.wrapCatchAll1(async (evt) => {
    evt.preventDefault();
    $('#checklist-assign').addClass('hidden');
    $('#checklist-spin').removeClass('hidden');

    let pkg: webapi.Pkg<webapi.ChecklistDetails>;
    try {
      pkg = await $.ajax({
        url: `${basePath}/checklists`,
        contentType: 'application/json',
        data: JSON.stringify({
          data: {
            targetId: slot.id,
            targetType: 'SLOT',
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


  $('#install').click(WebUtil.wrapCatchAll1(async (evt) => {
    evt.preventDefault();
    $('#install').addClass('hidden');
    $('#install-spin').removeClass('hidden');

    if (!devices) {
      let pkg: webapi.Pkg<webapi.DeviceTableRow[]>;
      try {
        pkg = await $.get({
          url: `${basePath}/devices`,
          data: { deviceType: slot.deviceType },
          dataType: 'json',
        });
      } catch (xhr) {
        pkg = xhr.responseJSON;
        let message = 'Unknown error retrieving devices';
        if (pkg && pkg.error && pkg.error.message) {
          message = pkg.error.message;
        }
        $('#install-form').prepend(`
          <div class="alert alert-danger">
            <button class="close" data-dismiss="alert">x</button>
            <span>${message}</span>
          </div>
        `);
      }

      devices = [];
      if (pkg && Array.isArray(pkg.data)) {
        for (const device of pkg.data) {
          let text = `${device.name} (${device.desc})`;
          if (text.length > 48) {
            text = `${text.substr(0, 48)}...`;
          }
          devices.push({
            id: device.id,
            text: text,
            disabled: Boolean(device.installSlotName),
          });
        }
      }

      $('#install-name').select2({
        data: devices,
      });

      $('#install-date').datepicker({
        todayBtn: true,
        todayHighlight: true,
      }).datepicker('update', new Date());
    }

    $('#install-spin').addClass('hidden');
    $('#install-form').removeClass('hidden');
  }));

  $('#install-save').click(WebUtil.wrapCatchAll1(async (evt) => {
    evt.preventDefault();

    $('install-form').attr('disabled', 'disabled');
    const installDeviceId = $('#install-name').find(':selected').val();
    const installDeviceOn: Date | null = $('#install-date').datepicker('getUTCDate');

    let pkg: webapi.Pkg<webapi.SlotInstall>;
    try {

      const reqPkg: webapi.Pkg<webapi.SlotInstall> = {
        data: {
          installDeviceId: installDeviceId ? String(installDeviceId) : undefined,
          installDeviceOn: installDeviceOn ? installDeviceOn.toISOString().split('T')[0] : undefined,
        },
      };

      pkg = await $.ajax({
        url: `${basePath}/slots/${slot.id}/installation`,
        method: 'PUT',
        dataType: 'json',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(reqPkg),
      });

      if (!pkg.data.installDeviceId) {
        throw new Error('Invalid Device ID');
      }
    } catch (xhr) {
      pkg = xhr.responseJSON;
      let message = 'Unknown error installing device';
      if (pkg && pkg.error && pkg.error.message) {
        message = pkg.error.message;
      }
      $('#install-form').prepend(`
        <div class="alert alert-danger">
          <button class="close" data-dismiss="alert">x</button>
          <span>${message}</span>
        </div>
      `).removeAttr('disabled');
      return;
    }

    slot.installDeviceId = pkg.data.installDeviceId;
    slot.installDeviceId = pkg.data.installDeviceOn;
    slot.installDeviceBy = pkg.data.installDeviceBy;
    $('#install-form').addClass('hidden');
    installationRender('#install-panel', pkg.data.installDeviceId);
  }));

  $('#install-cancel').click(WebUtil.wrapCatchAll1(async (evt) => {
    evt.preventDefault();
    $('#install').removeClass('hidden');
    $('#install-form').addClass('hidden');
  }));


  if (slot.installDeviceId) {
    // $('#uninstall').removeClass('hidden');
    installationRender('#install-panel', slot.installDeviceId);
  } else {
    $('#install-panel').html(`
      <div>
        <span>No device installed</span>
      </div>
    `).removeClass('hidden');
    if (slot.canInstall) {
      $('#install').removeClass('hidden').removeAttr('disabled');
    } else {
      $('#install').removeClass('hidden').attr('disabled', 'disabled');
    }
  }

  if (slot.groupId) {
    $('#checklist-panel').removeClass('hidden').html(`
      <div>
        <h4>
          See the associated
          <a href="${basePath}/groups/slot/${slot.groupId}" target="_blank">Group</a>
        </h4>
      </div>
    `);
  } else if (slot.checklistId) {
    // if (slot.permissions.assign) {
    //   $('#checklist-unassign').removeClass('hidden').removeAttr('disabled');
    // } else {
    //   $('#checklist-unassign').removeClass('hidden').attr('disabled', 'disabled');
    // }
    ChecklistUtil.render('#checklist-panel', slot.checklistId);
  } else {
    $('#checklist-panel').html(`
      <div>
        <span>No checklist assigned</span>
      </div>
    `).removeClass('hidden');
    if (slot.canAssign) {
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
      GET_HISTORY_URI: `${basePath}/slots/${slot.id}/history`,
    },
    components: {
      'history-component': History,
    },
  });

  vm.$mount('#history');
});
