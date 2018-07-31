
<template>
  <div>
    <li class="list-group-item">
        <strong>{{pathData.name | humanize}}
          <div class="text-danger bg-danger pull-right">
            {{pathData.value}}
          </div>
        </strong>
      </li>
  </div>
</template>


<script lang="ts">
import Vue from 'vue';

export default Vue.extend({
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
</script>