package com.cortex.api.entity;

/** Lifecycle state of a resource permission (share invite). */
public enum PermissionStatus {
    PENDING,    // invite sent, awaiting invitee response
    ACCEPTED,   // invitee accepted — resource visible in their workspace
    DECLINED    // invitee declined — permission retained for audit, excluded from listings
}
