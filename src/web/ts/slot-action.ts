/**
 * Support user interaction on Device details view.
 */

$(() => {

  let slot: webapi.Slot = (<any> window).slot;

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

      let details = deviceDetailsTemplate({
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
        for (let device of pkg.data) {
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
    let installDeviceId = $('#install-name').find(':selected').val();
    let installDeviceOn: Date | null = $('#install-date').datepicker('getUTCDate');

    let pkg: webapi.Pkg<webapi.SlotInstall>;
    try {
      pkg = await $.ajax({
        url: `${basePath}/slots/${slot.id}/installation`,
        method: 'PUT',
        dataType: 'json',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(<webapi.Pkg<webapi.SlotInstall>> {
          data: {
            installDeviceId: installDeviceId ? String(installDeviceId) : undefined,
            installDeviceOn: installDeviceOn ? installDeviceOn.toISOString().split('T')[0] : undefined,
          },
        }),
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

  const PathItem = Vue.extend({
    template: `      
      <li class="list-group-item">
        <strong>{{pathData.name | humanize}}
          <div class="text-danger bg-danger pull-right">
            {{pathData.value}}
          </div>
        </strong>
      </li>`,
    props: {
      pathData: {
        type: Object as () => webapi.Path,
        required: true,
      },
    },
    filters: {
      humanize: function(value: string) {
        let newVal = '';
        switch (value.toLowerCase()) {
          case 'desc':
            newVal =  'Description';
            break;
          case 'carelevel':
            newVal =  'Level of Care';
            break;
          case 'safetylevel':
            newVal = 'Level of Safety';
            break;
          case 'drr':
          case 'arr':
            newVal = value.toUpperCase();
            break;
          default:
            return value
            // decamelize
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str) => {return str.toUpperCase(); })
            // capitalize ID
            .replace(/(Id)/g, (l) => l.toUpperCase());
        }
        return newVal;
      },
    },
  });

  const UpdateItem = Vue.extend({
    template: `
    <div class="panel panel-default">
      <div class="panel-heading">
        <a class="text-info collapsed" role="button" data-toggle="collapse" 
        :href="updateLink" aria-expanded="false">
        {{updateDate}}
          <div class="pull-right">{{updateData.by}}</div>
        </a> 
      </div>
      <div class="panel-collapse collapse" :id="updateID" role="tabpanel" 
      aria-expanded="false" style="height: 0px;">
        <ol class="list-group">
          <path-item v-for="(path, index) in updateData.paths" :path-data=path :key=index></path-item>
        </ol>
      </div>
    </div>`,
    props: {
      updateData: {
        type: Object as () => webapi.Update,
        required: true,
      },
      index: {
        type: Number,
        required: true,
      },
    },
    components: {
      'path-item': PathItem,
    },
    computed: {
      updateID(): string {
        return 'update' + this.index;
      },
      updateLink(): String {
        return '#' + this.updateID;
      },
      updateDate(): string {
        return moment(new Date(this.updateData.at))
          .format('MMM D, YYYY [at] h:m:s A');
      },
    },
  });

  const LoadingPanel = Vue.extend({
    template: `
      <div class="panel panel-default">
        <div class="panel-body">
          <div class="text-center" style="font-size:24px;">
            <span class="fa fa-spinner fa-spin"></span>
          </div>
        </div>
      </div> 
    `,
  });

  const HistoryComponent = Vue.extend({
    template: `
      <div class="panel-group" :class="{scrollable: updates.length > 12}">
        <h3 v-if="errorState">Error Loading history</h3>
        <update-item
          v-else 
          v-for="(update, index) in updates" 
          :key="index" 
          :index="index" 
          :update-data="update">
        </update-item>
      </div>
    `,
    props: {
      updates: {
        type: Array as () => webapi.Update[],
      },
      errorState: {
        type: Boolean,
      },
    },
    components: {
      'update-item': UpdateItem,
    },
  });

  const GET_URI = `${basePath}/slots/${slot.id}/history`;
  const vm = new Vue({
    template: `
      <div>
        <h2>History</h2>
        <component :is="component" v-bind="childProps"></component>
      </div>
    `,
    data: {
      updates: Array as () => webapi.Update[],
      loading: true,
      errorState: false,
    },
    computed: {
      component: function() {
        if (this.loading) {
          return 'loading-panel';
        } else {
          return 'history-component';
        }
      },
      childProps: function() {
        if (!this.loading) {
          return {
            updates: this.updates,
            errorState: this.errorState,
          };
        }
      },
    },
    components: {
      'loading-panel': LoadingPanel,
      'history-component': HistoryComponent,
    },
    mounted () {
      axios
        .get(GET_URI)
        .then((response) => {
          this.updates = response.data.data;
        })
        .catch((error) => {
          this.errorState = true;
        })
        // basically a finally
        .then(() => this.loading = false);
    },
  });

  vm.$mount('#history');
});
