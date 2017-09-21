/**
 * Type definitions for DataTablesUtil global
 */
declare module datatablesutil {
    
  export interface ColumnSettings extends DataTables.ColumnSettings {
    searching?: boolean
    placeholder?: string;
  }

  export interface DataTablesUtil {
    addFilterHead(tableQuery: string, columns: ColumnSettings[]): void;
  }
}
