/**
 * Utilities for working with jQuery events
 */

abstract class WebUtil {

  /**
   * Execute the function and log either the thrown exception
   * or the value of the rejected promise.
   *
   * Note that 'Promise.resolve().then(f).catch(console.err)'
   * has similar behavior to this function (using less code),
   * however, the difference is it does NOT execute f() synchronously.
   */
  public static catchAll(f: () => void | Promise<void>): void {
    try {
      Promise.resolve(f()).catch(console.error);
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Wraps catchAll() for use use as callback function (ie event handlers).
   *
   * To facitate better type checking customized functions have been
   * implemented for wrapping functions with up to 4 arguments.
   * (Is there a better way this could be implemented?)
   */
  public static wrapCatchAll<A, B, C, D>(f: (a?: A, b?: B, c?: C, d?: D) => void | Promise<void>):
      (a?: A, b?: B, c?: C, d?: D) => void {
    return (a, b, c, d) => {
      WebUtil.catchAll(() => {
        f(a, b, c, d);
      });
    };
  }

  public static wrapCatchAll0(f: () => void | Promise<void>): () => void {
    return () => {
      WebUtil.catchAll(() => {
        f();
      });
    };
  }

  public static wrapCatchAll1<A>(f: (a: A) => void | Promise<void>): (a: A) => void {
    return (a) => {
      WebUtil.catchAll(() => {
        f(a);
      });
    };
  }

  public static wrapCatchAll2<A, B>(f: (a: A, b: B) => void | Promise<void>): (a: A, b: B) => void {
    return (a, b) => {
      WebUtil.catchAll(() => {
        f(a, b);
      });
    };
  }

  public static wrapCatchAll3<A, B, C>(f: (a: A, b: B, c: C) => void | Promise<void>): (a: A, b: B, c: C) => void {
    return (a, b, c) => {
      WebUtil.catchAll(() => {
        f(a, b, c);
      });
    };
  }

  public static wrapCatchAll4<A, B, C, D>(f: (a: A, b: B, c: C, d: D) => void | Promise<void>):
      (a: A, b: B, c: C, d: D) => void {
    return (a, b, c, d) => {
      WebUtil.catchAll(() => {
        f(a, b, c, d);
      });
    };
  }
}
