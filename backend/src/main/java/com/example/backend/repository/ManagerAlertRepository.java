package com.example.backend.repository;

import com.example.backend.model.ManagerAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ManagerAlertRepository extends JpaRepository<ManagerAlert, Long> {
    List<ManagerAlert> findAllByOrderBySentAtDesc();
}
