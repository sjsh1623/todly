package com.todly.storage;

/**
 * A stored binary object: its storage key (opaque to callers) and content type.
 */
public record StoredObject(String key, String contentType, long bytes) {}
