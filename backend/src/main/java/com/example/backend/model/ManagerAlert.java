package com.example.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "manager_alerts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManagerAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 2000)
    private String message;

    @Column(nullable = false)
    private String severity; // CRITICAL, WARNING, INFO

    private LocalDateTime sentAt;

    private String sentBy;

    private int recipientCount;

    @PrePersist
    public void prePersist() {
        if (sentAt == null) {
            sentAt = LocalDateTime.now();
        }
    }
}
