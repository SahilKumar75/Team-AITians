import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  IdentityRegistered,
  LockAUpdated,
  TitleUpdated,
  IdentityRegistry,
} from "../generated/IdentityRegistry/IdentityRegistry";
import { Doctor, Hospital, Identity } from "../generated/schema";

function roleFromBytes(roleBytes: Bytes): string {
  const hex = roleBytes.toHexString();
  if (hex.startsWith("0x646f63746f72")) return "doctor";
  if (hex.startsWith("0x686f73706974616c")) return "hospital";
  if (hex.startsWith("0x70617469656e74")) return "patient";
  return "unknown";
}

function nonEmptyOrNull(value: string): string | null {
  return value.length > 0 ? value : null;
}

function syncIdentity(contractAddress: Address, identifierHash: Bytes, blockNumber: BigInt): void {
  const contract = IdentityRegistry.bind(contractAddress);
  const result = contract.try_getIdentity(identifierHash);
  if (result.reverted) return;

  const data = result.value;
  if (!data.exists) return;

  const identityId = identifierHash.toHexString();
  let identity = Identity.load(identityId);
  if (identity == null) {
    identity = new Identity(identityId);
  }

  const role = roleFromBytes(data.role);
  identity.wallet = data.wallet;
  identity.role = role;
  identity.lockACid = nonEmptyOrNull(data.lockACid);
  identity.title = nonEmptyOrNull(data.title);
  identity.updatedAtBlock = blockNumber;
  identity.save();

  if (role == "doctor") {
    const doctorId = identity.wallet.toHexString().toLowerCase();
    let doctor = Doctor.load(doctorId);
    if (doctor == null) {
      doctor = new Doctor(doctorId);
      doctor.wallet = identity.wallet;
      doctor.identityHash = identity.id;
    }
    doctor.title = identity.title;
    doctor.name = identity.title != null ? (identity.title as string) : "Doctor";
    doctor.updatedAtBlock = identity.updatedAtBlock;
    doctor.save();
    return;
  }

  if (role == "hospital") {
    const hospitalId = identity.wallet.toHexString().toLowerCase();
    let hospital = Hospital.load(hospitalId);
    if (hospital == null) {
      hospital = new Hospital(hospitalId);
      hospital.wallet = identity.wallet;
      hospital.identityHash = identity.id;
    }
    hospital.name = identity.title != null ? (identity.title as string) : "Hospital";
    hospital.updatedAtBlock = identity.updatedAtBlock;
    hospital.save();
  }
}

export function handleIdentityRegistered(event: IdentityRegistered): void {
  syncIdentity(event.address, event.params.identifierHash, event.block.number);
}

export function handleLockAUpdated(event: LockAUpdated): void {
  syncIdentity(event.address, event.params.identifierHash, event.block.number);
}

export function handleTitleUpdated(event: TitleUpdated): void {
  syncIdentity(event.address, event.params.identifierHash, event.block.number);
}
