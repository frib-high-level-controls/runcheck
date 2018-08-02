/**
 * The History object provides access to history-related functions
 */
/*global moment:false, changeTemplate:false*/

abstract class HistoryUtil {

  public static renderHistory(updates: any, selector?: string) {
    selector = typeof selector === 'undefined' ? '#history' : selector;
    if (Array.isArray(updates) && updates.length > 0) {
      $(selector).empty();
      for (const u of updates) {
        $(selector).prepend(changeTemplate({
          h: u,
          // moment: moment,
        }));
      }
    }
  }

  public static prependHistory(updates: any, selector?: string) {
    selector = typeof selector === 'undefined' ? '#history' : selector;
    const changeIds: any[] = [];
    $(selector).children('.change').each(function () {
        changeIds.push($(this).prop('id'));
    });
    if (Array.isArray(updates) && updates.length > 0) {
      for (const u of updates) {
        if (changeIds.indexOf(u._id) === -1) {
          $(selector).prepend(changeTemplate({
            h: u,
            // moment: moment,
          }));
        }
      }
    }
  }

}
