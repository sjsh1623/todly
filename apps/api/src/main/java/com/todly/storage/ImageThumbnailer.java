package com.todly.storage;

import com.todly.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Shared image decode + thumbnail generation (extracted from PHASE 6
 * {@code LiveRoomService} so room photos and task photos share one code path).
 * Thumbnails are downscaled to fit {@link #THUMB_MAX} on the longest edge and
 * emitted as PNG.
 */
@Component
public class ImageThumbnailer {

    /** Max edge for generated thumbnails. */
    public static final int THUMB_MAX = 480;

    /** Decode bytes into an image, or throw 400 INVALID_IMAGE. */
    public BufferedImage decode(byte[] bytes) {
        BufferedImage image;
        try {
            image = ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (IOException e) {
            image = null;
        }
        if (image == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IMAGE",
                "Could not decode the uploaded image");
        }
        return image;
    }

    /** Generate a PNG thumbnail (longest edge ≤ {@link #THUMB_MAX}). */
    public byte[] thumbnail(BufferedImage src) {
        int w = src.getWidth();
        int h = src.getHeight();
        double scale = Math.min(1.0, (double) THUMB_MAX / Math.max(w, h));
        int tw = Math.max(1, (int) Math.round(w * scale));
        int th = Math.max(1, (int) Math.round(h * scale));
        BufferedImage thumb = new BufferedImage(tw, th, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = thumb.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
            RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(src, 0, 0, tw, th, null);
        g.dispose();
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(thumb, "png", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR",
                "Failed to generate thumbnail");
        }
    }
}
