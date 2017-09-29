
/* tslint:disable:member-ordering */

abstract class AuthUtil {

  private static username?: string;

  private static roles: string[] = [];

  public static getUsername(): string | undefined {
    return AuthUtil.username;
  };

  public static setUsername(username?: string) {
    if (typeof username === 'string') {
      AuthUtil.username = username.toUpperCase();
    } else {
      AuthUtil.username = undefined;
    }
  };

  public static addRole(role?: string | string[]) {
    if (Array.isArray(role)) {
      for (let r of role) {
        AuthUtil.addRole(r);
      }
    } else if (typeof role === 'string') {
      role = role.toUpperCase();
      if (AuthUtil.roles.indexOf(role) === -1) {
        AuthUtil.roles.push(role);
      }
    }
  };

  public static removeRole(role?: string | string[]) {
    if (Array.isArray(role)) {
      for (let r of role) {
        AuthUtil.removeRole(r);
      }
    } else if (typeof role === 'string') {
      const idx = AuthUtil.roles.indexOf(role.toUpperCase());
      if (idx >= 0) {
        AuthUtil.roles.splice(idx, 1);
      }
    }
  };

  public static hasUsername(username?: string | string[]): boolean {
    if (!AuthUtil.username && username) {
      return false;
    }
    if (Array.isArray(username)) {
      for (let u of username) {
        if (AuthUtil.hasUsername(u)) {
          return true;
        }
      }
    } else if (typeof username === 'string') {
      return (AuthUtil.username === username.toUpperCase());
    }
    return false;
  };

  public static hasRole(role?: string | string[]): boolean {
    const roles: string[] = [];
    if (Array.isArray(role)) {
      for (let r of role) {
        if (typeof r === 'string') {
          r = r.toUpperCase();
          if (roles.indexOf(r) === -1) {
            roles.push(r);
          }
        }
      }
    } else if (typeof role === 'string') {
      role = role.toUpperCase();
      if (roles.indexOf(role) === -1) {
        roles.push(role);
      }
    }

    for (let userRole of AuthUtil.roles) {
      if (roles.indexOf(userRole) === -1) {
        return false;
      }
    }
    return true;
  };

  public static hasAnyRole(role?: string | string[]): boolean {
    const roles: string[] = [];
    if (Array.isArray(role)) {
      for (let r of role) {
        if (typeof r === 'string') {
          r = r.toUpperCase();
          if (roles.indexOf(r) === -1) {
            roles.push(r);
          }
        }
      }
    } else if (typeof role === 'string') {
      role = role.toUpperCase();
      if (roles.indexOf(role) === -1) {
        roles.push(role);
      }
    }

    for (let userRole of AuthUtil.roles) {
      if (roles.indexOf(userRole) !== -1) {
        return true;
      }
    }
    return false;
  };
};
