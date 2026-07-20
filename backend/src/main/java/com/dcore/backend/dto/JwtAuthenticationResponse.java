package com.dcore.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class JwtAuthenticationResponse {
    private String accessToken;
    private String token;
    private String tokenType;
    private String username;
    private String role;
    private String name;

    public JwtAuthenticationResponse(String accessToken, String tokenType, String username, String role, String name) {
        this.accessToken = accessToken;
        this.token = accessToken;
        this.tokenType = tokenType;
        this.username = username;
        this.role = role;
        this.name = name;
    }
}
