// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IIdentityRegistryMinimal
 * @notice Minimal IdentityRegistry interface used by RoleBasedVerifier.
 */
interface IIdentityRegistryMinimal {
    struct Identity {
        string lockACid;
        string lockCCid;
        bytes32 recoveryKeyHash;
        string emergencyCid;
        address wallet;
        bytes32 role;
        bytes32 licenseHash;
        bool exists;
        string title;
    }

    function walletToIdentifier(address wallet) external view returns (bytes32);
    function getIdentity(bytes32 idHash) external view returns (Identity memory);
}

/**
 * @title RoleBasedVerifier
 * @notice Auto-verifies clinicians based on IdentityRegistry role:
 *         - doctor: verified
 *         - hospital: verified
 *
 * Optional admin overrides:
 *   - forceApprove(entity): verify even if role check fails
 *   - forceRevoke(entity): block even if role check passes
 */
contract RoleBasedVerifier {
    address public admin;
    IIdentityRegistryMinimal public identityRegistry;

    mapping(address => bool) public forceApproved;
    mapping(address => bool) public forceRevoked;

    bytes32 private constant ROLE_DOCTOR = bytes32("doctor");
    bytes32 private constant ROLE_HOSPITAL = bytes32("hospital");

    event IdentityRegistryUpdated(address indexed identityRegistry);
    event ForceApproved(address indexed entity);
    event ForceRevoked(address indexed entity);
    event ForceApprovalCleared(address indexed entity);
    event ForceRevocationCleared(address indexed entity);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor(address _identityRegistry) {
        require(_identityRegistry != address(0), "Invalid identity registry");
        admin = msg.sender;
        identityRegistry = IIdentityRegistryMinimal(_identityRegistry);
        emit IdentityRegistryUpdated(_identityRegistry);
    }

    function setIdentityRegistry(address _identityRegistry) external onlyAdmin {
        require(_identityRegistry != address(0), "Invalid identity registry");
        identityRegistry = IIdentityRegistryMinimal(_identityRegistry);
        emit IdentityRegistryUpdated(_identityRegistry);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin");
        address oldAdmin = admin;
        admin = newAdmin;
        emit AdminTransferred(oldAdmin, newAdmin);
    }

    function forceApprove(address entity) external onlyAdmin {
        forceApproved[entity] = true;
        forceRevoked[entity] = false;
        emit ForceApproved(entity);
    }

    function forceRevoke(address entity) external onlyAdmin {
        forceRevoked[entity] = true;
        forceApproved[entity] = false;
        emit ForceRevoked(entity);
    }

    function clearForceApprove(address entity) external onlyAdmin {
        forceApproved[entity] = false;
        emit ForceApprovalCleared(entity);
    }

    function clearForceRevoke(address entity) external onlyAdmin {
        forceRevoked[entity] = false;
        emit ForceRevocationCleared(entity);
    }

    function isVerified(address entity) external view returns (bool) {
        if (forceRevoked[entity]) return false;
        if (forceApproved[entity]) return true;

        bytes32 idHash = identityRegistry.walletToIdentifier(entity);
        if (idHash == bytes32(0)) return false;

        IIdentityRegistryMinimal.Identity memory identity = identityRegistry.getIdentity(idHash);
        if (!identity.exists) return false;
        if (identity.wallet != entity) return false;

        return identity.role == ROLE_DOCTOR || identity.role == ROLE_HOSPITAL;
    }
}

