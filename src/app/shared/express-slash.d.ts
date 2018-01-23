/**
 * Type declaration for the 'express-slash' package
 * See: https://www.npmjs.com/package/express-slash
 */
declare module 'express-slash' {

  import * as express from 'express';

  function expressSlash(statusCode?: number): express.RequestHandler;

  export = expressSlash;
}
