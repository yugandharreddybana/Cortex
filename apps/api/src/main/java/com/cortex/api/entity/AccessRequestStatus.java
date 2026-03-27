package com.cortex.api.entity;

/**
 * Lifecycle stages of an AccessRequest for shared folders.
 */
public enum AccessRequestStatus {
    /** Request is pending owner review. */
    PENDING,

    /** Owner has approved the upgrade; relevant ResourcePermission is added/updated. */
    APPROVED,

    /** Owner has rejected the request. */
    REJECTED
}
