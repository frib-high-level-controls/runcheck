<template>
  <div>
    <table class="table table-bordered">
      <thead>
        <tr>
          <th>Machine Mode</th>
          <th>Beam Inhibit Mode</th>
          <th>Total Slots</th>
          <th>Approved Slots</th>
          <th>Operation Permitted</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="mode in modes" :key="mode.name">
          <th>{{ mode.machineMode }}</th>
          <th>{{ mode.inhibitMode }}</th>
          <td>{{ mode.totalSlots }}</td>
          <td>{{ mode.totalApproved }}</td>
          <th class="success" v-if="mode.permitted">Yes</th>
          <th class="danger"  v-else>No</th>
        </tr>
      </tbody>
    </table>
    <span class="small pull-right" v-if="lastLoadAt">Updated: {{ lastLoadAt.format('MMM D YYYY, h:mm:ss A') }}</span>
    <span class="small pull-right" v-else>Loading</span>
  </div>
</template>

<script lang="ts">
  import Vue from 'vue';

  import WebUtil from '../webutil-shim';

  interface MachineModePermit {
    name: string;
    machineMode: string;
    inhibitMode: string;
    totalSlots: number;
    totalApproved: number;
    permitted: boolean;
  }

  export default Vue.extend({
    props: {
      url: {
        type: String,
      },
      update: {
        type: Number,
        default: 0,
      },
    },
    data() {
      return {
        modes: [] as MachineModePermit[],
        lastLoadAt: null as (moment.Moment | null),
      };
    },
    methods: {
      load() {
        WebUtil.catchAll(async () => {
          const pkg: webapi.Pkg<webapi.api2.Slot[]> = await $.get({
            url: this.url,
            dataType: 'json',
          });

          const data: { [name: string]: MachineModePermit | undefined} = {};
          for (const slot of pkg.data) {
            for (let name of slot.machineModes) {
              name = name.toUpperCase();

              let mode = data[name];
              if (!mode) {
                const sname = name.split(/-0*/, 2);
                mode = {
                  name,
                  machineMode: (sname.length > 0) ? sname[0] : 'N/A',
                  inhibitMode: (sname.length > 1) ? sname[1] : 'N/A',
                  totalSlots: 0,
                  totalApproved: 0,
                  permitted: false,
                };
                data[name] = mode;
              }

              mode.totalSlots += 1;
              if (slot.approved) {
                mode.totalApproved += 1;
              }
              mode.permitted = (mode.totalSlots === mode.totalApproved);
            }
          }
          // Convert data from object to array (sorted by name)
          const modes: MachineModePermit[] = [];
          for (const name of Object.keys(data).sort()) {
            const mode = data[name];
            if (mode) {
              modes.push(mode);
            }
          }
          this.modes = modes;

          this.lastLoadAt = moment();
        });
      },
    },
    mounted() {
      // Load data from application API
      this.load();
      // Reload data after the given interval
      if (this.update > 0) {
        setInterval(this.load, this.update * 1000);
      }
    },
  });
</script>