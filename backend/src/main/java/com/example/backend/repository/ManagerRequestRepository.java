package com.example.backend.repository;

import com.example.backend.model.ManagerRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ManagerRequestRepository extends JpaRepository<ManagerRequest, Long> {
    List<ManagerRequest> findByStatusOrderBySubmittedAtDesc(String status);
    List<ManagerRequest> findAllByOrderBySubmittedAtDesc();
    long countByStatus(String status);
    boolean existsByEmailAndStatus(String email, String status);
}
