/**
 * Implementation of the FORG API using LDAP as the data source.
 */
import * as Debug from 'debug';

import * as auth from '../shared/auth';
import * as forgapi from '../shared/forgapi';
import * as log from '../shared/logging';

import * as ldapjs from './ldapjs-client';


// The 'srcname' property is added to User to facilitate LDAP authentication.
export type User = forgapi.User & { srcname: string; source: string; };
export type SearchUser = forgapi.SearchUser;
export type SearchUserOptions = forgapi.SearchUsersOptions;

export type Group = forgapi.Group;
export type GroupType = forgapi.GroupType;
export type SearchGroup = forgapi.SearchGroup;
export type SearchGroupOptions = forgapi.SearchGroupsOptions;


interface LDAPEnity {
  [key: string]: {} | undefined;
}

export interface SafeUserEntity {
  dn: string;
  cn: string;
  an: string;
  memberOf: string[];
}

export interface SafeGroupEntity {
  dn: string;
  cn: string;
  an: string;
}

export interface ClientOptions {
  userSearch: ldapjs.SearchOptions;
  groupSearch: ldapjs.SearchOptions;
  userAttributes?: UserAttributes;
  groupAttributes?: GroupAttributes;
}

// Finally a use for Mapped Types!
export type UserAttributes = { [ P in keyof SafeUserEntity ]?: string };
export type GroupAttributes = { [ P in keyof SafeGroupEntity ]?: string };

const debug = Debug('runcheck:ldap-forgapi');

const SOURCE = 'LDAP';

const warn = log.warn;

const DEFAULT_USER_ATTRIBUTES = {
  dn: 'dn',             // Distingished Name attribute
  cn: 'cn',             // Common Name attribute
  an: 'sAMAccountName', // Account Name attribute
  memberOf: 'memberOf', // Group membership attribute
};

const DEFAULT_GROUP_ATTRIBUTES = {
  dn: 'dn',               // Distingished Name attribute
  cn: 'cn',               // Common Name attribute
  an: 'sAMAccountName',   // Account Name attribute
};

/**
 * Construct a RegExp that matches the given pattern
 *
 * Wildcard: * - match anything
 */
export function matchPattern(pattern: string, flags?: string): RegExp {
  // This snippet for escaping regex special characters is copied from MDN
  // See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
  pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  pattern = pattern.replace(/\\\*/g, '(.*)');
  return new RegExp('^' + pattern + '$', flags);
}



export class Client implements forgapi.IClient {

  // User LDAP attribute configuration
  private userAttributes: UserAttributes;

  // User LDAP search options configuration
  private userSearchOptions: ldapjs.SearchOptions;

  // Group LDAP attribute configuration
  private groupAttributes: GroupAttributes;

  // Group LDAP search options configuration
  private groupSearchOptions: ldapjs.SearchOptions;

  private ldapClient: ldapjs.Client;

  constructor(client: ldapjs.Client, options: ClientOptions) {
    this.ldapClient = client;
    this.userSearchOptions = options.userSearch;
    this.groupSearchOptions = options.groupSearch;
    this.userAttributes = options.userAttributes || {};
    this.groupAttributes = options.groupAttributes || {};
    debug('LDAP Auth Provider options: %s', JSON.stringify(options, null, 4));
  }

  public getUserSearchOptions() {
    return this.userSearchOptions;
  }
  public setUserSearchOptions(options: ldapjs.SearchOptions) {
    this.userSearchOptions = options;
  }

  public getUserAttributes() {
    return this.userAttributes;
  }
  public setUserAttributes(attrs: UserAttributes) {
    this.userAttributes = attrs;
  }

  public getGroupAttributes() {
    return this.userAttributes;
  }
  public setGroupAttributes(attrs: GroupAttributes) {
    this.groupAttributes = attrs;
  }

  public getGroupSearchOptions() {
    return this.groupSearchOptions;
  }
  public setGroupSearchOptions(options: ldapjs.SearchOptions) {
    this.groupSearchOptions = options;
  }

  public async findUsers(): Promise<User[]> {
    debug(`Find users with base: '%s', filter: '%s'`, this.userSearchOptions.base, this.userSearchOptions.filter);
    const entities = await this.ldapClient.search<LDAPEnity>(this.userSearchOptions);
    const users: User[] = [];
    for (const entity of entities) {
      const user = this.enityToUser(entity);
      if (user) {
        users.push(user);
      }
    }
    return users;
  }

  public async findUser(uid: string): Promise<User | null> {
    uid = uid.toUpperCase();
    let filter = `(${this.userAttributes.an || DEFAULT_USER_ATTRIBUTES.an}=${uid})`;
    if (this.userSearchOptions.filter) {
      filter = `(&${this.userSearchOptions.filter}${filter})`;
    }
    const options = Object.assign({}, this.userSearchOptions, { filter });
    debug(`Find user with base: '%s', filter: '%s'`, options.base, options.filter);

    const entities = await this.ldapClient.search<LDAPEnity>(options);
    for (const entity of entities) {
      const user = this.enityToUser(entity);
      if (user && uid === user.uid.toUpperCase()) {
        return user;
      }
    }

    return null;
  }

  public async searchUsers(opts: SearchUserOptions): Promise<SearchUser[]> {
    debug('Search users with options: %j', opts);
    const users = await this.findUsers();

    const search: SearchUser[] = [];
    for (const user of users) {
      let conds = 0;
      let found = 0;
      if (opts.fullname) {
        conds += 1;
        if (user.fullname.match(matchPattern(opts.fullname, 'i'))) {
          found += 1;
        }
      }
      if (opts.role) {
        conds += 1;
        if (user.roles.includes(opts.role.toUpperCase())) {
          found += 1;
        }
      }
      if (conds === found) {
        search.push({
          uid: user.uid,
          fullname: user.fullname,
          role: auth.formatRole(auth.RoleScheme.USR, user.uid),
        });
      }
    }

    return search;
  }

  public async findGroups(): Promise<Group[]> {
    debug(`Find groups with base: '%s', filter: '%s'`, this.groupSearchOptions.base, this.groupSearchOptions.filter);
    const entities = await this.ldapClient.search<LDAPEnity>(this.groupSearchOptions);
    const groups: Group[] = [];
    for (const entity of entities) {
      const group = this.entityToGroup(entity);
      if (group) {
        groups.push(group);
      }
    }
    return groups;
  }

  public async findGroup(uid: string): Promise<Group | null> {
    uid = uid.toUpperCase();
    if (!uid.startsWith(`${SOURCE}:`)) {
      return null;
    }
    uid = uid.substr(0, SOURCE.length + 1);

    let filter = `(${this.groupAttributes.an || DEFAULT_GROUP_ATTRIBUTES.an}=${uid})`;
    if (this.groupSearchOptions.filter) {
      filter = `(&${this.groupSearchOptions.filter}${filter})`;
    }
    const options = Object.assign({}, this.groupSearchOptions, { filter });
    debug(`Find group with base : '%s', filter: '%s'`, options.base, options.filter);

    const entities = await this.ldapClient.search<LDAPEnity>(options);
    for (const entity of entities) {
      const group = this.entityToGroup(entity);
      if (group && uid === group.uid.toUpperCase()) {
        return group;
      }
    }
    return null;
  }

  public async searchGroups(opts: SearchGroupOptions): Promise<SearchGroup[]> {
    debug('Search groups with options: %j', opts);
    const groups = await this.findGroups();

    const search: SearchGroup[] = [];
    for (const group of groups) {
      let conds = 0;
      let found = 0;
      if (opts.srcname) {
        conds += 1;
        if (group.srcname.match(matchPattern(opts.srcname, 'i'))) {
          found += 1;
        }
      }
      if (opts.fullname) {
        conds += 1;
        if (group.fullname.match(matchPattern(opts.fullname, 'i'))) {
          found += 1;
        }
      }
      if (opts.leader) {
        conds += 1;
        if (group.leader.toUpperCase() === opts.leader.toUpperCase()) {
          found += 1;
        }
      }
      if (opts.source) {
        conds += 1;
        if (group.source.toUpperCase() === opts.source.toUpperCase()) {
          found += 1;
        }
      }
      if (opts.type) {
        conds += 1;
        if (group.type.toUpperCase() === opts.type.toUpperCase()) {
          found += 1;
        }
      }
      if (conds === found) {
        search.push({
          uid: group.uid,
          srcname: group.srcname,
          fullname: group.fullname,
          source: group.source,
          type: group.type,
          role: auth.formatRole(auth.RoleScheme.GRP, group.uid),
        });
      }
    }

    return search;
  }


  protected enityToUser(entity: LDAPEnity): User | null {
    let attrname = this.userAttributes.cn || DEFAULT_USER_ATTRIBUTES.cn;
    let attrvalue = entity[attrname];
    const cn = attrvalue ? String(attrvalue).trim() : null;
    if (!cn) {
      warn('LDAP FORG API: User entity \'%s\' is invalid: %s', attrname, attrvalue);
      return null;
    }

    attrname = this.userAttributes.dn || DEFAULT_USER_ATTRIBUTES.dn;
    attrvalue = entity[attrname];
    const dn = attrvalue ? String(attrvalue).trim() : null;
    if (!dn) {
      warn('LDAP FORG API: User entity \'%s\' is invalid: %s', attrname, attrvalue);
      return null;
    }

    attrname = this.userAttributes.an || DEFAULT_USER_ATTRIBUTES.an;
    attrvalue = entity[attrname];
    const an = attrvalue ? String(attrvalue).trim().toUpperCase() : null;
    if (!an) {
      warn('LDAP FORG API: User entity \'%s\' is invalid: %s', attrname, attrvalue);
      return null;
    }

    attrname = this.userAttributes.memberOf || DEFAULT_USER_ATTRIBUTES.memberOf;
    attrvalue = entity[attrname];
    const memberOf = Array.isArray(attrvalue) ? attrvalue.map((v) => (String(v).trim().toUpperCase())) : [];

    return {
      uid: an,
      fullname: cn,
      roles: [ auth.formatRole(auth.RoleScheme.USR, an) ].concat(memberOf),
      srcname: dn,
      source: SOURCE,
    };
  }

  protected entityToGroup(entity: LDAPEnity): Group | null {
    let attrname = this.groupAttributes.cn || DEFAULT_GROUP_ATTRIBUTES.cn;
    let attrvalue = entity[attrname];
    const cn = attrvalue ? String(attrvalue).trim() : null;
    if (!cn) {
      warn('LDAP FORG API: Group entity \'%s\' is invalid: %s', attrname, attrvalue);
      return null;
    }

    attrname = this.groupAttributes.dn || DEFAULT_GROUP_ATTRIBUTES.dn;
    attrvalue = entity[attrname];
    const dn = attrvalue ? String(attrvalue).trim() : null;
    if (!dn) {
      warn('LDAP FORG API: Group entity \'%s\' is invalid: %s', attrname, attrvalue);
      return null;
    }

    attrname = this.groupAttributes.an || DEFAULT_GROUP_ATTRIBUTES.an;
    attrvalue = entity[attrname];
    const an = attrvalue ? String(attrvalue).trim().toUpperCase() : null;
    if (!an) {
      warn('LDAP FORG API: Group entity \'%s\' is invalid: %s', attrname, attrvalue);
      return null;
    }

    let type: GroupType = 'UNKNOWN';
    if (an.match(/^AREA(\.[^.]+)+$/)) {
      type = 'AREA';
    } else if (an.match(/^LAB(\.[^.]+){1}$/)) {
      type = 'LAB';
    } else if (an.match(/^LAB(\.[^.]+){2}$/)) {
      type = 'DIV';
    } else if (an.match(/^LAB(\.[^.]+){3}$/)) {
      type = 'DEPT';
    } else if (an.match(/^LAB(\.[^.]+){4}$/)) {
      type = 'GROUP';
    } else if (an.match(/^LAB(\.[^.]+)+$/)) {
      type = 'TEAM';
    }

    return {
      uid: `${SOURCE}:${an}`,
      srcname: dn,
      fullname: cn,
      leader: 'UNKNOWN',
      source: SOURCE,
      type: type,
    };
  }
}
