// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IVerifier
 * @notice Pluggable verifier: manual admin → Kleros curated list → Chainlink oracle.
 * Swap with zero redeployment via setVerifier().
 */
interface IVerifier {
    function isVerified(address entity) external view returns (bool);
}

/**
 * @title IIdentityRegistry
 * @notice Minimal interface for guardian veto: HealthRegistry checks if caller is a guardian of the patient.
 */
interface IIdentityRegistry {
    function getGuardians(address patient) external view returns (address[] memory);
}

/**
 * @title HealthRegistry
 * @notice Per-document medical record access using off-chain DEK storage (events only — no bytes on-chain).
 *
 * SECURITY FIXES APPLIED (all 8):
 *   1. Argon2id documented as client-side KDF — contract stores only result
 *   2. AES-256-GCM enforced client-side (quantum-resistant, key rotation built-in)
 *   3. DEKs stored OFF-CHAIN on IPFS — only emitted in events (AccessGranted). Zero bytes on-chain.
 *      On-chain stores: accessManifestCid per patient (single CID, updated per grant/revoke).
 *      Gas cost: O(1) per patient regardless of number of records or doctors.
 *   4. Tier-0 emergency profile: minimal fields only. No name by default. Patient controls.
 *   5. Unconscious Protocol: 30-min timelock + ICE veto window before access opens.
 *   6. File upload: off-chain server-side chunked upload — IPFS pinning via API, not browser.
 *   7. IVerifier interface: pluggable doctor/hospital verification source.
 *   8. File processing: chunked server-side — documented in client architecture.
 */
contract HealthRegistry {
    address public owner;
    IVerifier public verifier;
    /// @notice IdentityRegistry address; when set, guardians can veto Unconscious Protocol
    address public identityRegistry;

    // ─── Gas Optimization: Access Manifest ────────────────────────────────────
    // Instead of mapping(recordId => doctorAddr => bytes encDEK) = on-chain bytes = EXPENSIVE,
    // we store a SINGLE per-patient IPFS CID pointing to an encrypted JSON access manifest.
    // Format: { recordId: { doctorAddr: encDEK, ... }, ... } encrypted with patient pubkey.
    // Updated on every grant/revoke. Doctors fetch their DEK by reading the AccessGranted event.
    mapping(address => string) public accessManifestCid;

    // Role tracking
    mapping(address => bool) public patients;

    // Records: only metadata on-chain — no file content, no DEKs
    struct Record {
        string fileCid;      // IPFS CID of AES-256-GCM encrypted file
        address patient;
        address uploader;
        bytes32 fileType;    // "xray"|"blood-report"|"prescription"|"diagnosis"|"self-upload"
        uint256 timestamp;
        bool active;
    }
    mapping(bytes32 => Record) public records;
    mapping(address => bytes32[]) public patientRecords;

    // Emergency Tier 1: record IDs pre-approved for any verified ER doctor (Break-Glass)
    mapping(address => bytes32[]) public emergencyRecords;
    mapping(address => mapping(bytes32 => bool)) public isEmergencyRecord;

    // ─── Unconscious Protocol (Tier 2) with Timelock ──────────────────────────
    struct UnconsciousRequest {
        address hospital;
        uint256 requestTime;    // when 2nd signature was given
        uint8 signCount;
        bool executed;          // timelock passed, access opened
        bool vetoed;            // family vetoed, request cancelled
    }
    mapping(address => UnconsciousRequest) public unconsciousRequests;
    // Co-signers: patient → hospital → signer → signed
    mapping(address => mapping(address => mapping(address => bool))) public coSigned;
    // Active access after timelock: patient → hospital → expiry timestamp
    mapping(address => mapping(address => uint256)) public unconsciousAccess;

    uint256 public constant TIMELOCK_WINDOW  = 30 minutes;
    uint256 public constant ACCESS_DURATION  = 72 hours;
    uint8   public constant SIGN_THRESHOLD   = 2;

    // Access request tracking
    mapping(address => mapping(address => bool)) public accessRequested;

    // ─── Events (DEK data emitted here — no on-chain bytes storage) ───────────
    event PatientRegistered(address indexed patient);

    event RecordAdded(
        bytes32 indexed recordId,
        address indexed patient,
        address indexed uploader,
        string fileCid,
        bytes32 fileType,
        uint256 timestamp
    );
    event RecordDeactivated(bytes32 indexed recordId, address indexed patient);

    // encDekForGrantee: AES-256-GCM(DEK, grantee_publicKey)
    // Grantee fetches this from the event + IPFS — NOT stored in contract state
    event AccessGranted(bytes32 indexed recordId, address indexed grantee, string encDekIpfsCid);
    event AccessRevoked(bytes32 indexed recordId, address indexed grantee);
    event AccessManifestUpdated(address indexed patient, string newManifestCid);
    event AccessRequested(address indexed patient, address indexed clinician);

    event EmergencyRecordAdded(address indexed patient, bytes32 indexed recordId);
    event EmergencyRecordRemoved(address indexed patient, bytes32 indexed recordId);

    // Tier 1 Break-Glass: verified doctor logs emergency access
    event BreakGlassUsed(address indexed patient, address indexed doctor, uint256 timestamp);

    // Tier 2 Unconscious Protocol with timelock
    event UnconsciousCoSigned(address indexed patient, address indexed hospital, address indexed signer, uint8 count);
    event UnconsciousTimelockStarted(address indexed patient, address indexed hospital, uint256 vetoDeadline);
    event UnconsciousAccessGranted(address indexed patient, address indexed hospital, uint256 expiry);
    event UnconsciousVetoed(address indexed patient, address by);
    event UnconsciousAccessRevoked(address indexed patient, address indexed hospital);
    event VerifierUpdated(address indexed newVerifier);
    event IdentityRegistryUpdated(address indexed newIdentityRegistry);

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier onlyPatient() { require(patients[msg.sender], "Not a patient"); _; }
    modifier onlyVerifiedClinician() {
        require(verifier.isVerified(msg.sender), "Not a verified clinician");
        _;
    }
    modifier onlyRecordPatient(bytes32 recordId) {
        require(records[recordId].patient == msg.sender, "Not your record");
        _;
    }

    constructor(address _verifier) {
        owner = msg.sender;
        verifier = IVerifier(_verifier);
        identityRegistry = address(0);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setVerifier(address _verifier) external onlyOwner {
        verifier = IVerifier(_verifier);
        emit VerifierUpdated(_verifier);
    }

    /// @notice Set IdentityRegistry so guardians can veto Unconscious Protocol (V2)
    function setIdentityRegistry(address _identityRegistry) external onlyOwner {
        identityRegistry = _identityRegistry;
        emit IdentityRegistryUpdated(_identityRegistry);
    }

    // ─── Patient Registration ─────────────────────────────────────────────────

    function registerPatient() external {
        require(!patients[msg.sender], "Already registered");
        patients[msg.sender] = true;
        emit PatientRegistered(msg.sender);
    }

    // ─── Record Management ────────────────────────────────────────────────────

    /**
     * @notice Add a new encrypted medical record (metadata on-chain only)
     * @param patient    Patient wallet
     * @param fileCid    IPFS CID of the AES-256-GCM encrypted file
     * @param fileType   Record type
     * File content and DEKs are all off-chain. Gas cost: O(1) constant.
     */
    function addRecord(
        address patient,
        string calldata fileCid,
        bytes32 fileType
    ) external returns (bytes32 recordId) {
        require(patients[patient], "Patient not registered");
        require(
            msg.sender == patient || verifier.isVerified(msg.sender),
            "Not authorised"
        );

        recordId = keccak256(abi.encodePacked(patient, fileCid, block.timestamp, msg.sender));

        records[recordId] = Record({
            fileCid: fileCid,
            patient: patient,
            uploader: msg.sender,
            fileType: fileType,
            timestamp: block.timestamp,
            active: true
        });

        patientRecords[patient].push(recordId);
        emit RecordAdded(recordId, patient, msg.sender, fileCid, fileType, block.timestamp);
    }

    function deactivateRecord(bytes32 recordId) external onlyRecordPatient(recordId) {
        records[recordId].active = false;
        emit RecordDeactivated(recordId, msg.sender);
    }

    // ─── Off-Chain DEK Access Control ─────────────────────────────────────────

    /**
     * @notice Grant a clinician access to a record.
     *         The encrypted DEK is pinned to IPFS off-chain and its CID emitted in the event.
     *         Zero bytes stored in contract state — gas cost is just one event.
     * @param recordId       Record to share
     * @param grantee        Doctor/hospital wallet, or patient wallet for self-manifest anchoring
     * @param encDekIpfsCid  IPFS CID of AES-256-GCM(DEK, grantee_publicKey)
     * @param newManifestCid Updated patient access manifest CID (one per patient)
     */
    function grantAccess(
        bytes32 recordId,
        address grantee,
        string calldata encDekIpfsCid,
        string calldata newManifestCid
    ) external onlyRecordPatient(recordId) {
        require(records[recordId].active, "Record inactive");
        // Allow patient self-grant so initial DEK manifest can be anchored without local fallback.
        // Doctor/hospital grants still require verifier approval.
        require(
            grantee == msg.sender || verifier.isVerified(grantee),
            "Grantee not a verified clinician"
        );

        // Update per-patient manifest CID (one write, O(1) cost)
        accessManifestCid[msg.sender] = newManifestCid;

        emit AccessGranted(recordId, grantee, encDekIpfsCid);
        emit AccessManifestUpdated(msg.sender, newManifestCid);
    }

    function revokeAccess(
        bytes32 recordId,
        address grantee,
        string calldata newManifestCid
    ) external onlyRecordPatient(recordId) {
        accessManifestCid[msg.sender] = newManifestCid;
        emit AccessRevoked(recordId, grantee);
        emit AccessManifestUpdated(msg.sender, newManifestCid);
    }

    /**
     * @notice Doctor grants access to a record they just uploaded, sharing the DEK with the patient.
     * @param recordId       Record to share
     * @param patient        The patient who owns the record
     * @param grantee        Doctor/hospital wallet, or patient wallet
     * @param encDekIpfsCid  IPFS CID of AES-256-GCM(DEK, grantee_publicKey)
     * @param newManifestCid Updated patient access manifest CID
     */
    function doctorGrantAccess(
        bytes32 recordId,
        address patient,
        address grantee,
        string calldata encDekIpfsCid,
        string calldata newManifestCid
    ) external onlyVerifiedClinician {
        require(records[recordId].active, "Record inactive");
        require(records[recordId].patient == patient, "Patient mismatch");
        require(records[recordId].uploader == msg.sender, "Not the uploader");
        require(
            grantee == patient || grantee == msg.sender || verifier.isVerified(grantee),
            "Grantee not a verified clinician"
        );

        // Update the patient's manifest CID
        accessManifestCid[patient] = newManifestCid;
        
        emit AccessGranted(recordId, grantee, encDekIpfsCid);
        emit AccessManifestUpdated(patient, newManifestCid);
    }

    /// @notice Clinician requests access to a patient's records
    function requestAccess(address patient) external onlyVerifiedClinician {
        require(!accessRequested[msg.sender][patient], "Already requested");
        accessRequested[msg.sender][patient] = true;
        emit AccessRequested(patient, msg.sender);
    }

    // ─── Emergency Tier 1 — Break-Glass ───────────────────────────────────────

    function addToEmergencyRecords(bytes32 recordId) external onlyRecordPatient(recordId) {
        require(!isEmergencyRecord[msg.sender][recordId], "Already added");
        isEmergencyRecord[msg.sender][recordId] = true;
        emergencyRecords[msg.sender].push(recordId);
        emit EmergencyRecordAdded(msg.sender, recordId);
    }

    function removeFromEmergencyRecords(bytes32 recordId, uint256 index) external onlyRecordPatient(recordId) {
        bytes32[] storage arr = emergencyRecords[msg.sender];
        require(index < arr.length && arr[index] == recordId, "Bad index");
        arr[index] = arr[arr.length - 1];
        arr.pop();
        isEmergencyRecord[msg.sender][recordId] = false;
        emit EmergencyRecordRemoved(msg.sender, recordId);
    }

    /// @notice Any verified clinician logs Break-Glass emergency access (Tier 1)
    function triggerBreakGlass(address patient) external onlyVerifiedClinician {
        require(patients[patient], "Not a patient");
        emit BreakGlassUsed(patient, msg.sender, block.timestamp);
        // Access to pre-approved emergencyRecords[] is validated client-side via events
    }

    // ─── Emergency Tier 2 — Unconscious Protocol with 30-min Timelock ─────────

    /**
     * @notice Hospital staff co-signs the Unconscious Protocol.
     *         After SIGN_THRESHOLD signatures: 30-minute veto window opens.
     *         ICE contact must be auto-notified off-chain by the server immediately.
     */
    function signUnconsciousProtocol(address patient) external onlyVerifiedClinician {
        address hospital = msg.sender;
        UnconsciousRequest storage req = unconsciousRequests[patient];

        // If there's already a vetoed/executed request, start fresh
        if (req.vetoed || req.executed) {
            delete unconsciousRequests[patient];
        }

        require(!coSigned[patient][hospital][msg.sender], "Already signed");
        coSigned[patient][hospital][msg.sender] = true;

        if (req.hospital == address(0)) {
            req.hospital = hospital;
        }
        require(req.hospital == hospital, "Different hospital initiated");

        req.signCount++;
        emit UnconsciousCoSigned(patient, hospital, msg.sender, req.signCount);

        if (req.signCount >= SIGN_THRESHOLD && !req.executed && !req.vetoed) {
            req.requestTime = block.timestamp;
            emit UnconsciousTimelockStarted(patient, hospital, block.timestamp + TIMELOCK_WINDOW);
            // Server: trigger SMS/WhatsApp to patient's ICE contact NOW
        }
    }

    /**
     * @notice After the 30-minute veto window, anyone can execute to open access.
     *         This makes the timelock trustless — no admin needed to push it through.
     */
    function executeUnconsciousProtocol(address patient) external {
        UnconsciousRequest storage req = unconsciousRequests[patient];
        require(req.signCount >= SIGN_THRESHOLD, "Not enough signatures");
        require(!req.vetoed, "Request was vetoed");
        require(!req.executed, "Already executed");
        require(block.timestamp >= req.requestTime + TIMELOCK_WINDOW, "Timelock active");

        req.executed = true;
        uint256 expiry = block.timestamp + ACCESS_DURATION;
        unconsciousAccess[patient][req.hospital] = expiry;
        emit UnconsciousAccessGranted(patient, req.hospital, expiry);
    }

    /**
     * @notice Patient or their guardian vetoes the unconscious protocol during the 30-min window.
     */
    function vetoUnconsciousProtocol(address patient) external {
        require(
            msg.sender == patient || _isRegisteredGuardianOf(patient, msg.sender),
            "Not authorised to veto"
        );
        UnconsciousRequest storage req = unconsciousRequests[patient];
        require(req.signCount >= SIGN_THRESHOLD, "No active request");
        require(!req.executed, "Already executed");
        require(block.timestamp < req.requestTime + TIMELOCK_WINDOW, "Veto window closed");

        req.vetoed = true;
        emit UnconsciousVetoed(patient, msg.sender);
    }

    /// @notice Once conscious, patient revokes active Tier-2 access
    function revokeUnconsciousAccess(address hospital) external {
        delete unconsciousAccess[msg.sender][hospital];
        emit UnconsciousAccessRevoked(msg.sender, hospital);
    }

    function hasUnconsciousAccess(address patient, address hospital) external view returns (bool) {
        return unconsciousAccess[patient][hospital] > block.timestamp;
    }

    // ─── Key Rotation ──────────────────────────────────────────────────────────

    /**
     * @notice Patient rotates their encryption key (e.g., if AES algorithm threatened).
     *         Client re-encrypts all files with new key, re-pins, and updates the manifest CID.
     *         All existing AccessGranted events become stale — doctor re-grant flow required.
     */
    function rotateEncryptionKey(string calldata newManifestCid) external onlyPatient {
        accessManifestCid[msg.sender] = newManifestCid;
        emit AccessManifestUpdated(msg.sender, newManifestCid);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    function getPatientRecords(address patient) external view returns (bytes32[] memory) {
        return patientRecords[patient];
    }

    function getEmergencyRecords(address patient) external view returns (bytes32[] memory) {
        return emergencyRecords[patient];
    }

    function getRecord(bytes32 recordId) external view returns (Record memory) {
        return records[recordId];
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /// @notice Returns true if guardian is in the patient's guardian list (IdentityRegistry)
    function _isRegisteredGuardianOf(address patient, address guardian) internal view returns (bool) {
        if (identityRegistry == address(0)) return false;
        address[] memory gs = IIdentityRegistry(identityRegistry).getGuardians(patient);
        for (uint256 i = 0; i < gs.length; i++) {
            if (gs[i] == guardian) return true;
        }
        return false;
    }
}
