/**
 * Implementation of the LDAP authentication provider.
 */
import * as Debug from 'debug';
import * as express from 'express';
import * as passport from 'passport';
import * as pplocal from 'passport-local';

import * as auth from '../shared/auth';
import * as log from '../shared/logging';
import * as ppauth from '../shared/passport-auth';

import * as forgapi from './ldap-forgapi';
import * as ldapjs from './ldapjs-client';

const debug = Debug('runcheck:ldap-auth');

type Strategy = passport.Strategy;

type AuthenticateOptions = passport.AuthenticateOptions;

export interface FormPassportProviderOptions {
  usernameField?: string;
  passwordField?: string;
  session?: boolean;
  // passReqToCallback?: false;
}

/// Consider moving this to shared library, forg-auth.ts ///
export abstract class ForgPassportAbstractProvider<S extends Strategy, AO extends AuthenticateOptions>
  extends ppauth.PassportAbstractProvider<S, AO> {

  private forgClient: forgapi.Client;

  constructor(forgClient: forgapi.Client) {
    super();
    this.forgClient = forgClient;
  }

  protected verifyWithForg(username: string): Promise<forgapi.User | null> {
    return this.forgClient.findUser(username);
  }
}
////////////////////////////////////////////////////////////////


export abstract class FormForgPassportAbstractProvider<AO extends passport.AuthenticateOptions>
    extends ForgPassportAbstractProvider<pplocal.Strategy, AO> {

  protected strategy: pplocal.Strategy;

  constructor(forgClient: forgapi.Client, options: FormPassportProviderOptions) {
    super(forgClient);
    if (debug.enabled) {
      debug('Form Auth Provider options: %s ', JSON.stringify(options));
    }
    this.strategy = new pplocal.Strategy(options, (username, password, done) => {
      this.verify(username, password).then(({ user, message }) => {
        if (message) {
          done(null, user || false, { message });
        } else {
          done(null, user || false);
        }
      })
      .catch((err: any) => {
        done(err);
      });
    });
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

  protected getStrategy(): pplocal.Strategy {
    return this.strategy;
  }

  protected abstract verify(username: string, password: string): Promise<{ user?: auth.IUser, message?: string; }>;
}



export type LDAPFormProviderOptions = FormPassportProviderOptions;

export class LDAPFormForgPassportProvider extends FormForgPassportAbstractProvider<AuthenticateOptions> {

  private ldapClient: ldapjs.IClient;

  constructor(forgClient: forgapi.Client, ldapClient: ldapjs.IClient, options: LDAPFormProviderOptions) {
    super(forgClient, options);
    this.ldapClient = ldapClient;
  }

  protected async verify(username: string, password: string): Promise<{ user?: auth.IUser, message?: string; }> {
    const user = await this.verifyWithForg(username);
    if (user === null) {
      return { message: 'Username is incorrect' };
    }
    const success = await this.ldapClient.bind(user.srcname, password, true);
    if (success !== true) {
      return { message: 'Password is incorrect' };
    }
    return { user };
  }
}

export class DevFormForgPassportProvider extends FormForgPassportAbstractProvider<AuthenticateOptions> {

  constructor(forgClient: forgapi.Client, options: LDAPFormProviderOptions) {
    super(forgClient, options);
  }

  protected async verify(username: string, password: string): Promise<{ user?: auth.IUser, message?: string; }> {
    const env = process.env.NODE_ENV ? process.env.NODE_ENV : 'development';
    if (env === 'production') {
      log.warn('Development Form Auth Provider DISABLED: PRODUCTION ENVIRONMENT DETECTED');
      return { message: 'Provider is disabled' };
    }
    log.warn('Development Form Auth Provider ENABLED: PASSWORD VERIFICATION DISABLED');
    const user = await this.verifyWithForg(username);
    if (user === null) {
      return { message: 'Username is incorrect' };
    }
    return { user };
  }
}
