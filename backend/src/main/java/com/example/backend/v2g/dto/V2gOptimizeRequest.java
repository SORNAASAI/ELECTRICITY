package com.example.backend.v2g.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class V2gOptimizeRequest {
    @Builder.Default
    private String date = "2026-08-10";

    @Builder.Default
    private String modelName = "xgboost";

    @Builder.Default
    private Double efficiency = 0.90;

    @Builder.Default
    private Integer fleetMultiplier = 1;
}
