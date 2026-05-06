import { randomInt } from "node:crypto";
import { getSql } from "@/lib/db";
import type { Message, MessageInput, NetworkPointImportRow } from "@/lib/types";
import {
  anomalyStatusOptions,
  branchTypeOptions,
  departmentOptions,
  hubCenterOptions,
  organizationTypeOptions,
  ownerOrganizationOptions,
  provinceOptions,
  serviceTypeOptions,
  statusOptions,
} from "@/lib/validation";

type MessageRow = {
  id: string;
  code: null | string;
  name: string;
  branch_type: null | string;
  service_type: null | string;
  organization_type: null | string;
  status: null | string;
  anomaly_status: null | string;
  owner_organization: null | string;
  hub_center: null | string;
  province: null | string;
  department: null | string;
  content: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function fallbackCode(id: string, index: number) {
  return id.replace(/-/g, "").slice(0, 6).padEnd(6, `${(index + 2) % 10}`);
}

function fallbackFromIndex<T extends readonly string[]>(options: T, index: number) {
  return options[index % options.length];
}

function mapMessage(row: MessageRow, index = 0): Message {
  return {
    id: row.id,
    code: row.code ?? fallbackCode(row.id, index),
    name: row.name,
    branchType: row.branch_type ?? fallbackFromIndex(branchTypeOptions, index),
    serviceType: row.service_type ?? fallbackFromIndex(serviceTypeOptions, index),
    organizationType:
      row.organization_type ?? fallbackFromIndex(organizationTypeOptions, index),
    status: row.status ?? fallbackFromIndex(statusOptions, index),
    anomalyStatus:
      row.anomaly_status ?? fallbackFromIndex(anomalyStatusOptions, index),
    ownerOrganization:
      row.owner_organization ?? fallbackFromIndex(ownerOrganizationOptions, index),
    hubCenter: row.hub_center ?? fallbackFromIndex(hubCenterOptions, index),
    province: row.province ?? fallbackFromIndex(provinceOptions, index),
    department: row.department ?? fallbackFromIndex(departmentOptions, index),
    content: row.content,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function buildManualDraft(input: MessageInput) {
  return {
    code: `${Date.now()}`.slice(-6),
    branchType: branchTypeOptions[randomInt(branchTypeOptions.length)],
    serviceType: serviceTypeOptions[randomInt(serviceTypeOptions.length)],
    organizationType:
      organizationTypeOptions[randomInt(organizationTypeOptions.length)],
    status: statusOptions[0],
    anomalyStatus: anomalyStatusOptions[0],
    ownerOrganization:
      ownerOrganizationOptions[randomInt(ownerOrganizationOptions.length)],
    hubCenter: hubCenterOptions[randomInt(hubCenterOptions.length)],
    province: provinceOptions[randomInt(provinceOptions.length)],
    department: departmentOptions[randomInt(departmentOptions.length)],
    content: input.content,
  };
}

export async function listMessages() {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      code,
      name,
      branch_type,
      service_type,
      organization_type,
      status,
      anomaly_status,
      owner_organization,
      hub_center,
      province,
      department,
      content,
      created_at,
      updated_at
    FROM messages
    ORDER BY created_at DESC;
  `) as MessageRow[];

  return rows.map((row, index) => mapMessage(row, index));
}

export async function findMessageById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      code,
      name,
      branch_type,
      service_type,
      organization_type,
      status,
      anomaly_status,
      owner_organization,
      hub_center,
      province,
      department,
      content,
      created_at,
      updated_at
    FROM messages
    WHERE id = ${id}
    LIMIT 1;
  `) as MessageRow[];

  return rows[0] ? mapMessage(rows[0]) : null;
}

export async function createMessage(input: MessageInput) {
  const draft = buildManualDraft(input);
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO messages (
      code,
      name,
      branch_type,
      service_type,
      organization_type,
      status,
      anomaly_status,
      owner_organization,
      hub_center,
      province,
      department,
      content
    )
    VALUES (
      ${draft.code},
      ${input.name},
      ${draft.branchType},
      ${draft.serviceType},
      ${draft.organizationType},
      ${draft.status},
      ${draft.anomalyStatus},
      ${draft.ownerOrganization},
      ${draft.hubCenter},
      ${draft.province},
      ${draft.department},
      ${draft.content}
    )
    RETURNING
      id,
      code,
      name,
      branch_type,
      service_type,
      organization_type,
      status,
      anomaly_status,
      owner_organization,
      hub_center,
      province,
      department,
      content,
      created_at,
      updated_at;
  `) as MessageRow[];

  return mapMessage(rows[0]);
}

export async function importMessages(rowsToImport: NetworkPointImportRow[]) {
  const sql = getSql();

  for (const row of rowsToImport) {
    await sql`
      INSERT INTO messages (
        code,
        name,
        branch_type,
        service_type,
        organization_type,
        status,
        anomaly_status,
        owner_organization,
        hub_center,
        province,
        department,
        content
      )
      VALUES (
        ${row.code},
        ${row.name},
        ${row.branchType},
        ${row.serviceType},
        ${row.organizationType},
        ${row.status},
        ${row.anomalyStatus},
        ${row.ownerOrganization},
        ${row.hubCenter},
        ${provinceOptions[0]},
        ${departmentOptions[0]},
        ${row.content}
      );
    `;
  }

  return {
    inserted: rowsToImport.length,
    names: rowsToImport.map((row) => row.name),
  };
}

export async function updateMessage(id: string, input: MessageInput) {
  const sql = getSql();
  const rows = (await sql`
    UPDATE messages
    SET
      name = ${input.name},
      content = ${input.content}
    WHERE id = ${id}
    RETURNING
      id,
      code,
      name,
      branch_type,
      service_type,
      organization_type,
      status,
      anomaly_status,
      owner_organization,
      hub_center,
      province,
      department,
      content,
      created_at,
      updated_at;
  `) as MessageRow[];

  return rows[0] ? mapMessage(rows[0]) : null;
}

export async function deleteMessage(id: string) {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM messages
    WHERE id = ${id}
    RETURNING id;
  `) as Array<{ id: string }>;

  return rows.length > 0;
}
