<template>
  <div>
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
    </div>
  </div>
</template>

<script lang="ts">
  import Vue from 'vue';

  import PathItem from './PathItem.vue';

  export default Vue.extend({
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
      updateLink(): string {
        return '#' + this.updateID;
      },
      updateDate(): string {
        return moment(new Date(this.updateData.at))
          .format('MMM D, YYYY [at] h:mm:ss A');
      },
    },
  });
</script>
