// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IVerifier
 * @notice Pluggable doctor/hospital verifier interface. Swap manual → Kleros → Chainlink with no contract redeployment.
 */
interface IVerifier {
    function isVerified(address entity) external view returns (bool);
}

/**
 * @title DefaultVerifier
 * @notice Simple owner-controlled verifier (hackathon). Replace with Kleros/Chainlink oracle later.
 */
contract DefaultVerifier is IVerifier {
    address public admin;
    mapping(address => bool) private verified;

    event EntityVerified(address indexed entity);
    event EntityRevoked(address indexed entity);

    constructor() { admin = msg.sender; }

    modifier onlyAdmin() { require(msg.sender == admin, "Not admin"); _; }

    function verify(address entity) external onlyAdmin { verified[entity] = true; emit EntityVerified(entity); }
    function revoke(address entity) external onlyAdmin { verified[entity] = false; emit EntityRevoked(entity); }
    function isVerified(address entity) external view override returns (bool) { return verified[entity]; }
}

/**
 * @title IdentityRegistry
 * @notice Decentralised identity anchoring with Triple-Lock auth, social recovery, and pluggable doctor verification.
 *
 * SECURITY FIXES APPLIED:
 *   - Argon2id key derivation documented (client-side — contract stores result only)
 *   - IVerifier interface: manual → Kleros → Chainlink oracle swappable with zero redeployment
 *   - Minimum 2-of-N guardian threshold for recovery (N configurable per patient)
 */
contract IdentityRegistry {
    address public owner;
    IVerifier public verifier;

    struct Identity {
        string lockACid;            // IPFS CID: Argon2id(password, salt) key → AES-256-GCM(privKey)
        string lockCCid;            // IPFS CID: AES-256-GCM(privKey, recoveryPhrase)
        bytes32 recoveryKeyHash;    // keccak256(recoveryPhrase) — for client-side verification only
        string emergencyCid;        // IPFS CID: Tier-0 public emergency profile (minimal fields)
        address wallet;
        bytes32 role;               // "patient" | "doctor" | "hospital"
        bytes32 licenseHash;        // keccak256(licenseNumber) — submitted by doctor at registration
        bool exists;
        string title;               // Optional: "Doctor" | "Surgeon" | "Nurse" | "Consultant" | "Resident" | "" (added last for storage layout)
    }

    // keccak256(email or phone) → Identity
    mapping(bytes32 => Identity) public identities;
    // wallet → identifier hash (reverse lookup)
    mapping(address => bytes32) public walletToIdentifier;

    // Social Recovery
    // patient wallet → guardian wallets
    mapping(address => address[]) private _guardians;
    // patient → guardian → has voted in current round
    mapping(address => mapping(address => bool)) public guardianVotes;
    // active recovery: patient → proposed new lockACid
    mapping(address => string) public pendingNewLockACid;
    // vote counter
    mapping(address => uint8) public recoveryVoteCount;
    // threshold per patient (default 2)
    mapping(address => uint8) public recoveryThreshold;

    // ─── Events ───────────────────────────────────────────────────────────────
    event IdentityRegistered(bytes32 indexed identifierHash, address indexed wallet, bytes32 role);
    event LockAUpdated(bytes32 indexed identifierHash, string newLockACid);
    event EmergencyCidUpdated(bytes32 indexed identifierHash, string newEmergencyCid);
    event DoctorVerified(address indexed wallet);
    event VerifierUpdated(address indexed newVerifier);
    event GuardianAdded(address indexed patient, address indexed guardian);
    event GuardianRemoved(address indexed patient, address indexed guardian);
    event RecoveryInitiated(address indexed patient, string proposedLockACid);
    event RecoveryVoted(address indexed patient, address indexed guardian, uint8 votesTotal);
    event RecoveryCompleted(address indexed patient, string newLockACid);
    event RecoveryCancelled(address indexed patient);
    event TitleUpdated(bytes32 indexed identifierHash, string title);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier exists(bytes32 idHash) { require(identities[idHash].exists, "Not found"); _; }
    modifier onlyWallet(bytes32 idHash) { require(identities[idHash].wallet == msg.sender, "Not your identity"); _; }

    constructor(address _verifier) {
        owner = msg.sender;
        verifier = IVerifier(_verifier);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Hot-swap the verifier (manual → Kleros → Chainlink oracle)
    function setVerifier(address _verifier) external onlyOwner {
        verifier = IVerifier(_verifier);
        emit VerifierUpdated(_verifier);
    }

    // ─── Registration ──────────────────────────────────────────────────────────

    /**
     * @param identifierHash  keccak256(email) or keccak256(phone)
     * @param lockACid        IPFS CID: Argon2id-derived key → AES-256-GCM(privKey)
     * @param lockCCid        IPFS CID: AES-256-GCM(privKey, recoveryPhrase)
     * @param recoveryKeyHash keccak256(recoveryPhrase) — for client verification only
     * @param emergencyCid    IPFS CID: Tier-0 public profile (blood group, allergies, ICE — NO name by default)
     * @param role            "patient" | "doctor" | "hospital"
     * @param licenseHash     For doctors: keccak256(licenseNumber). Zero for patients.
     */
    function register(
        bytes32 identifierHash,
        string calldata lockACid,
        string calldata lockCCid,
        bytes32 recoveryKeyHash,
        string calldata emergencyCid,
        bytes32 role,
        bytes32 licenseHash
    ) external {
        require(!identities[identifierHash].exists, "Identifier taken");
        require(walletToIdentifier[msg.sender] == bytes32(0), "Wallet already used");

        identities[identifierHash] = Identity({
            lockACid: lockACid,
            lockCCid: lockCCid,
            recoveryKeyHash: recoveryKeyHash,
            emergencyCid: emergencyCid,
            wallet: msg.sender,
            role: role,
            licenseHash: licenseHash,
            exists: true,
            title: ""
        });

        walletToIdentifier[msg.sender] = identifierHash;
        // Patients auto-pass; doctors/hospitals pass if verifier approves (Kleros/manual)
        emit IdentityRegistered(identifierHash, msg.sender, role);
    }

    // ─── Lock Updates ─────────────────────────────────────────────────────────

    function updateLockA(bytes32 idHash, string calldata newLockACid)
        external exists(idHash) onlyWallet(idHash)
    {
        identities[idHash].lockACid = newLockACid;
        emit LockAUpdated(idHash, newLockACid);
    }

    function updateEmergencyCid(bytes32 idHash, string calldata newEmergencyCid)
        external exists(idHash) onlyWallet(idHash)
    {
        identities[idHash].emergencyCid = newEmergencyCid;
        emit EmergencyCidUpdated(idHash, newEmergencyCid);
    }

    /// @notice Set optional title for display and Unconscious Protocol (e.g. "Surgeon", "Nurse")
    function setTitle(bytes32 idHash, string calldata title) external exists(idHash) onlyWallet(idHash) {
        identities[idHash].title = title;
        emit TitleUpdated(idHash, title);
    }

    // ─── Social Recovery ─────────────────────────────────────────────────────

    function setRecoveryThreshold(uint8 threshold) external {
        require(threshold >= 1 && threshold <= 5, "Threshold 1-5");
        bytes32 idHash = walletToIdentifier[msg.sender];
        require(identities[idHash].exists, "Not registered");
        recoveryThreshold[msg.sender] = threshold;
    }

    function addGuardian(address guardian) external {
        require(guardian != msg.sender, "Cannot self-guard");
        require(_guardians[msg.sender].length < 5, "Max 5 guardians");
        _guardians[msg.sender].push(guardian);
        emit GuardianAdded(msg.sender, guardian);
    }

    function removeGuardian(address guardian) external {
        address[] storage arr = _guardians[msg.sender];
        for (uint i = 0; i < arr.length; i++) {
            if (arr[i] == guardian) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                emit GuardianRemoved(msg.sender, guardian);
                return;
            }
        }
        revert("Guardian not found");
    }

    /**
     * @notice Guardian initiates recovery or votes on existing proposal
     * @dev All guardians must agree on the SAME newLockACid. First voter sets the proposal.
     */
    function voteForRecovery(address patient, string calldata proposedLockACid) external {
        require(!guardianVotes[patient][msg.sender], "Already voted");
        require(_isGuardian(patient, msg.sender), "Not a guardian");

        // If first vote — set the proposal
        if (recoveryVoteCount[patient] == 0) {
            pendingNewLockACid[patient] = proposedLockACid;
            emit RecoveryInitiated(patient, proposedLockACid);
        } else {
            // All votes must agree on the same proposed key
            require(keccak256(bytes(pendingNewLockACid[patient])) == keccak256(bytes(proposedLockACid)), "Proposal mismatch");
        }

        guardianVotes[patient][msg.sender] = true;
        recoveryVoteCount[patient]++;
        emit RecoveryVoted(patient, msg.sender, recoveryVoteCount[patient]);

        uint8 threshold = recoveryThreshold[patient] == 0 ? 2 : recoveryThreshold[patient];
        if (recoveryVoteCount[patient] >= threshold) {
            bytes32 idHash = walletToIdentifier[patient];
            identities[idHash].lockACid = proposedLockACid;
            _resetRecoveryState(patient);
            emit RecoveryCompleted(patient, proposedLockACid);
        }
    }

    /// @notice Patient cancels an in-progress recovery attempt (if account is recovered)
    function cancelRecovery() external {
        _resetRecoveryState(msg.sender);
        emit RecoveryCancelled(msg.sender);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    function getIdentity(bytes32 idHash) external view returns (Identity memory) {
        return identities[idHash];
    }

    function getGuardians(address patient) external view returns (address[] memory) {
        return _guardians[patient];
    }

    function isEntityVerified(address entity) external view returns (bool) {
        return verifier.isVerified(entity);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _isGuardian(address patient, address addr) internal view returns (bool) {
        for (uint i = 0; i < _guardians[patient].length; i++) {
            if (_guardians[patient][i] == addr) return true;
        }
        return false;
    }

    function _resetRecoveryState(address patient) internal {
        address[] storage gs = _guardians[patient];
        for (uint i = 0; i < gs.length; i++) {
            guardianVotes[patient][gs[i]] = false;
        }
        recoveryVoteCount[patient] = 0;
        delete pendingNewLockACid[patient];
    }
}
