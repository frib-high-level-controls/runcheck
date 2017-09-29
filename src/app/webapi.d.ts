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

  export interface DeviceTableRow {
    name: string;
    desc: string;
    dept: string;
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

  interface Checklist {
    id: string;
    targetId: string;
    type: string;
    items: ChecklistItem[];
    data: ChecklistItemData[];
  }

  interface ChecklistItem {
    id: string;
    type: string;
    subject: string;
    checklistId: string;
    order: number;
    assignee: string[];
    required: boolean;
    mandatory: boolean;
    final: boolean;
  }

  interface ChecklistItemData {
    id: string;
    checklistId: string;
    itemId: string;
    value: {};
    comment: string;
    inputOn: string;
    inputBy: string;
  }
}
