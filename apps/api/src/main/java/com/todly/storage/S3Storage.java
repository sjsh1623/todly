package com.todly.storage;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;

/**
 * Object-storage ({@code S3}) implementation — STUBBED (IMP-25).
 *
 * <p>Activated only when {@code todly.storage.provider=s3}; the default
 * {@link LocalFileStorage} keeps the app runnable without any AWS dependency.
 * Wiring this up means adding the AWS SDK (software.amazon.awssdk:s3) and putting
 * objects into {@code todly.storage.s3Bucket} with presigned-GET URLs. Until then
 * every method throws so a misconfiguration fails fast rather than silently.
 *
 * <pre>{@code
 * // TODO(IMP-25): real implementation
 * //   S3Client s3 = ...;
 * //   put: s3.putObject(b -> b.bucket(bucket).key(key).contentType(ct), RequestBody.fromBytes(data));
 * //   get: s3.getObject(b -> b.bucket(bucket).key(key));
 * }</pre>
 */
@Component
@ConditionalOnProperty(name = "todly.storage.provider", havingValue = "s3")
public class S3Storage implements StorageService {

    private final StorageProperties props;

    public S3Storage(StorageProperties props) {
        this.props = props;
    }

    @Override
    public StoredObject put(String key, byte[] data, String contentType) throws IOException {
        throw new IOException("S3 storage not implemented (TODO IMP-25); bucket=" + props.getS3Bucket());
    }

    @Override
    public InputStream get(String key) throws IOException {
        throw new IOException("S3 storage not implemented (TODO IMP-25)");
    }

    @Override
    public boolean exists(String key) {
        return false;
    }
}
