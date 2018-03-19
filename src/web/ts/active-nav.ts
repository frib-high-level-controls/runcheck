/**
 * Mark the correct nav element as active based on current URL.
 */
$(() => {
  function resolvePath(path: string): string {
    let splitPath = path.split('/');
    if (splitPath[0] === '') {
      return path;
    }
    let splitLocation = location.pathname.split('/');
    if (splitLocation[splitLocation.length - 1] !== '') {
      splitLocation.pop();
    }
    for (let s of splitPath) {
      switch (s) {
      case '.':
        continue;
      case '..':
        splitLocation.pop();
        continue;
      default:
        splitLocation.push(s);
        continue;
      }
    }
    return splitLocation.join('/');
  }

  $('header .navbar-nav > li').each((idx, elem) => {
    if ($(elem).hasClass('dropdown')) {
      $(elem).find('.dropdown-menu > li').each((i, e) => {
        let href = $(e).children('a').first().attr('href');
        if (href && location.pathname === resolvePath(href.split('?')[0])) {
          $(elem).addClass('active');
        }
      });
    } else {
      let href = $(elem).children('a').first().attr('href');
      if (href && location.pathname === resolvePath(href.split('?')[0])) {
        $(elem).addClass('active');
      }
    }

  });
});
