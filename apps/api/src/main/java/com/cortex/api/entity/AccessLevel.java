package com.cortex.api.entity;

/**
 * Google Docs–style access levels, ordered from least to most privileged.
 */
public enum AccessLevel {
    VIEWER,     // read-only
    COMMENTER,  // read + notes
    EDITOR,     // full CRUD (except delete root)
    OWNER;      // full control

    /** Returns true if this level is at least as privileged as the required level. */
    public boolean atLeast(AccessLevel required) {
        return this.ordinal() >= required.ordinal();
    }
}
