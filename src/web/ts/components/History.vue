<template>
    <div>
        <h2>History</h2>
        <component :is="component" v-bind="childProps"></component>
    </div>
</template>

<script lang="ts">
    import axios from 'axios';
    import Vue from 'vue';
    import HistoryPanel from './HistoryPanel.vue';
    import LoadingPanel from './LoadingPanel.vue';

    export default Vue.extend({
        props: {
            GET_URI: {
                type: String,
            },
        },
        data() {
            return {
                updates: Array as () => webapi.Update[],
                loading: true,
                errorState: false,
            };
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
            'history-component': HistoryPanel,
        },
        mounted() {
            axios
                .get(this.GET_URI)
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
</script>
