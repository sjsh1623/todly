package com.todly.account;

import com.todly.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * SCR-16 "문의하기": minimal support contact endpoint. The message is logged for
 * now; routing to a real inbox/ticketing system is a follow-up (TODO).
 */
@RestController
@RequestMapping("/api/v1/support")
public class SupportController {

    private static final Logger log = LoggerFactory.getLogger(SupportController.class);

    public record ContactRequest(
        @NotBlank @Size(max = 200, message = "subject must be 1-200 chars") String subject,
        @NotBlank @Size(max = 5000, message = "body must be 1-5000 chars") String body
    ) {}

    @PostMapping("/contact")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void contact(@Valid @RequestBody ContactRequest req) {
        // TODO(support): route to a real support inbox / ticketing system.
        log.info("Support contact from user {} subject='{}' body='{}'",
            CurrentUser.id(), req.subject(), req.body());
    }
}
