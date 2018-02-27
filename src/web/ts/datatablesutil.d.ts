/**
 * Type definitions for DataTablesUtil global
 */

// TODO: this namespace should be refactored to class
// tslint:disable:no-namespace
declare namespace datatablesutil {

  export interface ColumnSettings extends DataTables.ColumnSettings {
    searching?: boolean;
    placeholder?: string;
  }

  export interface DataTablesUtil {
    addFilterHead(tableQuery: string, columns: ColumnSettings[]): void;
  }
}
