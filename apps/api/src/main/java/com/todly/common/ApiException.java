package com.todly.common;

import org.springframework.http.HttpStatus;

/**
 * Application-level exception carrying a stable error {@code code}, a human
 * message and the HTTP status it maps to. The {@link GlobalExceptionHandler}
 * renders it as the standard error body {code, message, details}.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final transient Object details;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, null);
    }

    public ApiException(HttpStatus status, String code, String message, Object details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
    public Object getDetails() { return details; }

    // --- common factory helpers -------------------------------------------

    public static ApiException emailTaken() {
        return new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "Email is already in use");
    }

    public static ApiException usernameTaken() {
        return new ApiException(HttpStatus.CONFLICT, "USERNAME_TAKEN", "Username is already taken");
    }

    public static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    public static ApiException invalidToken(String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_TOKEN", message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
    }

    public static ApiException badRequest(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }
}
