/**
 * Common utilities for working with DataTables
 */
// tslint:disable:no-reference
/// <reference path="./datatablesutil.d.ts" />

let DataTablesUtil: datatablesutil.DataTablesUtil = (() => {

  function addFilterHead(tableQuery: string, columns: datatablesutil.ColumnSettings[]) {
    let t = $(tableQuery);
    let tr = $('<tr/>').appendTo(t.find('thead'));

    columns.forEach((column, idx) => {
      let th = $('<th></th>').appendTo(tr);
      if (column.searching) {
        th.append(`<input type="text" placeholder="${column.placeholder || ''}"
                       style="width:80%;" autocomplete="off">`);
        // Need a regular (non-arrow) function to capture 'this' properly!
        // tslint:disable only-arrow-functions
        th.on('keyup', 'input', function() {
          let elem = this; // aids type inference to avoid cast
          if (elem instanceof HTMLInputElement) {
            t.DataTable().column(idx).search(elem.value).draw();
          }
        });
      }
    });
  };

  return {
    addFilterHead: addFilterHead,
  };

})();
