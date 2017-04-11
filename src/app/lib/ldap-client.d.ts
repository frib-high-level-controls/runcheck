// Type definitions for ldap-client.js

import events = require('events');

interface LdapOptions {
  url: string;
  paging: boolean;
  timeout: number;
  reconnect: boolean;
  bindDN: string;
  bindCredentials: string;
}

export function create(options: LdapOptions): events.EventEmitter;
