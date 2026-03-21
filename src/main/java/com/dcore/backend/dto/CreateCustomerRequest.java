package com.dcore.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateCustomerRequest {
    @NotBlank
    private String name;

    @NotBlank
    private String mobile;
}
