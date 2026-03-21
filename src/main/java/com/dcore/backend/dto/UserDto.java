package com.dcore.backend.dto;

import com.dcore.backend.entity.Role;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserDto {
    private Long id;
    private String username;
    private String name;
    private Role role;
}
