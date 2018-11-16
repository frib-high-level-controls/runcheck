/**
 * Implementation of the LDAP authentication provider.
 */
import * as Debug from 'debug';
import * as express from 'express';
import * as passport from 'passport';
import * as pplocal from 'passport-local';

import * as auth from '../shared/auth';
import * as ppauth from '../shared/passport-auth';

import * as forgapi from './ldap-forgapi';
import * as ldapjs from './ldapjs-client';

const debug = Debug('runcheck:ldap-auth');

/// Consider moving this to shared library, passport-auth.ts ///
export interface FormPassportProviderOptions {
  usernameField?: string;
  passwordField?: string;
  session?: boolean;
  // passReqToCallback?: false;
}

export type VerifyCallback = (err: any, user?: auth.IUser | false, options?: { message?: string; }) => void;

export abstract class FormPassportAbstractProvider<AO extends passport.AuthenticateOptions>
    extends ppauth.PassportAbstractProvider<pplocal.Strategy, AO> {

  protected strategy: pplocal.Strategy;

  constructor(options: FormPassportProviderOptions) {
    super();
    if (debug.enabled) {
      debug('Form Auth Provider options: %s ', JSON.stringify(options));
    }
    this.strategy = new pplocal.Strategy(options, (username, password, done) => {
      this.verify(username, password, done);
    });
  }

  protected getStrategy(): pplocal.Strategy {
    return this.strategy;
  }

  protected abstract verify(username: string, password: string, done: VerifyCallback): void;
}
////////////////////////////////////////////////////////////////


export type LDAPFormProviderOptions = FormPassportProviderOptions;

export class LDAPFormPassportProvider extends FormPassportAbstractProvider<passport.AuthenticateOptions> {

  private forgClient: forgapi.Client;

  private ldapClient: ldapjs.IClient;

  constructor(ldapClient: ldapjs.IClient, forgClient: forgapi.Client, options: LDAPFormProviderOptions) {
    super(options);
    this.ldapClient = ldapClient;
    this.forgClient = forgClient;
  }

  public getUsername(req: express.Request): string | undefined {
    const user = this.getUser(req);
    if (!user) {
      return;
    }
    return user.uid ? String(user.uid) : undefined;
  }

  public getRoles(req: express.Request): string[] | undefined {
    const user = this.getUser(req);
    if (!user) {
      return;
    }
    return Array.isArray(user.roles) ? user.roles.map(String) : undefined;
  }

  protected verify(username: string, password: string, done: VerifyCallback): void {
    Promise.resolve().then(async () => {
      const user = await this.forgClient.findUser(username);
      if (user === null) {
        done(null, false, { message: 'Username is incorrect' });
        return;
      }
      const success = await this.ldapClient.bind(user.srcname, password, true);
      if (success !== true) {
        done(null, false, { message: 'Password is incorrect' });
        return;
      }
      debug('User verified: %j', user);
      done(null, user);
    })
    .catch((err) => {
      done(err);
    });
  }
}
