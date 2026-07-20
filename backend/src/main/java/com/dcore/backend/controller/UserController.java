package com.dcore.backend.controller;

import com.dcore.backend.dto.CreateUserRequest;
import com.dcore.backend.dto.UserDto;
import com.dcore.backend.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<UserDto> createUser(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.ok(userService.createUser(request));
    }

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<UserDto>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }
}
