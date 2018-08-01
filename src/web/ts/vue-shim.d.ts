// This is need for VS Code to propery resolve
// imported '*.vue' file (ie Single File Components)
// (see: https://github.com/Microsoft/TypeScript-Vue-Starter#single-file-components)
declare module "*.vue" {
  import Vue from "vue";
  export default Vue;
}
