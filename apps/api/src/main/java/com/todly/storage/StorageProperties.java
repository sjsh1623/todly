package com.todly.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Storage configuration ({@code todly.storage.*}).
 *
 * <ul>
 *   <li>{@code provider} — {@code local} (default) or {@code s3}.</li>
 *   <li>{@code dir} — local filesystem directory for the {@code local} provider.
 *       Defaults to {@code ${java.io.tmpdir}/todly-photos}; set to a mounted
 *       volume (e.g. {@code /app/data/photos}) for persistence in containers.</li>
 *   <li>{@code s3Bucket} — bucket name for the {@code s3} provider (stub).</li>
 * </ul>
 */
@ConfigurationProperties(prefix = "todly.storage")
public class StorageProperties {

    private String provider = "local";
    private String dir = System.getProperty("java.io.tmpdir") + "/todly-photos";
    private String s3Bucket = "";

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getDir() { return dir; }
    public void setDir(String dir) { this.dir = dir; }

    public String getS3Bucket() { return s3Bucket; }
    public void setS3Bucket(String s3Bucket) { this.s3Bucket = s3Bucket; }
}
