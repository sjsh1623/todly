package com.todly.auth;

import com.todly.account.AccountDtos.ChangePasswordRequest;
import com.todly.account.AccountDtos.ConnectedAccountDto;
import com.todly.account.AccountDtos.DeleteMeRequest;
import com.todly.account.AccountDtos.UpdateMeRequest;
import com.todly.account.AccountService;
import com.todly.auth.dto.AuthDtos.UserDto;
import com.todly.common.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The authenticated "me" area. GET /me (PHASE 2) plus PHASE 10 profile/settings,
 * password change, connected accounts, data export and account withdrawal.
 */
@RestController
@RequestMapping("/api/v1/me")
public class MeController {

    private final AuthService authService;
    private final AccountService accountService;

    public MeController(AuthService authService, AccountService accountService) {
        this.authService = authService;
        this.accountService = accountService;
    }

    @GetMapping
    public UserDto me() {
        return authService.currentUser(CurrentUser.id());
    }

    @PatchMapping
    public UserDto updateMe(@Valid @RequestBody UpdateMeRequest req) {
        return accountService.updateMe(CurrentUser.id(), req);
    }

    @PostMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@Valid @RequestBody ChangePasswordRequest req) {
        accountService.changePassword(CurrentUser.id(), req);
    }

    @GetMapping("/connected-accounts")
    public List<ConnectedAccountDto> connectedAccounts() {
        return accountService.connectedAccounts(CurrentUser.id());
    }

    @GetMapping("/export")
    public ResponseEntity<Object> export() {
        Object body = accountService.exportData(CurrentUser.id());
        return ResponseEntity.ok()
            .header("Content-Disposition", "attachment; filename=\"todly-export.json\"")
            .body(body);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(@RequestBody(required = false) DeleteMeRequest req) {
        accountService.deleteMe(CurrentUser.id(), req);
    }
}
