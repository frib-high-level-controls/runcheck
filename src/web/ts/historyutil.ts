/**
 * The History object provides access to history-related functions
 */
/*global moment:false, changeTemplate:false*/

abstract class HistoryUtil {

  public static renderHistory(updates: any, selector?: string) {
    selector = typeof selector === 'undefined' ? '#history' : selector;
    if (updates && updates.length > 0) {
      $(selector).empty();
      updates.forEach(function (u: any) {
      $(selector).prepend(changeTemplate({
          h: u,
          // moment: moment,
        }));
      });
    }
  };

  public static prependHistory(updates: any, selector?: string) {
    selector = typeof selector === 'undefined' ? '#history' : selector;
    let changeIds: any[] = [];
    $(selector).children('.change').each(function () {
        changeIds.push($(this).prop('id'));
    });
    if (updates && updates.length > 0) {
        updates.forEach(function (u: any) {
        if (changeIds.indexOf(u._id) === -1) {
          $(selector).prepend(changeTemplate({
            h: u,
            // moment: moment,
          }));
        }
      });
    }
  };

};
