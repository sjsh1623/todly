package com.todly.home;

import com.todly.common.CurrentUser;
import com.todly.home.dto.HomeDtos.HomeSummaryDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Home summary endpoint. Requires authentication; aggregates the caller's
 * greeting, needs-attention tasks and group progress.
 */
@RestController
@RequestMapping("/api/v1/home")
public class HomeController {

    private final HomeService homeService;

    public HomeController(HomeService homeService) {
        this.homeService = homeService;
    }

    @GetMapping("/summary")
    public HomeSummaryDto summary() {
        return homeService.summary(CurrentUser.id());
    }
}
