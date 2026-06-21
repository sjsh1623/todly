package com.todly.storage;

import java.io.IOException;
import java.io.InputStream;

/**
 * Abstraction over where photo bytes physically live. The default
 * {@link LocalFileStorage} writes to a configurable directory on disk; an
 * {@link S3Storage} stub documents the object-storage alternative (IMP-25).
 *
 * <p>Callers store bytes under a logical {@code key} (we use the photo UUID, plus
 * a {@code -thumb} suffix for thumbnails) and later read them back to serve via
 * the {@code /api/v1/photos/{id}} endpoints.
 */
public interface StorageService {

    /** Persist {@code data} under {@code key}; returns the stored-object metadata. */
    StoredObject put(String key, byte[] data, String contentType) throws IOException;

    /** Open the bytes previously stored under {@code key}. */
    InputStream get(String key) throws IOException;

    /** @return true if an object exists for {@code key}. */
    boolean exists(String key);
}
