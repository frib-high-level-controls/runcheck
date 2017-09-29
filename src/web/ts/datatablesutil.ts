/**
 * Common utilities for working with DataTables
 */
// tslint:disable:no-reference
/// <reference path="./datatablesutil.d.ts" />

abstract class DataTablesUtil {

  public static addFilterHead(tableQuery: string, columns: datatablesutil.ColumnSettings[]) {
    let t = $(tableQuery);
    let tr = $('<tr/>').appendTo(t.find('thead'));

    columns.forEach((column, idx) => {
      let th = $('<th></th>').appendTo(tr);
      if (column.searching) {
        th.append(`<input type="text" placeholder="${column.placeholder || ''}"
                       style="width:80%;" autocomplete="off">`);
        // Need a regular (non-arrow) function to capture 'this' properly!
        // tslint:disable only-arrow-functions
        th.on('keyup', 'input', (evt) => {
          if (evt.target instanceof HTMLInputElement) {
            const input = $(evt.target).val();
            if (typeof input === 'string') {
              t.DataTable().column(idx).search(input).draw();
            }
          }
        });
      }
    });
  };

};
