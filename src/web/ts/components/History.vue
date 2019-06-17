<template>
    <div>
        <h2>History</h2>
        <component :is="component" v-bind="childProps"></component>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import WebUtil from '../webutil-shim';
    import HistoryPanel from './HistoryPanel.vue';
    import LoadingPanel from './LoadingPanel.vue';

    interface CompProps {
        GET_URI: string;
    }

    interface CompData {
        updates: webapi.Update[];
        loading: boolean;
        errorState: boolean;
    }

    export default Vue.extend<CompData, unknown, unknown, CompProps>({
        props: {
            GET_URI: {
                type: String,
            },
        },
        data() {
            return {
                updates: new Array<webapi.Update>(),
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
            WebUtil.catchAll(async () => {
                let pkg: webapi.Pkg<webapi.Update[]>;
                try {
                    pkg = await $.ajax({
                        url: this.GET_URI,
                        contentType: 'application/json',
                        method: 'GET',
                        dataType: 'json',
                    });
                } catch (xhr) {
                    pkg = xhr.responseJSON;
                    this.errorState = true;
                    return;
                } finally {
                    this.loading = false;
                }
                this.updates = pkg.data.reverse();
            });
        },
    });
</script>
