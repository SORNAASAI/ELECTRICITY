package com.example.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManagerRequestDto {

    @NotBlank(message = "Manager name is required")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Valid email is required")
    private String email;

    private String phone;

    @NotBlank(message = "Station name is required")
    private String stationName;

    @NotBlank(message = "Station location is required")
    private String stationLocation;

    private Double capacityKw;

    private Integer evPorts;

    private String notes;
}
