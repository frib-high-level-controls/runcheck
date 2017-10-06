/**
 * These type definition are used by both server and client.
 */
declare namespace webapi {

  // Common wrapper for all API responses.
  // Inspired by the following documents:
  //   http://labs.omniti.com/labs/jsend
  //   https://google.github.io/styleguide/jsoncstyleguide.xml
  export interface Data<T extends {}> {
    data: T,
    error?: {
      code?: number 
      message: string
    }
  }

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
  }

  export interface SlotTableRow {
    id: string;
    name: string;
    desc: string;
    area: string;
    loc: string; 
    drr: string;
    arr: string;
    deviceType: string;
  }

  export interface Device {
    id: string,
    name: string;
    desc: string;
    dept: string;
    deviceType: string;
    checklistId: string | null;
    //updates: {}
  }

  export interface Slot {
    id: string,
    name: string;
    desc: string;
    area: string;
    deviceType: string;
    checklistId: string | null;
    //updates: {}
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
