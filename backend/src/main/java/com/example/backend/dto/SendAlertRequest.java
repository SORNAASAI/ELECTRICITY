package com.example.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendAlertRequest {

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Message content is required")
    private String message;

    @Builder.Default
    private String severity = "WARNING"; // CRITICAL, WARNING, INFO
}
