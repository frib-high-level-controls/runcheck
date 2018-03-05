/**
 * These type definition are shared by the client and server.
 */

// tslint:disable:no-namespace
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
    errors?: PkgErrorDetail[];
  }

  export interface PkgErrorDetail {
    // Identifies the type of error (ie 'ValidationError').
    reason?: string;
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
    paths: Array<{
      name: string;
      value: {};
    }>;
  }

  export interface History {
    updates: Update[];
    updatedAt: string;
    updatedBy: string;
  }

  export interface DeviceTableRow {
    id: string;
    name: string;
    desc: string;
    dept: string;
    deviceType: string;
    installSlotName?: string;
    checklistId?: string;
    checklistApproved?: boolean;
    checklistChecked?: number;
    checklistTotal?: number;
  }

  export interface GroupTableRow {
    id: string;
    name: string;
    desc: string;
    safetyLevel?: string;
    checklistId?: string;
    checklistApproved?: boolean;
    checklistChecked?: number;
    checklistTotal?: number;
  }

  export interface DevicePerms {
    canAssign?: boolean;
  }

  export interface DeviceInstall {
    installSlotId?: string;
    installSlotOn?: string;
    installSlotBy?: string;
  }

  export interface GroupPerms {
    canAssign?: boolean
    canManage?: boolean;
  }

  export interface Device extends DevicePerms, DeviceInstall {
    id: string;
    name: string;
    desc: string;
    dept: string;
    deviceType: string;
    checklistId?: string;
    installSlotId?: string;
    installSlotOn?: string;
    installSlotBy?: string;
  }

  export interface SlotInstall {
    installDeviceId?: string;
    installDeviceOn?: string;
    installDeviceBy?: string;
  }

  export interface SlotPerms {
    canAssign?: boolean;
    canInstall?: boolean;
    canGroup?: boolean;
  }

  export interface SlotBase { // TODO: rename to 'Slot'
    id: string;
    name: string;
    desc: string;
    area: string;
    deviceType: string;
    checklistId?: string;
    careLevel: string;
    safetyLevel: string;
    arr: string;
    drr: string;
    groupId?: string;
    installDeviceId?: string;
    installDeviceOn?: string;
    installDeviceBy?: string;
  }

  export interface Slot extends SlotPerms, SlotInstall {
    id: string;
    name: string;
    desc: string;
    area: string;
    deviceType: string;
    checklistId?: string;
    careLevel: string;
    safetyLevel: string;
    arr: string;
    drr: string;
    groupId?: string;
  }

  export interface SlotTableRow extends SlotBase, SlotPerms {
    installDeviceName?: string;
    checklistApproved?: boolean;
    checklistChecked?: number;
    checklistTotal?: number;
  }

  export interface Group extends GroupPerms {
    id: string;
    name: string;
    desc: string;
    owner: string;
    safetyLevel?: string;
    checklistId?: string;
  }

  interface Checklist {
    id: string;
    targetId: string;
    targetType: string;
    checklistType: string;
    approved: boolean;
    checked: number;
    total: number;
  }

  interface ChecklistPerms {
    canEdit: boolean;
  }

  interface ChecklistTableRow extends Checklist {
    targetName: string;
    targetDesc: string;
    subjects: ChecklistSubjectTableRow[];
    statuses: ChecklistStatusTableRow[];
  }

  interface ChecklistDetails extends Checklist, ChecklistPerms {
    subjects: ChecklistSubjectDetails[];
    statuses: ChecklistStatusDetails[];
  }

  interface ChecklistSubject {
    name: string;
    desc: string;
    order: number;
    assignees: string[];
    final: boolean;
    primary: boolean;
    required: boolean;
    mandatory: boolean;
  }

  interface ChecklistSubjectTableRow extends ChecklistSubject {
    canUpdate: boolean;
  }

  interface ChecklistSubjectDetails extends ChecklistSubject {
    canUpdate: boolean;
    // history? //
  }

  interface ChecklistStatus {
    subjectName: string;
    value: string;
    comment: string;
    inputAt: string;
    inputBy: string;
  }

  interface ChecklistStatusTableRow extends ChecklistStatus {
    // no additional properties needed //
  }

  interface ChecklistStatusDetails extends ChecklistStatus {
    history: History;
  }
}
