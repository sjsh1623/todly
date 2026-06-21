package com.todly.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

/**
 * Filesystem-backed {@link StorageService}. Writes each object as a file named by
 * its {@code key} under {@code todly.storage.dir}, creating the directory tree on
 * startup. The content type is persisted in a sidecar {@code .meta} file so it can
 * be returned when serving the bytes back.
 *
 * <p>This is the default provider (it runs unless {@code todly.storage.provider=s3});
 * no external services are required to run the app or the tests.
 */
@Component
@ConditionalOnProperty(name = "todly.storage.provider", havingValue = "local", matchIfMissing = true)
public class LocalFileStorage implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalFileStorage.class);

    private final Path root;

    public LocalFileStorage(StorageProperties props) throws IOException {
        this.root = Paths.get(props.getDir()).toAbsolutePath().normalize();
        Files.createDirectories(root);
        log.info("LocalFileStorage initialized at {}", root);
    }

    @Override
    public StoredObject put(String key, byte[] data, String contentType) throws IOException {
        Path file = resolve(key);
        Files.createDirectories(file.getParent());
        Path tmp = Files.createTempFile(file.getParent(), key, ".tmp");
        Files.write(tmp, data);
        Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
        Files.writeString(metaFile(key), contentType == null ? "application/octet-stream" : contentType);
        return new StoredObject(key, contentType, data.length);
    }

    @Override
    public InputStream get(String key) throws IOException {
        return Files.newInputStream(resolve(key));
    }

    @Override
    public boolean exists(String key) {
        return Files.exists(resolve(key));
    }

    /** Read back the stored content type, or null if unknown. */
    public String contentType(String key) {
        try {
            Path meta = metaFile(key);
            return Files.exists(meta) ? Files.readString(meta).trim() : null;
        } catch (IOException e) {
            return null;
        }
    }

    private Path resolve(String key) {
        Path p = root.resolve(key).normalize();
        if (!p.startsWith(root)) {
            throw new IllegalArgumentException("Invalid storage key: " + key);
        }
        return p;
    }

    private Path metaFile(String key) {
        return resolve(key + ".meta");
    }
}
