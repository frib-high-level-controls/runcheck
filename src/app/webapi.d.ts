/**
 * These type definition are shared by the client and server.
 */
declare namespace webapi {
  // Common 'package' for API requests and responses data.
  // Inspired by the following specifications (especially the Google style guide):
  //   http://labs.omniti.com/labs/jsend
  //   https://google.github.io/styleguide/jsoncstyleguide.xml
  export interface Pkg<T> {
    data: T;
    error?: PkgError;
  }

  export interface PkgError {
    // Numeric status code (ie HTTP status code).
    code: number;
    // Description of the error to display to the user.
    message: string;
    // Optional error details.
    errors?: PkgErrorDetail[]
  }

  export interface PkgErrorDetail {
    // Identifies the type of error (ie 'ValidationError').
    reason?: string
    // Description of the error to display to the user.
    message: string;
    // The location of the error. (Indicates a portion
    // of the request data to which this error applies.)
    location: string;
  }
 
  // Application specific types defined below.

  export interface Update {
    at: string;
    by: string;
    paths: { 
      name: string;
      value: {};
    }[]
  }

  export interface History {
    updates: Update[];
    updatedAt: string;
    updatedBy: string;
  }

  export interface DeviceTableRow {
    name: string;
    desc: string;
    dept: string;
    deviceType: string;
    installSlotName?: string;
  }

  export interface SlotTableRow {
    id: string;
    name: string;
    desc: string;
    area: string;
    deviceType: string;
    careLevel: string; 
    drr: string;
    arr: string;
    installDeviceName?: string;
  }

  export interface GroupTableRow {
    id: string;
    name: string;
    desc: string;
  }

  export interface Device {
    id: string,
    name: string;
    desc: string;
    dept: string;
    deviceType: string;
    checklistId: string | null;
    installSlotId?: string;
    installSlotOn?: string;
    installSlotBy?: string;
    perms: {
      assign?: boolean;
    }
    //updates: {}
  }

  export interface SlotInstall {
    installDeviceId?: string;
    installDeviceOn?: string;
    installDeviceBy?: string;
  }

  export interface SlotPerms {
    canAssign?: boolean;
    canInstall?: boolean;
  }

  export interface Slot extends SlotPerms, SlotInstall {
    id: string,
    name: string;
    desc: string;
    area: string;
    deviceType: string;
    checklistId: string | null;
    careLevel: string;
    safetyLevel: string;
    arr: string;
    drr: string;
    groupId?: string;
    // installDeviceId?: string;
    // installDeviceOn?: string;
    // installDeviceBy?: string;
    // permissions: {
    //   assign?: boolean;
    // }
    //updates: {}
  }

  export interface Group {
    id: string;
    name: string;
    desc: string;
    checklistId: string | null;
  }

  interface Checklist {
    id: string;
    targetId: string;
    type: string;
    editable: boolean;
    subjects: ChecklistSubject[];
    statuses: ChecklistStatus[];
  }

  interface ChecklistSubject {
    id: string;
    checklistType: string;
    subject: string;
    checklistId: string;
    order: number;
    assignee: string[];
    required: boolean;
    mandatory: boolean;
    final: boolean;
  }

  interface ChecklistStatus {
    id: string;
    checklistId: string;
    subjectId: string;
    value: string;
    comment: string;
    inputOn: string;
    inputBy: string;
    history: History;
  }
}
