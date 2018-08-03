<template>
  <div>
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
  </div>
</template>


<script lang="ts">
import Vue from 'vue';

import UpdateItem from './UpdateItem.vue';

export default Vue.extend({
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
</script>
