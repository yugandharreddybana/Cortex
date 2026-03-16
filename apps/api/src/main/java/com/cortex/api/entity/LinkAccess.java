package com.cortex.api.entity;

/**
 * Controls link-level access for a shared resource.
 */
public enum LinkAccess {
    RESTRICTED,        // only explicitly invited users
    ANYONE_WITH_LINK   // anyone with the link gets defaultLinkRole
}
