import { newMockEvent } from "matchstick-as"
import { ethereum, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  DoctorVerified,
  EmergencyCidUpdated,
  GuardianAdded,
  GuardianRemoved,
  IdentityRegistered,
  LockAUpdated,
  RecoveryCancelled,
  RecoveryCompleted,
  RecoveryInitiated,
  RecoveryVoted,
  TitleUpdated,
  VerifierUpdated
} from "../generated/IdentityRegistry/IdentityRegistry"

export function createDoctorVerifiedEvent(wallet: Address): DoctorVerified {
  let doctorVerifiedEvent = changetype<DoctorVerified>(newMockEvent())

  doctorVerifiedEvent.parameters = new Array()

  doctorVerifiedEvent.parameters.push(
    new ethereum.EventParam("wallet", ethereum.Value.fromAddress(wallet))
  )

  return doctorVerifiedEvent
}

export function createEmergencyCidUpdatedEvent(
  identifierHash: Bytes,
  newEmergencyCid: string
): EmergencyCidUpdated {
  let emergencyCidUpdatedEvent = changetype<EmergencyCidUpdated>(newMockEvent())

  emergencyCidUpdatedEvent.parameters = new Array()

  emergencyCidUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "identifierHash",
      ethereum.Value.fromFixedBytes(identifierHash)
    )
  )
  emergencyCidUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "newEmergencyCid",
      ethereum.Value.fromString(newEmergencyCid)
    )
  )

  return emergencyCidUpdatedEvent
}

export function createGuardianAddedEvent(
  patient: Address,
  guardian: Address
): GuardianAdded {
  let guardianAddedEvent = changetype<GuardianAdded>(newMockEvent())

  guardianAddedEvent.parameters = new Array()

  guardianAddedEvent.parameters.push(
    new ethereum.EventParam("patient", ethereum.Value.fromAddress(patient))
  )
  guardianAddedEvent.parameters.push(
    new ethereum.EventParam("guardian", ethereum.Value.fromAddress(guardian))
  )

  return guardianAddedEvent
}

export function createGuardianRemovedEvent(
  patient: Address,
  guardian: Address
): GuardianRemoved {
  let guardianRemovedEvent = changetype<GuardianRemoved>(newMockEvent())

  guardianRemovedEvent.parameters = new Array()

  guardianRemovedEvent.parameters.push(
    new ethereum.EventParam("patient", ethereum.Value.fromAddress(patient))
  )
  guardianRemovedEvent.parameters.push(
    new ethereum.EventParam("guardian", ethereum.Value.fromAddress(guardian))
  )

  return guardianRemovedEvent
}

export function createIdentityRegisteredEvent(
  identifierHash: Bytes,
  wallet: Address,
  role: Bytes
): IdentityRegistered {
  let identityRegisteredEvent = changetype<IdentityRegistered>(newMockEvent())

  identityRegisteredEvent.parameters = new Array()

  identityRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "identifierHash",
      ethereum.Value.fromFixedBytes(identifierHash)
    )
  )
  identityRegisteredEvent.parameters.push(
    new ethereum.EventParam("wallet", ethereum.Value.fromAddress(wallet))
  )
  identityRegisteredEvent.parameters.push(
    new ethereum.EventParam("role", ethereum.Value.fromFixedBytes(role))
  )

  return identityRegisteredEvent
}

export function createLockAUpdatedEvent(
  identifierHash: Bytes,
  newLockACid: string
): LockAUpdated {
  let lockAUpdatedEvent = changetype<LockAUpdated>(newMockEvent())

  lockAUpdatedEvent.parameters = new Array()

  lockAUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "identifierHash",
      ethereum.Value.fromFixedBytes(identifierHash)
    )
  )
  lockAUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "newLockACid",
      ethereum.Value.fromString(newLockACid)
    )
  )

  return lockAUpdatedEvent
}

export function createRecoveryCancelledEvent(
  patient: Address
): RecoveryCancelled {
  let recoveryCancelledEvent = changetype<RecoveryCancelled>(newMockEvent())

  recoveryCancelledEvent.parameters = new Array()

  recoveryCancelledEvent.parameters.push(
    new ethereum.EventParam("patient", ethereum.Value.fromAddress(patient))
  )

  return recoveryCancelledEvent
}

export function createRecoveryCompletedEvent(
  patient: Address,
  newLockACid: string
): RecoveryCompleted {
  let recoveryCompletedEvent = changetype<RecoveryCompleted>(newMockEvent())

  recoveryCompletedEvent.parameters = new Array()

  recoveryCompletedEvent.parameters.push(
    new ethereum.EventParam("patient", ethereum.Value.fromAddress(patient))
  )
  recoveryCompletedEvent.parameters.push(
    new ethereum.EventParam(
      "newLockACid",
      ethereum.Value.fromString(newLockACid)
    )
  )

  return recoveryCompletedEvent
}

export function createRecoveryInitiatedEvent(
  patient: Address,
  proposedLockACid: string
): RecoveryInitiated {
  let recoveryInitiatedEvent = changetype<RecoveryInitiated>(newMockEvent())

  recoveryInitiatedEvent.parameters = new Array()

  recoveryInitiatedEvent.parameters.push(
    new ethereum.EventParam("patient", ethereum.Value.fromAddress(patient))
  )
  recoveryInitiatedEvent.parameters.push(
    new ethereum.EventParam(
      "proposedLockACid",
      ethereum.Value.fromString(proposedLockACid)
    )
  )

  return recoveryInitiatedEvent
}

export function createRecoveryVotedEvent(
  patient: Address,
  guardian: Address,
  votesTotal: i32
): RecoveryVoted {
  let recoveryVotedEvent = changetype<RecoveryVoted>(newMockEvent())

  recoveryVotedEvent.parameters = new Array()

  recoveryVotedEvent.parameters.push(
    new ethereum.EventParam("patient", ethereum.Value.fromAddress(patient))
  )
  recoveryVotedEvent.parameters.push(
    new ethereum.EventParam("guardian", ethereum.Value.fromAddress(guardian))
  )
  recoveryVotedEvent.parameters.push(
    new ethereum.EventParam(
      "votesTotal",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(votesTotal))
    )
  )

  return recoveryVotedEvent
}

export function createTitleUpdatedEvent(
  identifierHash: Bytes,
  title: string
): TitleUpdated {
  let titleUpdatedEvent = changetype<TitleUpdated>(newMockEvent())

  titleUpdatedEvent.parameters = new Array()

  titleUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "identifierHash",
      ethereum.Value.fromFixedBytes(identifierHash)
    )
  )
  titleUpdatedEvent.parameters.push(
    new ethereum.EventParam("title", ethereum.Value.fromString(title))
  )

  return titleUpdatedEvent
}

export function createVerifierUpdatedEvent(
  newVerifier: Address
): VerifierUpdated {
  let verifierUpdatedEvent = changetype<VerifierUpdated>(newMockEvent())

  verifierUpdatedEvent.parameters = new Array()

  verifierUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "newVerifier",
      ethereum.Value.fromAddress(newVerifier)
    )
  )

  return verifierUpdatedEvent
}
