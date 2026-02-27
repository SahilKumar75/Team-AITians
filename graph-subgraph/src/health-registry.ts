import { AccessGranted, AccessRevoked, RecordAdded, RecordDeactivated } from "../generated/HealthRegistry/HealthRegistry";
import { AccessGrant, Record } from "../generated/schema";

export function handleRecordAdded(event: RecordAdded): void {
  const id = event.params.recordId.toHexString();
  let record = Record.load(id);
  if (record == null) {
    record = new Record(id);
  }
  record.patient = event.params.patient;
  record.uploader = event.params.uploader;
  record.fileCid = event.params.fileCid;
  record.fileType = event.params.fileType.toHexString();
  record.timestamp = event.params.timestamp;
  record.active = true;
  record.lastUpdatedBlock = event.block.number;
  record.save();
}

export function handleRecordDeactivated(event: RecordDeactivated): void {
  const id = event.params.recordId.toHexString();
  let record = Record.load(id);
  if (record == null) {
    record = new Record(id);
    record.patient = event.params.patient;
    record.uploader = event.params.patient;
    record.fileCid = "";
    record.fileType = "";
    record.timestamp = event.block.timestamp;
  }
  record.active = false;
  record.lastUpdatedBlock = event.block.number;
  record.save();
}

export function handleAccessGranted(event: AccessGranted): void {
  const recordId = event.params.recordId.toHexString();
  const grantee = event.params.grantee.toHexString().toLowerCase();
  const id = recordId + "-" + grantee;
  let grant = AccessGrant.load(id);
  if (grant == null) {
    grant = new AccessGrant(id);
    grant.recordId = recordId;
    grant.grantee = event.params.grantee;
  }
  grant.encDekIpfsCid = event.params.encDekIpfsCid;
  grant.txHash = event.transaction.hash;
  grant.grantedAtBlock = event.block.number;
  grant.revokedAtBlock = null;
  grant.save();
}

export function handleAccessRevoked(event: AccessRevoked): void {
  const recordId = event.params.recordId.toHexString();
  const grantee = event.params.grantee.toHexString().toLowerCase();
  const id = recordId + "-" + grantee;
  let grant = AccessGrant.load(id);
  if (grant == null) {
    grant = new AccessGrant(id);
    grant.recordId = recordId;
    grant.grantee = event.params.grantee;
    grant.txHash = event.transaction.hash;
    grant.grantedAtBlock = event.block.number;
  }
  grant.revokedAtBlock = event.block.number;
  grant.save();
}
