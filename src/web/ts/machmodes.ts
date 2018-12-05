/**
 * Machine Mode report
 */
import Vue from 'vue';

import MachineModeTable from './components/MachModeTable.vue';

const vm = new Vue({
  components: {
    'machine-mode-table': MachineModeTable,
  },
});

vm.$mount('#machmodes');
