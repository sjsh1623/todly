package com.todly.common;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Standard error body: {@code {code, message, details}}.
 * {@code details} is omitted from the JSON when null.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(String code, String message, Object details) {

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message, null);
    }

    public static ErrorResponse of(String code, String message, Object details) {
        return new ErrorResponse(code, message, details);
    }
}
